package terminal

import (
	"fmt"
	"os"
	"os/exec"
	"os/user"
	"runtime"
	"syscall"

	"github.com/creack/pty"
)

// PTY 封装伪终端功能，管理 shell 进程的生命周期
type PTY struct {
	// pty 主设备文件描述符
	pty *os.File
	// shell 子进程
	cmd *exec.Cmd
	// 是否已关闭
	closed bool
	// 输出数据通道，用于将 shell 输出发送到服务层
	outputChan chan []byte
}

// NewPTY 创建一个新的 PTY 实例
func NewPTY() *PTY {
	return &PTY{
		outputChan: make(chan []byte, 1024),
	}
}

// detectDefaultShell 检测系统默认 shell
// macOS 优先使用 zsh，其次是 bash
func detectDefaultShell() string {
	// 首先检查环境变量 SHELL
	if shell := os.Getenv("SHELL"); shell != "" {
		if _, err := os.Stat(shell); err == nil {
			return shell
		}
	}

	// 尝试获取当前用户的登录 shell
	if u, err := user.Current(); err == nil {
		// macOS 通常使用 zsh
		if runtime.GOOS == "darwin" {
			return "/bin/zsh"
		}
		// 其他系统尝试解析用户 shell
		if u.Username != "" {
			// 尝试常见 shell
			for _, s := range []string{"/bin/zsh", "/bin/bash", "/bin/sh"} {
				if _, err := os.Stat(s); err == nil {
					return s
				}
			}
		}
	}

	// 最终回退到 /bin/sh
	return "/bin/sh"
}

// Start 启动指定的 shell，如果 shell 为空则自动检测
func (p *PTY) Start(shell string) error {
	if p.closed {
		return fmt.Errorf("PTY 已关闭")
	}

	if shell == "" {
		shell = detectDefaultShell()
	}

	// 创建 shell 命令
	p.cmd = exec.Command(shell)

	// 设置环境变量
	p.cmd.Env = os.Environ()

	// 启动 PTY
	ptyFile, err := pty.Start(p.cmd)
	if err != nil {
		return fmt.Errorf("启动 PTY 失败: %w", err)
	}

	p.pty = ptyFile

	// 启动读取 goroutine，将 shell 输出转发到通道
	go p.readLoop()

	return nil
}

// readLoop 持续读取 PTY 输出并发送到通道
func (p *PTY) readLoop() {
	buf := make([]byte, 4096)
	for {
		n, err := p.pty.Read(buf)
		if err != nil {
			// PTY 关闭或进程退出
			close(p.outputChan)
			return
		}
		if n > 0 {
			// 复制数据避免覆盖
			data := make([]byte, n)
			copy(data, buf[:n])
			select {
			case p.outputChan <- data:
			default:
				// 通道满时丢弃旧数据，保留新数据
				select {
				case <-p.outputChan:
				default:
				}
				p.outputChan <- data
			}
		}
	}
}

// Write 向 PTY 写入数据（用户输入）
func (p *PTY) Write(data []byte) error {
	if p.pty == nil {
		return fmt.Errorf("PTY 未启动")
	}
	if p.closed {
		return fmt.Errorf("PTY 已关闭")
	}
	_, err := p.pty.Write(data)
	return err
}

// OutputChan 返回输出数据通道
func (p *PTY) OutputChan() <-chan []byte {
	return p.outputChan
}

// Resize 调整 PTY 终端大小
func (p *PTY) Resize(cols, rows int) error {
	if p.pty == nil {
		return fmt.Errorf("PTY 未启动")
	}
	return pty.Setsize(p.pty, &pty.Winsize{
		Cols: uint16(cols),
		Rows: uint16(rows),
	})
}

// Close 关闭 PTY 和关联的 shell 进程
func (p *PTY) Close() error {
	if p.closed {
		return nil
	}
	p.closed = true

	// 先关闭 PTY 文件，这会触发 readLoop 退出
	if p.pty != nil {
		p.pty.Close()
	}

	// 终止 shell 进程
	if p.cmd != nil && p.cmd.Process != nil {
		// 尝试优雅终止
		_ = p.cmd.Process.Signal(syscall.SIGTERM)
		// 等待进程退出
		_ = p.cmd.Wait()
	}

	return nil
}

// IsRunning 检查 shell 进程是否仍在运行
func (p *PTY) IsRunning() bool {
	if p.cmd == nil || p.cmd.Process == nil {
		return false
	}
	// 发送信号 0 检查进程是否存在
	err := p.cmd.Process.Signal(syscall.Signal(0))
	return err == nil
}

package lsp

import (
	"fmt"
	"io"
	"os/exec"
	"sync"
	"syscall"
	"time"
)

// 本文件实现语言服务器进程管理
// 负责启动、监控和优雅关闭语言服务器进程

// ProcessManager 语言服务器进程管理器
type ProcessManager struct {
	// cmd 当前运行的命令
	cmd *exec.Cmd
	// stdin 进程标准输入
	stdin io.WriteCloser
	// stdout 进程标准输出
	stdout io.ReadCloser
	// stderr 进程标准错误
	stderr io.ReadCloser
	// serverPath 语言服务器可执行文件路径
	serverPath string
	// args 启动参数
	args []string
	// mu 互斥锁保护状态变更
	mu sync.RWMutex
	// running 进程是否正在运行
	running bool
	// stopCh 停止信号通道
	stopCh chan struct{}
}

// NewProcessManager 创建进程管理器
func NewProcessManager(serverPath string, args []string) *ProcessManager {
	return &ProcessManager{
		serverPath: serverPath,
		args:       args,
		stopCh:     make(chan struct{}),
	}
}

// Start 启动语言服务器进程
func (pm *ProcessManager) Start() error {
	pm.mu.Lock()
	defer pm.mu.Unlock()

	if pm.running {
		return fmt.Errorf("进程已在运行")
	}

	// 创建命令
	pm.cmd = exec.Command(pm.serverPath, pm.args...)

	// 获取管道
	stdin, err := pm.cmd.StdinPipe()
	if err != nil {
		return fmt.Errorf("创建stdin管道失败: %w", err)
	}
	pm.stdin = stdin

	stdout, err := pm.cmd.StdoutPipe()
	if err != nil {
		stdin.Close()
		return fmt.Errorf("创建stdout管道失败: %w", err)
	}
	pm.stdout = stdout

	stderr, err := pm.cmd.StderrPipe()
	if err != nil {
		stdin.Close()
		stdout.Close()
		return fmt.Errorf("创建stderr管道失败: %w", err)
	}
	pm.stderr = stderr

	// 启动进程
	if err := pm.cmd.Start(); err != nil {
		stdin.Close()
		stdout.Close()
		stderr.Close()
		return fmt.Errorf("启动语言服务器失败: %w", err)
	}

	pm.running = true
	pm.stopCh = make(chan struct{})

	// 启动错误输出监控协程
	go pm.monitorStderr()

	// 启动进程监控协程
	go pm.monitorProcess()

	return nil
}

// Stop 优雅停止语言服务器进程
func (pm *ProcessManager) Stop() error {
	pm.mu.Lock()
	defer pm.mu.Unlock()

	if !pm.running {
		return nil
	}

	// 发送停止信号
	close(pm.stopCh)

	// 尝试优雅关闭：先发送中断信号
	if pm.cmd != nil && pm.cmd.Process != nil {
		_ = pm.cmd.Process.Signal(syscall.SIGINT)
	}

	// 等待进程退出或超时
	done := make(chan error, 1)
	go func() {
		done <- pm.cmd.Wait()
	}()

	select {
	case <-done:
		// 进程正常退出
	case <-time.After(5 * time.Second):
		// 超时，强制终止
		if pm.cmd != nil && pm.cmd.Process != nil {
			_ = pm.cmd.Process.Kill()
		}
		<-done
	}

	// 关闭管道
	if pm.stdin != nil {
		pm.stdin.Close()
	}
	if pm.stdout != nil {
		pm.stdout.Close()
	}
	if pm.stderr != nil {
		pm.stderr.Close()
	}

	pm.running = false
	pm.cmd = nil

	return nil
}

// Restart 重启语言服务器进程
func (pm *ProcessManager) Restart() error {
	if err := pm.Stop(); err != nil {
		return fmt.Errorf("停止进程失败: %w", err)
	}
	return pm.Start()
}

// IsRunning 检查进程是否正在运行
func (pm *ProcessManager) IsRunning() bool {
	pm.mu.RLock()
	defer pm.mu.RUnlock()
	return pm.running
}

// Stdin 获取进程标准输入
func (pm *ProcessManager) Stdin() io.WriteCloser {
	pm.mu.RLock()
	defer pm.mu.RUnlock()
	return pm.stdin
}

// Stdout 获取进程标准输出
func (pm *ProcessManager) Stdout() io.ReadCloser {
	pm.mu.RLock()
	defer pm.mu.RUnlock()
	return pm.stdout
}

// monitorStderr 监控标准错误输出
func (pm *ProcessManager) monitorStderr() {
	buf := make([]byte, 4096)
	for {
		select {
		case <-pm.stopCh:
			return
		default:
		}

		pm.mu.RLock()
		stderr := pm.stderr
		pm.mu.RUnlock()

		if stderr == nil {
			return
		}

		n, err := stderr.Read(buf)
		if err != nil {
			if err != io.EOF {
				// stderr读取错误，可能是进程已退出
			}
			return
		}
		if n > 0 {
			// 将stderr输出到系统stderr
			fmt.Fprintf(io.Discard, "[LSP stderr] %s", string(buf[:n]))
		}
	}
}

// monitorProcess 监控进程状态
func (pm *ProcessManager) monitorProcess() {
	if pm.cmd == nil {
		return
	}

	err := pm.cmd.Wait()

	pm.mu.Lock()
	defer pm.mu.Unlock()

	// 如果进程异常退出且不是用户主动停止，记录日志
	if err != nil && pm.running {
		select {
		case <-pm.stopCh:
			// 用户主动停止，忽略错误
		default:
			// 进程异常退出
			fmt.Printf("语言服务器进程异常退出: %v\n", err)
		}
	}

	pm.running = false
}

// Wait 等待进程结束（阻塞）
func (pm *ProcessManager) Wait() error {
	pm.mu.RLock()
	cmd := pm.cmd
	pm.mu.RUnlock()

	if cmd == nil {
		return fmt.Errorf("进程未启动")
	}

	return cmd.Wait()
}

// GetServerPath 获取服务器可执行文件路径
func (pm *ProcessManager) GetServerPath() string {
	return pm.serverPath
}

// GetArgs 获取启动参数
func (pm *ProcessManager) GetArgs() []string {
	return pm.args
}

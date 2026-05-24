package terminal

import (
	"context"
	"encoding/base64"
	"fmt"
	"runtime"
	"sync"

	wailsRuntime "github.com/wailsapp/wails/v2/pkg/runtime"
)

// 事件名称常量，用于前后端通信
const (
	// EventTerminalOutput 后端向前端推送终端输出的事件
	EventTerminalOutput = "terminal:output"
	// EventTerminalInput 前端向后端发送输入的事件
	EventTerminalInput = "terminal:input"
	// EventTerminalResize 前端通知后端调整终端大小的事件
	EventTerminalResize = "terminal:resize"
	// EventTerminalReady 前端通知后端终端已就绪的事件
	EventTerminalReady = "terminal:ready"
	// EventTerminalClosed 终端关闭事件
	EventTerminalClosed = "terminal:closed"
)

// TerminalService 管理终端会话，处理前后端事件通信
type TerminalService struct {
	ctx context.Context
	// 当前活动的 PTY 实例
	pty *PTY
	// 互斥锁保护 pty 操作
	mu sync.RWMutex
	// 是否已初始化
	initialized bool
	// 终端默认大小
	defaultCols int
	defaultRows int
}

// NewTerminalService 创建新的终端服务实例
func NewTerminalService() *TerminalService {
	return &TerminalService{
		defaultCols: 80,
		defaultRows: 24,
	}
}

// Startup 在应用启动时初始化终端服务
// Wails 框架会在应用启动时自动调用此方法
func (s *TerminalService) Startup(ctx context.Context) {
	s.ctx = ctx

	// 注册前端事件监听器
	s.setupEventListeners()
}

// setupEventListeners 注册所有终端相关的事件处理器
func (s *TerminalService) setupEventListeners() {
	// 监听前端输入事件
	wailsRuntime.EventsOn(s.ctx, EventTerminalInput, func(data ...interface{}) {
		if len(data) == 0 {
			return
		}
		s.handleInput(data[0])
	})

	// 监听终端大小调整事件
	wailsRuntime.EventsOn(s.ctx, EventTerminalResize, func(data ...interface{}) {
		if len(data) < 2 {
			return
		}
		cols, ok1 := data[0].(float64)
		rows, ok2 := data[1].(float64)
		if ok1 && ok2 {
			s.handleResize(int(cols), int(rows))
		}
	})

	// 监听终端就绪事件（前端组件挂载后触发）
	wailsRuntime.EventsOn(s.ctx, EventTerminalReady, func(data ...interface{}) {
		s.handleReady()
	})
}

// handleInput 处理前端发送的输入数据
func (s *TerminalService) handleInput(data interface{}) {
	s.mu.RLock()
	pty := s.pty
	s.mu.RUnlock()

	if pty == nil {
		return
	}

	var input []byte
	switch v := data.(type) {
	case string:
		// 前端可能发送 base64 编码的数据
		decoded, err := base64.StdEncoding.DecodeString(v)
		if err == nil {
			input = decoded
		} else {
			input = []byte(v)
		}
	case []byte:
		input = v
	default:
		return
	}

	if err := pty.Write(input); err != nil {
		wailsRuntime.LogError(s.ctx, fmt.Sprintf("写入终端输入失败: %v", err))
	}
}

// handleResize 处理终端大小调整
func (s *TerminalService) handleResize(cols, rows int) {
	s.mu.RLock()
	pty := s.pty
	s.mu.RUnlock()

	if pty == nil {
		// 保存大小以便启动时使用
		s.defaultCols = cols
		s.defaultRows = rows
		return
	}

	if err := pty.Resize(cols, rows); err != nil {
		wailsRuntime.LogError(s.ctx, fmt.Sprintf("调整终端大小失败: %v", err))
	}
}

// handleReady 处理终端就绪事件，启动 shell
func (s *TerminalService) handleReady() {
	if s.initialized {
		return
	}
	s.initialized = true

	if err := s.StartTerminal(""); err != nil {
		wailsRuntime.LogError(s.ctx, fmt.Sprintf("启动终端失败: %v", err))
	}
}

// StartTerminal 启动一个新的终端会话
func (s *TerminalService) StartTerminal(shell string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	// 如果已有终端在运行，先关闭
	if s.pty != nil {
		_ = s.pty.Close()
		s.pty = nil
	}

	// 创建新的 PTY
	pty := NewPTY()
	if err := pty.Start(shell); err != nil {
		return err
	}

	// 应用默认大小
	if s.defaultCols > 0 && s.defaultRows > 0 {
		_ = pty.Resize(s.defaultCols, s.defaultRows)
	}

	s.pty = pty

	// 启动输出转发 goroutine
	go s.forwardOutput(pty)

	return nil
}

// forwardOutput 将 PTY 输出发送到前端
func (s *TerminalService) forwardOutput(pty *PTY) {
	outputChan := pty.OutputChan()
	for data := range outputChan {
		// 使用 base64 编码避免 JSON 序列化问题
		encoded := base64.StdEncoding.EncodeToString(data)
		// 仅在有效的 Wails 上下文中发送事件（测试环境中 ctx 可能为 nil）
		if s.ctx != nil {
			wailsRuntime.EventsEmit(s.ctx, EventTerminalOutput, encoded)
		}
	}

	// 输出通道关闭，发送关闭事件
	if s.ctx != nil {
		wailsRuntime.EventsEmit(s.ctx, EventTerminalClosed)
	}
}

// StopTerminal 停止当前终端会话
func (s *TerminalService) StopTerminal() error {
	s.mu.Lock()
	defer s.mu.Unlock()

	if s.pty == nil {
		return nil
	}

	err := s.pty.Close()
	s.pty = nil
	s.initialized = false
	return err
}

// IsRunning 检查终端是否正在运行
func (s *TerminalService) IsRunning() bool {
	s.mu.RLock()
	defer s.mu.RUnlock()

	if s.pty == nil {
		return false
	}
	return s.pty.IsRunning()
}

// GetDefaultShell 获取检测到的默认 shell 路径
func (s *TerminalService) GetDefaultShell() string {
	// macOS 上优先返回 zsh
	if runtime.GOOS == "darwin" {
		return "/bin/zsh"
	}
	return "/bin/bash"
}

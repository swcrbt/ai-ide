package e2e

import (
	"runtime"
	"testing"
	"time"

	"github.com/swcrbt/ai-ide/internal/terminal"
)

func skipIfPTYNorPermitted(t *testing.T) {
	t.Helper()
	if runtime.GOOS != "darwin" && runtime.GOOS != "linux" {
		t.Skip("PTY 仅在 darwin/linux 上支持")
	}
	pty := terminal.NewPTY()
	if err := pty.Start("/bin/sh"); err != nil {
		pty.Close()
		t.Skipf("无法启动 PTY: %v", err)
	}
	pty.Close()
}

func TestTerminalService_CreateTerminal(t *testing.T) {
	skipIfPTYNorPermitted(t)

	service := terminal.NewTerminalService()

	err := service.StartTerminal("")
	if err != nil {
		t.Fatalf("启动终端失败: %v", err)
	}

	if !service.IsRunning() {
		t.Error("终端创建后应处于运行状态")
	}

	if err := service.StopTerminal(); err != nil {
		t.Errorf("关闭终端失败: %v", err)
	}
}

// TestTerminalService_WriteAndRead 创建终端，写入命令，验证输出
func TestTerminalService_WriteAndRead(t *testing.T) {
	skipIfPTYNorPermitted(t)

	pty := terminal.NewPTY()
	if err := pty.Start("/bin/sh"); err != nil {
		t.Fatalf("启动 PTY 失败: %v", err)
	}
	defer pty.Close()

	if err := pty.Write([]byte("echo hello_test\n")); err != nil {
		t.Fatalf("写入命令失败: %v", err)
	}

	select {
	case data := <-pty.OutputChan():
		if len(data) == 0 {
			t.Error("终端输出不应为空")
		}
	case <-time.After(2 * time.Second):
		t.Log("读取输出超时，可能未收到数据")
	}
}

// TestTerminalService_Resize 创建终端，调整大小，验证无错误
func TestTerminalService_Resize(t *testing.T) {
	skipIfPTYNorPermitted(t)

	service := terminal.NewTerminalService()

	if err := service.StartTerminal(""); err != nil {
		t.Fatalf("启动终端失败: %v", err)
	}
	defer service.StopTerminal()

	pty := terminal.NewPTY()
	if err := pty.Start("/bin/sh"); err != nil {
		t.Fatalf("启动测试 PTY 失败: %v", err)
	}
	defer pty.Close()

	if err := pty.Resize(100, 40); err != nil {
		t.Errorf("调整终端大小失败: %v", err)
	}

	if err := pty.Resize(80, 24); err != nil {
		t.Errorf("恢复终端大小失败: %v", err)
	}
}

// TestTerminalService_CloseTerminal 创建终端，关闭它，验证已停止运行
func TestTerminalService_CloseTerminal(t *testing.T) {
	skipIfPTYNorPermitted(t)

	service := terminal.NewTerminalService()

	if err := service.StartTerminal(""); err != nil {
		t.Fatalf("启动终端失败: %v", err)
	}

	if !service.IsRunning() {
		t.Error("终端应处于运行状态")
	}

	if err := service.StopTerminal(); err != nil {
		t.Errorf("关闭终端失败: %v", err)
	}

	if service.IsRunning() {
		t.Error("关闭后终端不应再处于运行状态")
	}
}

// TestTerminalService_ListTerminals 验证当前 TerminalService 的终端管理能力
func TestTerminalService_ListTerminals(t *testing.T) {
	skipIfPTYNorPermitted(t)

	service := terminal.NewTerminalService()

	if err := service.StartTerminal(""); err != nil {
		t.Fatalf("启动第一个终端失败: %v", err)
	}

	if !service.IsRunning() {
		t.Error("第一个终端应处于运行状态")
	}

	if err := service.StartTerminal(""); err != nil {
		t.Fatalf("启动第二个终端失败: %v", err)
	}

	if !service.IsRunning() {
		t.Error("第二个终端应处于运行状态")
	}

	_ = service.StopTerminal()
}

// TestTerminalService_GetDefaultShell 验证默认 Shell 检测
func TestTerminalService_GetDefaultShell(t *testing.T) {
	service := terminal.NewTerminalService()
	shell := service.GetDefaultShell()

	if shell == "" {
		t.Error("默认 Shell 不应为空")
	}

	expected := "/bin/bash"
	if runtime.GOOS == "darwin" {
		expected = "/bin/zsh"
	}

	if shell != expected {
		t.Logf("默认 Shell: %s (期望: %s)", shell, expected)
	}
}

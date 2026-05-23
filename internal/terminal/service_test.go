package terminal

import (
	"testing"
)

// TestNewTerminalService 测试创建终端服务
func TestNewTerminalService(t *testing.T) {
	service := NewTerminalService()
	if service == nil {
		t.Fatal("NewTerminalService 返回 nil")
	}

	if service.defaultCols != 80 {
		t.Errorf("默认列数错误: got %d, want 80", service.defaultCols)
	}

	if service.defaultRows != 24 {
		t.Errorf("默认行数错误: got %d, want 24", service.defaultRows)
	}
}

// TestTerminalEventConstants 测试事件常量
func TestTerminalEventConstants(t *testing.T) {
	expected := map[string]string{
		"EventTerminalOutput": "terminal:output",
		"EventTerminalInput":  "terminal:input",
		"EventTerminalResize": "terminal:resize",
		"EventTerminalReady":  "terminal:ready",
		"EventTerminalClosed": "terminal:closed",
	}

	actual := map[string]string{
		"EventTerminalOutput": EventTerminalOutput,
		"EventTerminalInput":  EventTerminalInput,
		"EventTerminalResize": EventTerminalResize,
		"EventTerminalReady":  EventTerminalReady,
		"EventTerminalClosed": EventTerminalClosed,
	}

	for name, expectedValue := range expected {
		if actual[name] != expectedValue {
			t.Errorf("%s = %s, want %s", name, actual[name], expectedValue)
		}
	}
}

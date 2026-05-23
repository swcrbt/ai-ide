package ai

import (
	"strings"
	"testing"
)

// TestNewMCPToolManager 测试创建MCP工具管理器
func TestNewMCPToolManager(t *testing.T) {
	manager := NewMCPToolManager()
	if manager == nil {
		t.Fatal("NewMCPToolManager 返回 nil")
	}

	if manager.registry == nil {
		t.Error("registry 不应为 nil")
	}
}

// TestMCPToolManager_GetRegistry 测试获取注册表
func TestMCPToolManager_GetRegistry(t *testing.T) {
	manager := NewMCPToolManager()
	registry := manager.GetRegistry()

	if registry == nil {
		t.Error("GetRegistry 返回 nil")
	}
}

// TestMCPToolManager_GetToolDescriptions 测试获取工具描述
func TestMCPToolManager_GetToolDescriptions(t *testing.T) {
	manager := NewMCPToolManager()
	descriptions := manager.GetToolDescriptions()

	if descriptions == "" {
		t.Error("工具描述不应为空")
	}

	if !strings.Contains(descriptions, "grep_app") {
		t.Error("描述应包含 grep_app 工具")
	}

	if !strings.Contains(descriptions, "rtk") {
		t.Error("描述应包含 rtk 工具")
	}
}

// TestMCPToolManager_IsToolAvailable 测试工具可用性检查
func TestMCPToolManager_IsToolAvailable(t *testing.T) {
	manager := NewMCPToolManager()

	if !manager.IsToolAvailable("grep_app") {
		t.Error("grep_app 应该可用")
	}

	if !manager.IsToolAvailable("rtk") {
		t.Error("rtk 应该可用")
	}

	if manager.IsToolAvailable("nonexistent_tool") {
		t.Error("不存在的工具不应可用")
	}
}

// TestMCPToolManager_ListTools 测试列出工具
func TestMCPToolManager_ListTools(t *testing.T) {
	manager := NewMCPToolManager()
	toolList := manager.ListTools()

	if len(toolList) == 0 {
		t.Error("工具列表不应为空")
	}

	foundGrep := false
	foundRTK := false
	for _, tool := range toolList {
		if tool == "grep_app" {
			foundGrep = true
		}
		if tool == "rtk" {
			foundRTK = true
		}
	}

	if !foundGrep {
		t.Error("工具列表应包含 grep_app")
	}

	if !foundRTK {
		t.Error("工具列表应包含 rtk")
	}
}

// TestMCPToolManager_GetSetMCPToolManager 测试Getter和Setter
func TestMCPToolManager_GetSetMCPToolManager(t *testing.T) {
	manager := NewMCPToolManager()
	SetMCPToolManager(manager)

	got := GetMCPToolManager()
	if got != manager {
		t.Error("GetMCPToolManager 应返回设置的管理器")
	}
}

// TestExtractToolCallFromMarkdown 测试从Markdown提取工具调用
func TestExtractToolCallFromMarkdown(t *testing.T) {
	tests := []struct {
		name     string
		input    string
		expected string
	}{
		{"空字符串", "", ""},
		{"无工具调用", "这是一个普通回复", ""},
		{"包含代码块", "```tool\n{\"name\":\"test\"}\n```", `{"name":"test"}`},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := extractToolCallFromMarkdown(tt.input)
			if result != tt.expected {
				t.Errorf("extractToolCallFromMarkdown() = %q, want %q", result, tt.expected)
			}
		})
	}
}

// TestProcessAIResponse 测试处理AI响应
func TestProcessAIResponse(t *testing.T) {
	manager := NewMCPToolManager()

	t.Run("普通文本", func(t *testing.T) {
		result, toolResults, err := manager.ProcessAIResponse("你好，这是一个测试")
		if err != nil {
			t.Errorf("处理普通文本不应返回错误: %v", err)
		}
		if result != "你好，这是一个测试" {
			t.Error("普通文本应原样返回")
		}
		if len(toolResults) != 0 {
			t.Error("普通文本不应有工具结果")
		}
	})
}

// TestBuildSystemPromptWithTools 测试构建系统提示
func TestBuildSystemPromptWithTools(t *testing.T) {
	manager := NewMCPToolManager()
	prompt := manager.BuildSystemPromptWithTools("你是一个助手")

	if prompt == "" {
		t.Error("系统提示不应为空")
	}

	if !strings.Contains(prompt, "你是一个助手") {
		t.Error("系统提示应包含基础提示")
	}
}

// TestExtractAllToolCalls 测试提取所有工具调用
func TestExtractAllToolCalls(t *testing.T) {
	calls := extractAllToolCalls("")
	if len(calls) != 0 {
		t.Error("空输入应返回空切片")
	}

	calls = extractAllToolCalls("普通文本")
	if len(calls) != 0 {
		t.Error("无工具调用的输入应返回空切片")
	}

	calls = extractAllToolCalls("```tool\n{\"name\":\"test\"}\n```")
	if len(calls) != 1 {
		t.Errorf("应提取1个工具调用，实际 %d", len(calls))
	}
	if calls[0] != `{"name":"test"}` {
		t.Errorf("工具调用内容不匹配: %s", calls[0])
	}
}

// TestExecuteToolCall 测试执行工具调用
func TestExecuteToolCall(t *testing.T) {
	manager := NewMCPToolManager()

	// 测试无效JSON
	_, err := manager.ExecuteToolCall("invalid json")
	if err == nil {
		t.Error("无效JSON应返回错误")
	}

	// 测试解析有效的JSON（即使工具不存在）
	result, err := manager.ExecuteToolCall(`{"name":"nonexistent"}`)
	if err != nil {
		t.Logf("执行不存在的工具返回错误: %v", err)
	}
	_ = result
}

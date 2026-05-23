package mcp

import (
	"strings"
	"testing"

	"github.com/swcrbt/ai-ide/pkg/mcp/tools"
)

func TestToolRegistry(t *testing.T) {
	registry := NewToolRegistry()

	if registry.Count() != 0 {
		t.Errorf("新注册表应无工具，得到 %d", registry.Count())
	}

	tool1 := tools.NewGrepTool()
	tool2 := tools.NewRTKTool()

	if err := registry.Register(tool1); err != nil {
		t.Errorf("注册工具失败: %v", err)
	}

	if err := registry.Register(tool2); err != nil {
		t.Errorf("注册工具失败: %v", err)
	}

	if registry.Count() != 2 {
		t.Errorf("注册表应有 2 个工具，得到 %d", registry.Count())
	}

	if err := registry.Register(tool1); err == nil {
		t.Error("重复注册应返回错误")
	}

	gotTool, err := registry.Get("grep_app")
	if err != nil {
		t.Errorf("获取工具失败: %v", err)
	}
	if gotTool.Name() != "grep_app" {
		t.Errorf("获取的工具名称错误，期望 'grep_app'，得到 '%s'", gotTool.Name())
	}

	_, err = registry.Get("nonexistent")
	if err == nil {
		t.Error("获取不存在的工具应返回错误")
	}

	toolList := registry.List()
	if len(toolList) != 2 {
		t.Errorf("应列出 2 个工具，得到 %d", len(toolList))
	}

	descs := registry.ListWithDescription()
	if len(descs) != 2 {
		t.Errorf("应列出 2 个工具描述，得到 %d", len(descs))
	}

	registry.Unregister("rtk")
	if registry.Count() != 1 {
		t.Errorf("注销后应有 1 个工具，得到 %d", registry.Count())
	}

	definitions := registry.GetToolDefinitions()
	if len(definitions) != 1 {
		t.Errorf("应有 1 个工具定义，得到 %d", len(definitions))
	}
}

func TestToolCallExecution(t *testing.T) {
	registry := NewToolRegistry()

	rtkTool := tools.NewRTKTool()
	registry.Register(rtkTool)

	call := ToolCall{
		Name: "rtk",
		Arguments: map[string]interface{}{
			"command":  "echo test",
			"maxLines": 10,
		},
	}

	result := registry.ExecuteToolCall(call)
	if !result.Success {
		t.Errorf("工具调用应成功，错误: %s", result.Error)
	}
	if !strings.Contains(result.Output, "test") {
		t.Errorf("工具输出应包含 'test'，得到: %s", result.Output)
	}

	badCall := ToolCall{
		Name:      "nonexistent",
		Arguments: map[string]interface{}{},
	}

	result = registry.ExecuteToolCall(badCall)
	if result.Success {
		t.Error("不存在的工具调用应失败")
	}
	if !strings.Contains(result.Error, "未找到") {
		t.Errorf("错误信息应包含 '未找到'，得到: %s", result.Error)
	}
}

func TestToolCallStringExecution(t *testing.T) {
	registry := NewToolRegistry()

	permTool := tools.NewPermissionGuardTool()
	registry.Register(permTool)

	jsonStr := `{"name": "permission_guard", "arguments": {"operation": "test", "details": "测试操作"}}`

	result := registry.ExecuteToolCallString(jsonStr)
	if !result.Success {
		t.Errorf("字符串工具调用应成功，错误: %s", result.Error)
	}
}

func TestExtractJSONField(t *testing.T) {
	jsonStr := `{"name": "rtk", "arguments": {"command": "ls"}}`

	name := extractJSONField(jsonStr, "name")
	if name != "rtk" {
		t.Errorf("提取 name 字段应得到 'rtk'，得到: %s", name)
	}

	missing := extractJSONField(jsonStr, "missing")
	if missing != "" {
		t.Errorf("不存在的字段应返回空，得到: %s", missing)
	}
}

func TestExtractJSONArguments(t *testing.T) {
	jsonStr := `{"name": "rtk", "arguments": {"command": "ls", "maxLines": 10}}`

	args := extractJSONArguments(jsonStr)
	if len(args) == 0 {
		t.Error("应提取到参数")
	}

	if cmd, ok := args["command"]; !ok || cmd != "ls" {
		t.Errorf("应提取到 command 参数 'ls'，得到: %v", cmd)
	}
}

func TestMCPError(t *testing.T) {
	err := NewMCPError(ErrToolNotFound, "工具未找到")
	if err == nil {
		t.Error("应创建错误对象")
	}
	if !strings.Contains(err.Error(), "TOOL_NOT_FOUND") {
		t.Error("错误信息应包含错误码")
	}
	if !strings.Contains(err.Error(), "工具未找到") {
		t.Error("错误信息应包含错误消息")
	}
}

func TestToolDefinition(t *testing.T) {
	td := ToolDefinition{
		Name:        "test_tool",
		Description: "测试工具",
	}

	str := td.String()
	if !strings.Contains(str, "test_tool") {
		t.Error("工具定义字符串应包含名称")
	}
	if !strings.Contains(str, "测试工具") {
		t.Error("工具定义字符串应包含描述")
	}
}

func BenchmarkToolRegistry(b *testing.B) {
	registry := NewToolRegistry()
	registry.Register(tools.NewGrepTool())
	registry.Register(tools.NewRTKTool())
	registry.Register(tools.NewWebFetchTool())
	registry.Register(tools.NewPermissionGuardTool())

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_, _ = registry.Get("rtk")
	}
}

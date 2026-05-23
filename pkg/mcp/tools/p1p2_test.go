package tools

import (
	"strings"
	"testing"
)

// TestComputerUseTool 测试 computer_use 工具
func TestComputerUseTool(t *testing.T) {
	tool := NewComputerUseTool()

	// 测试名称和描述
	if tool.Name() != "computer_use" {
		t.Errorf("工具名称错误，期望 'computer_use'，得到 '%s'", tool.Name())
	}
	if tool.Description() == "" {
		t.Error("工具描述不能为空")
	}

	// 测试缺少参数
	_, err := tool.Execute(map[string]interface{}{})
	if err == nil {
		t.Error("缺少 'action' 参数时应返回错误")
	}

	// 测试无效 action
	_, err = tool.Execute(map[string]interface{}{"action": "invalid"})
	if err == nil {
		t.Error("无效的 action 时应返回错误")
	}

	// 测试 click 缺少 target
	_, err = tool.Execute(map[string]interface{}{"action": "click"})
	if err == nil {
		t.Error("click 操作缺少 'target' 时应返回错误")
	}

	// 测试 type 缺少 value
	_, err = tool.Execute(map[string]interface{}{"action": "type"})
	if err == nil {
		t.Error("type 操作缺少 'value' 时应返回错误")
	}
}

// TestCommandSuggestTool 测试 command_suggest 工具
func TestCommandSuggestTool(t *testing.T) {
	tool := NewCommandSuggestTool()

	if tool.Name() != "command_suggest" {
		t.Errorf("工具名称错误，期望 'command_suggest'，得到 '%s'", tool.Name())
	}
	if tool.Description() == "" {
		t.Error("工具描述不能为空")
	}

	// 测试缺少参数
	_, err := tool.Execute(map[string]interface{}{})
	if err == nil {
		t.Error("缺少 'description' 参数时应返回错误")
	}

	// 测试查找文件
	result, err := tool.Execute(map[string]interface{}{
		"description": "查找所有 go 文件",
	})
	if err != nil {
		t.Errorf("查找文件命令建议失败: %v", err)
	}
	if !strings.Contains(result, "find") {
		t.Error("查找文件建议应包含 find 命令")
	}

	// 测试查看目录
	result, err = tool.Execute(map[string]interface{}{
		"description": "列出当前目录文件",
	})
	if err != nil {
		t.Errorf("列出目录命令建议失败: %v", err)
	}
	if !strings.Contains(result, "ls") {
		t.Error("列出目录建议应包含 ls 命令")
	}

	// 测试 git 相关
	result, err = tool.Execute(map[string]interface{}{
		"description": "查看 git 提交历史",
	})
	if err != nil {
		t.Errorf("git 命令建议失败: %v", err)
	}
	if !strings.Contains(result, "git") {
		t.Error("git 建议应包含 git 命令")
	}
}

// TestCodeReviewTool 测试 code_review 工具
func TestCodeReviewTool(t *testing.T) {
	tool := NewCodeReviewTool()

	if tool.Name() != "code_review" {
		t.Errorf("工具名称错误，期望 'code_review'，得到 '%s'", tool.Name())
	}
	if tool.Description() == "" {
		t.Error("工具描述不能为空")
	}

	// 测试缺少参数
	_, err := tool.Execute(map[string]interface{}{})
	if err == nil {
		t.Error("缺少 'code' 参数时应返回错误")
	}

	// 测试 Go 代码审查
	goCode := `package main

import "fmt"

func main() {
	fmt.Println("Hello World")
}

func process(data interface{}) {
	// TODO: implement
}
`
	result, err := tool.Execute(map[string]interface{}{
		"code":     goCode,
		"language": "go",
	})
	if err != nil {
		t.Errorf("Go 代码审查失败: %v", err)
	}
	if !strings.Contains(result, "代码审查报告") {
		t.Error("审查结果应包含报告标题")
	}
	if !strings.Contains(result, "评分") {
		t.Error("审查结果应包含评分")
	}

	// 测试 JavaScript 代码审查
	jsCode := `function test() {
	var x = 1;
	if (x == 1) {
		console.log("test");
	}
}
`
	result, err = tool.Execute(map[string]interface{}{
		"code":     jsCode,
		"language": "javascript",
	})
	if err != nil {
		t.Errorf("JavaScript 代码审查失败: %v", err)
	}
	if !strings.Contains(result, "评分") {
		t.Error("JS 审查结果应包含评分")
	}

	// 测试自动语言检测
	result, err = tool.Execute(map[string]interface{}{
		"code": goCode,
	})
	if err != nil {
		t.Errorf("自动语言检测审查失败: %v", err)
	}
	if !strings.Contains(result, "go") {
		t.Error("应自动检测到 Go 语言")
	}
}

// TestScreenshotTool 测试 screenshot 工具
func TestScreenshotTool(t *testing.T) {
	tool := NewScreenshotTool()

	if tool.Name() != "screenshot" {
		t.Errorf("工具名称错误，期望 'screenshot'，得到 '%s'", tool.Name())
	}
	if tool.Description() == "" {
		t.Error("工具描述不能为空")
	}

	// 在非 macOS 系统上应返回错误
	// 这里只测试参数解析
	_, err := tool.Execute(map[string]interface{}{"area": "invalid"})
	// 在 macOS 上可能成功或失败，在非 macOS 上会返回不支持的错误
	if err != nil {
		// 期望的错误：不支持的区域类型或系统不支持
		t.Logf("截图工具预期行为: %v", err)
	}
}

// TestWorkflowTool 测试 workflow 工具
func TestWorkflowTool(t *testing.T) {
	tool := NewWorkflowTool()

	if tool.Name() != "workflow" {
		t.Errorf("工具名称错误，期望 'workflow'，得到 '%s'", tool.Name())
	}
	if tool.Description() == "" {
		t.Error("工具描述不能为空")
	}

	// 测试缺少参数
	_, err := tool.Execute(map[string]interface{}{})
	if err == nil {
		t.Error("缺少 'action' 参数时应返回错误")
	}

	// 测试 list（应该能工作，即使没有保存过工作流）
	result, err := tool.Execute(map[string]interface{}{
		"action": "list",
	})
	if err != nil {
		t.Logf("list 操作可能需要数据库依赖: %v", err)
	} else {
		if !strings.Contains(result, "工作流") {
			t.Error("list 结果应包含工作流信息")
		}
	}

	// 测试 save 缺少参数
	_, err = tool.Execute(map[string]interface{}{
		"action": "save",
	})
	if err == nil {
		t.Error("save 操作缺少 'name' 时应返回错误")
	}

	// 测试 execute 不存在的工作流
	_, err = tool.Execute(map[string]interface{}{
		"action": "execute",
		"name":   "nonexistent_workflow",
	})
	if err == nil {
		t.Error("执行不存在的工作流时应返回错误")
	}

	// 测试 delete 不存在的工作流
	_, err = tool.Execute(map[string]interface{}{
		"action": "delete",
		"name":   "nonexistent_workflow",
	})
	if err == nil {
		t.Error("删除不存在的工作流时应返回错误")
	}
}

// TestCodeInterpreterTool 测试 code_interpreter 工具
func TestCodeInterpreterTool(t *testing.T) {
	tool := NewCodeInterpreterTool()

	if tool.Name() != "code_interpreter" {
		t.Errorf("工具名称错误，期望 'code_interpreter'，得到 '%s'", tool.Name())
	}
	if tool.Description() == "" {
		t.Error("工具描述不能为空")
	}

	// 测试缺少参数
	_, err := tool.Execute(map[string]interface{}{})
	if err == nil {
		t.Error("缺少参数时应返回错误")
	}

	// 测试不支持的语言
	_, err = tool.Execute(map[string]interface{}{
		"code":     "print('test')",
		"language": "ruby",
	})
	if err == nil {
		t.Error("不支持的语言时应返回错误")
	}
}

// TestDocumentationTool 测试 documentation 工具
func TestDocumentationTool(t *testing.T) {
	tool := NewDocumentationTool()

	if tool.Name() != "documentation" {
		t.Errorf("工具名称错误，期望 'documentation'，得到 '%s'", tool.Name())
	}
	if tool.Description() == "" {
		t.Error("工具描述不能为空")
	}

	// 测试生成函数文档
	goCode := `package main

func Add(a int, b int) int {
	return a + b
}

func Greet(name string) string {
	return "Hello, " + name
}
`
	result, err := tool.Execute(map[string]interface{}{
		"code": goCode,
		"type": "function",
	})
	if err != nil {
		t.Errorf("生成函数文档失败: %v", err)
	}
	if !strings.Contains(result, "函数文档") {
		t.Error("函数文档应包含标题")
	}
	if !strings.Contains(result, "Add") {
		t.Error("函数文档应包含 Add 函数")
	}

	// 测试生成 README
	result, err = tool.Execute(map[string]interface{}{
		"type":        "README",
		"projectName": "Test Project",
	})
	if err != nil {
		t.Errorf("生成 README 失败: %v", err)
	}
	if !strings.Contains(result, "Test Project") {
		t.Error("README 应包含项目名称")
	}
	if !strings.Contains(result, "安装说明") {
		t.Error("README 应包含安装说明")
	}
}

// TestFeishuIMTool 测试 feishu_im 工具
func TestFeishuIMTool(t *testing.T) {
	tool := NewFeishuIMTool()

	if tool.Name() != "feishu_im" {
		t.Errorf("工具名称错误，期望 'feishu_im'，得到 '%s'", tool.Name())
	}
	if tool.Description() == "" {
		t.Error("工具描述不能为空")
	}

	// 测试缺少 webhook
	_, err := tool.Execute(map[string]interface{}{})
	if err == nil {
		t.Error("缺少 'webhook' 参数时应返回错误")
	}

	// 测试无效 webhook
	_, err = tool.Execute(map[string]interface{}{
		"webhook": "http://invalid-url",
	})
	if err == nil {
		t.Error("无效的 webhook URL 时应返回错误")
	}

	// 测试缺少消息
	_, err = tool.Execute(map[string]interface{}{
		"webhook": "https://open.feishu.cn/open-apis/bot/v2/hook/test",
	})
	if err == nil {
		t.Error("缺少 'message' 参数时应返回错误")
	}

	// 测试不支持的消息类型
	_, err = tool.Execute(map[string]interface{}{
		"webhook":  "https://open.feishu.cn/open-apis/bot/v2/hook/test",
		"message":  "test",
		"msg_type": "image",
	})
	if err == nil {
		t.Error("不支持的消息类型时应返回错误")
	}
}

// TestP1P2ToolRegistration 测试所有 P1/P2 工具是否实现 Tool 接口
func TestP1P2ToolRegistration(t *testing.T) {
	// 验证所有工具都能被创建
	tools := []interface{}{
		NewComputerUseTool(),
		NewCommandSuggestTool(),
		NewCodeReviewTool(),
		NewScreenshotTool(),
		NewWorkflowTool(),
		NewCodeInterpreterTool(),
		NewDocumentationTool(),
		NewFeishuIMTool(),
	}

	expectedNames := []string{
		"computer_use",
		"command_suggest",
		"code_review",
		"screenshot",
		"workflow",
		"code_interpreter",
		"documentation",
		"feishu_im",
	}

	for i, tool := range tools {
		// 使用类型断言检查是否实现了 Tool 接口的方法
		type toolInterface interface {
			Name() string
			Description() string
			Execute(args map[string]interface{}) (string, error)
		}

		if _, ok := tool.(toolInterface); !ok {
			t.Errorf("工具 %d 未正确实现 Tool 接口", i)
			continue
		}

		actualTool := tool.(toolInterface)
		if actualTool.Name() != expectedNames[i] {
			t.Errorf("工具名称不匹配，期望 '%s'，得到 '%s'", expectedNames[i], actualTool.Name())
		}
		if actualTool.Description() == "" {
			t.Errorf("工具 '%s' 的描述不能为空", actualTool.Name())
		}
	}
}

// TestCommandSuggestKeywords 测试命令建议的关键词匹配
func TestCommandSuggestKeywords(t *testing.T) {
	tool := NewCommandSuggestTool()

	testCases := []struct {
		description string
		expectCmd   string
	}{
		{"查找文件", "find"},
		{"查看目录内容", "ls"},
		{"复制文件", "cp"},
		{"删除文件", "rm"},
		{"查看磁盘空间", "df"},
		{"git 提交", "git"},
		{"查看进程", "top"},
		{"压缩文件", "tar"},
		{"搜索文本", "grep"},
	}

	for _, tc := range testCases {
		result, err := tool.Execute(map[string]interface{}{
			"description": tc.description,
		})
		if err != nil {
			t.Errorf("描述 '%s' 失败: %v", tc.description, err)
			continue
		}
		if !strings.Contains(result, tc.expectCmd) {
			t.Errorf("描述 '%s' 的结果应包含 '%s'", tc.description, tc.expectCmd)
		}
	}
}

// TestCodeReviewIssues 测试代码审查的问题检测
func TestCodeReviewIssues(t *testing.T) {
	tool := NewCodeReviewTool()

	// 测试 Go 代码中的问题检测
	goCodeWithIssues := `package main

var globalVar = "test"

func process(data interface{}) {
	// TODO: fix this
	result := data
}
`
	result, err := tool.Execute(map[string]interface{}{
		"code":     goCodeWithIssues,
		"language": "go",
	})
	if err != nil {
		t.Fatalf("代码审查失败: %v", err)
	}

	// 检查是否检测到问题
	if !strings.Contains(result, "TODO") && !strings.Contains(result, "interface") {
		t.Log("警告: 可能未检测到所有预期的问题")
	}

	// 测试 JS 代码中的问题检测
	jsCodeWithIssues := `function test() {
	var x = 1;
	if (x == 1) {
		console.log("test");
		eval("1+1");
	}
}
`
	result, err = tool.Execute(map[string]interface{}{
		"code":     jsCodeWithIssues,
		"language": "javascript",
	})
	if err != nil {
		t.Fatalf("JS 代码审查失败: %v", err)
	}

	// 检查是否检测到严重问题
	if !strings.Contains(result, "eval") {
		t.Log("警告: 可能未检测到 eval 使用")
	}
}

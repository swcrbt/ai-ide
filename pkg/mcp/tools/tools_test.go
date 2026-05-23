package tools

import (
	"fmt"
	"strings"
	"testing"
)

func TestGrepTool(t *testing.T) {
	tool := NewGrepTool()

	if tool.Name() != "grep_app" {
		t.Errorf("工具名称错误，期望 'grep_app'，得到 '%s'", tool.Name())
	}

	if tool.Description() == "" {
		t.Error("工具描述不能为空")
	}

	_, err := tool.Execute(map[string]interface{}{})
	if err == nil {
		t.Error("缺少 'pattern' 参数时应返回错误")
	}

	_, err = tool.Execute(map[string]interface{}{"pattern": ""})
	if err == nil {
		t.Error("空的 'pattern' 参数时应返回错误")
	}

	result, err := tool.Execute(map[string]interface{}{
		"pattern": "Tool",
		"path":    "../../..",
		"include": "*.go",
	})
	if err != nil {
		t.Logf("搜索执行结果: %v", err)
	} else {
		if result == "" {
			t.Error("搜索结果不应为空")
		}
		t.Logf("搜索结果:\n%s", result)
	}

	result, err = tool.Execute(map[string]interface{}{
		"pattern":   "func Test",
		"path":      "../../..",
		"include":   "*_test.go",
		"exclude":   "vendor",
	})
	if err != nil {
		t.Logf("带过滤搜索执行结果: %v", err)
	} else {
		t.Logf("带过滤搜索结果:\n%s", result)
	}
}

func TestRTKTool(t *testing.T) {
	tool := NewRTKTool()

	if tool.Name() != "rtk" {
		t.Errorf("工具名称错误，期望 'rtk'，得到 '%s'", tool.Name())
	}

	if tool.Description() == "" {
		t.Error("工具描述不能为空")
	}

	_, err := tool.Execute(map[string]interface{}{})
	if err == nil {
		t.Error("缺少 'command' 参数时应返回错误")
	}

	result, err := tool.Execute(map[string]interface{}{
		"command":  "echo Hello World",
		"maxLines": 10,
	})
	if err != nil {
		t.Errorf("执行 echo 命令失败: %v", err)
	}
	if !strings.Contains(result, "Hello World") {
		t.Errorf("echo 命令输出应包含 'Hello World'，得到: %s", result)
	}

	result, err = tool.Execute(map[string]interface{}{
		"command": "ls -la",
	})
	if err != nil {
		t.Errorf("执行 ls 命令失败: %v", err)
	}
	if result == "" {
		t.Error("ls 命令输出不应为空")
	}

	result, err = tool.Execute(map[string]interface{}{
		"command": "git status",
	})
	if err == nil && result != "" {
		if strings.Contains(result, "(use \"git") {
			t.Error("git status 输出应过滤 '(use \"git' 提示信息")
		}
	}

	result, err = tool.Execute(map[string]interface{}{
		"command":  "seq 1 200",
		"maxLines": 10,
	})
	if err != nil {
		t.Errorf("执行 seq 命令失败: %v", err)
	}
	if !strings.Contains(result, "输出已截断") {
		t.Error("超过最大行数时应显示截断提示")
	}
}

func TestWebFetchTool(t *testing.T) {
	tool := NewWebFetchTool()

	if tool.Name() != "webfetch" {
		t.Errorf("工具名称错误，期望 'webfetch'，得到 '%s'", tool.Name())
	}

	if tool.Description() == "" {
		t.Error("工具描述不能为空")
	}

	_, err := tool.Execute(map[string]interface{}{})
	if err == nil {
		t.Error("缺少 'url' 参数时应返回错误")
	}

	_, err = tool.Execute(map[string]interface{}{"url": ""})
	if err == nil {
		t.Error("空的 'url' 参数时应返回错误")
	}

	result, err := tool.Execute(map[string]interface{}{
		"url":       "example.com",
		"maxLength": 100,
	})
	if err != nil {
		t.Logf("请求 example.com 结果: %v", err)
	} else {
		t.Logf("请求结果长度: %d", len(result))
	}
}

func TestPermissionGuardTool(t *testing.T) {
	tool := NewPermissionGuardTool()

	if tool.Name() != "permission_guard" {
		t.Errorf("工具名称错误，期望 'permission_guard'，得到 '%s'", tool.Name())
	}

	if tool.Description() == "" {
		t.Error("工具描述不能为空")
	}

	_, err := tool.Execute(map[string]interface{}{})
	if err == nil {
		t.Error("缺少 'operation' 参数时应返回错误")
	}

	result, err := tool.Execute(map[string]interface{}{
		"operation": "read",
		"details":   "读取配置文件",
	})
	if err != nil {
		t.Errorf("评估低风险操作失败: %v", err)
	}
	if !strings.Contains(result, "低风险") {
		t.Errorf("低风险操作应返回低风险评估，得到: %s", result)
	}

	result, err = tool.Execute(map[string]interface{}{
		"operation": "delete",
		"details":   "删除用户数据文件",
	})
	if err != nil {
		t.Errorf("评估高风险操作失败: %v", err)
	}
	if !strings.Contains(result, "高风险") && !strings.Contains(result, "严重风险") {
		t.Errorf("删除操作应返回高/严重风险评估，得到: %s", result)
	}

	result, err = tool.Execute(map[string]interface{}{
		"operation": "rm -rf",
		"details":   "删除系统目录 /usr/local",
	})
	if err != nil {
		t.Errorf("评估严重风险操作失败: %v", err)
	}
	if !strings.Contains(result, "严重风险") {
		t.Errorf("rm -rf 操作应返回严重风险评估，得到: %s", result)
	}

	result, err = tool.Execute(map[string]interface{}{
		"operation": "custom_op",
		"details":   "自定义操作",
		"riskLevel": "medium",
	})
	if err != nil {
		t.Errorf("评估中风险操作失败: %v", err)
	}
	if !strings.Contains(result, "中风险") {
		t.Errorf("指定中风险等级应返回中风险评估，得到: %s", result)
	}

	result, err = tool.Execute(map[string]interface{}{
		"operation": "modify",
		"details":   "修改数据库配置",
	})
	if err != nil {
		t.Errorf("评估操作失败: %v", err)
	}
	requiredElements := []string{
		"权限审批请求",
		"操作类型",
		"操作详情",
		"风险等级",
		"风险说明",
		"建议操作",
	}
	for _, element := range requiredElements {
		if !strings.Contains(result, element) {
			t.Errorf("审批请求应包含 '%s'，得到: %s", element, result)
		}
	}
}

func TestIsDangerousOperation(t *testing.T) {
	testCases := []struct {
		operation string
		expected  bool
	}{
		{"read file", false},
		{"delete file", true},
		{"rm -rf /", true},
		{"ls -la", false},
		{"sudo rm", true},
		{"git status", false},
		{"format disk", true},
		{"copy file", false},
	}

	for _, tc := range testCases {
		result := IsDangerousOperation(tc.operation)
		if result != tc.expected {
			t.Errorf("IsDangerousOperation('%s') = %v, 期望 %v", tc.operation, result, tc.expected)
		}
	}
}

func TestGetOperationRiskLevel(t *testing.T) {
	testCases := []struct {
		operation string
		details   string
	}{
		{"read", "读取文件"},
		{"delete", "删除文件"},
		{"rm", "删除系统文件"},
		{"install", "安装软件"},
		{"config", "修改配置"},
		{"copy", "复制文件"},
	}

	for _, tc := range testCases {
		level := GetOperationRiskLevel(tc.operation, tc.details)
		t.Logf("操作 '%s' (%s) 的风险等级: %s", tc.operation, tc.details, level)
	}
}

func TestHTMLToMarkdown(t *testing.T) {
	testCases := []struct {
		name     string
		html     string
		expected string
	}{
		{
			name:     "标题转换",
			html:     "<h1>标题1</h1><h2>标题2</h2>",
			expected: "# 标题1",
		},
		{
			name:     "段落转换",
			html:     "<p>这是一个段落。</p>",
			expected: "这是一个段落。",
		},
		{
			name:     "链接转换",
			html:     `<a href="https://example.com">链接文本</a>`,
			expected: "[链接文本](https://example.com)",
		},
		{
			name:     "代码转换",
			html:     "<code>code</code>",
			expected: "`code`",
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			result := htmlToMarkdown(tc.html)
			if !strings.Contains(result, tc.expected) {
				t.Errorf("期望包含 '%s'，得到: %s", tc.expected, result)
			}
		})
	}
}

func TestStripHTMLTags(t *testing.T) {
	testCases := []struct {
		input    string
		expected string
	}{
		{"<p>文本</p>", "文本"},
		{"<div><span>嵌套</span></div>", "嵌套"},
		{"纯文本", "纯文本"},
		{"<br>", ""},
	}

	for _, tc := range testCases {
		result := stripHTMLTags(tc.input)
		if result != tc.expected {
			t.Errorf("stripHTMLTags('%s') = '%s', 期望 '%s'", tc.input, result, tc.expected)
		}
	}
}

func TestLimitLines(t *testing.T) {
	input := "line1\nline2\nline3\nline4\nline5"
	result := limitLines(input, 3)
	if !strings.Contains(result, "line1") {
		t.Error("限制行数应保留前面的行")
	}
	if strings.Contains(result, "line5") {
		t.Error("限制行数应截断后面的行")
	}
	if !strings.Contains(result, "输出已截断") {
		t.Error("截断应显示提示信息")
	}
}

func TestLimitLength(t *testing.T) {
	input := "这是一个很长的文本内容，用于测试长度限制功能。"
	result := limitLength(input, 10)
	if len(result) <= 10 {
		t.Error("长度限制结果应包含截断提示")
	}
	if !strings.Contains(result, "内容已截断") {
		t.Error("截断应显示提示信息")
	}
}

func TestCleanWhitespace(t *testing.T) {
	input := "  line1  \n\n\n  line2  \n"
	result := cleanWhitespace(input)
	if strings.Contains(result, "  ") {
		t.Error("清理后不应有多余空格")
	}
	if strings.Contains(result, "\n\n\n") {
		t.Error("清理后不应有多余空行")
	}
}

func TestStripANSI(t *testing.T) {
	input := "\x1b[31m红色文本\x1b[0m"
	result := stripANSI(input)
	if strings.Contains(result, "\x1b[") {
		t.Error("应移除 ANSI 转义序列")
	}
	if !strings.Contains(result, "红色文本") {
		t.Error("应保留文本内容")
	}
}

func TestFormatGrepResult(t *testing.T) {
	input := "file.go:10:func main() {\nfile.go:20:    fmt.Println()\n"
	result := formatGrepResult(input)
	if !strings.Contains(result, "file.go:10:func main() {") {
		t.Error("应正确格式化 grep 结果")
	}
}

// TestGrepTool_InvalidPattern 测试无效搜索模式
func TestGrepTool_InvalidPattern(t *testing.T) {
	tool := NewGrepTool()

	// 空模式
	_, err := tool.Execute(map[string]interface{}{"pattern": ""})
	if err == nil {
		t.Error("空模式应返回错误")
	}

	// 缺少pattern参数
	_, err = tool.Execute(map[string]interface{}{})
	if err == nil {
		t.Error("缺少pattern应返回错误")
	}

	// pattern为非字符串类型
	_, err = tool.Execute(map[string]interface{}{"pattern": 123})
	if err == nil {
		t.Error("非字符串pattern应返回错误")
	}
}

// TestGrepTool_SpecialPattern 测试特殊搜索模式
func TestGrepTool_SpecialPattern(t *testing.T) {
	tool := NewGrepTool()

	// 搜索包含特殊字符的模式
	result, err := tool.Execute(map[string]interface{}{
		"pattern": "func Test",
		"path":    "../..",
		"include": "*_test.go",
	})

	// 即使出错也不应panic
	_ = result
	_ = err
}

// TestRTKTool_InvalidCommand 测试无效命令
func TestRTKTool_InvalidCommand(t *testing.T) {
	tool := NewRTKTool()

	// 空命令
	_, err := tool.Execute(map[string]interface{}{"command": ""})
	if err == nil {
		t.Error("空命令应返回错误")
	}

	// 缺少command
	_, err = tool.Execute(map[string]interface{}{})
	if err == nil {
		t.Error("缺少command应返回错误")
	}

	// 非字符串command
	_, err = tool.Execute(map[string]interface{}{"command": 123})
	if err == nil {
		t.Error("非字符串command应返回错误")
	}
}

// TestRTKTool_CommandNotFound 测试命令不存在
func TestRTKTool_CommandNotFound(t *testing.T) {
	tool := NewRTKTool()

	result, err := tool.Execute(map[string]interface{}{
		"command": "nonexistent_command_xyz",
	})

	// 应返回错误信息而不是panic
	if err == nil && result == "" {
		t.Error("不存在的命令应返回错误信息")
	}
}

// TestRTKTool_LongOutput 测试长输出截断
func TestRTKTool_LongOutput(t *testing.T) {
	tool := NewRTKTool()

	result, err := tool.Execute(map[string]interface{}{
		"command":  "seq 1 1000",
		"maxLines": 5,
	})
	if err != nil {
		t.Fatalf("执行命令失败: %v", err)
	}

	if !strings.Contains(result, "输出已截断") {
		t.Error("长输出应显示截断提示")
	}
}

// TestRTKTool_MaxLinesZero 测试maxLines为0
func TestRTKTool_MaxLinesZero(t *testing.T) {
	tool := NewRTKTool()

	result, err := tool.Execute(map[string]interface{}{
		"command":  "echo test",
		"maxLines": 0,
	})
	if err != nil {
		t.Fatalf("执行命令失败: %v", err)
	}

	if !strings.Contains(result, "输出已截断") {
		t.Error("maxLines为0时应截断所有输出")
	}
}

// TestWebFetchTool_InvalidURL 测试无效URL
func TestWebFetchTool_InvalidURL(t *testing.T) {
	tool := NewWebFetchTool()

	// 空URL
	_, err := tool.Execute(map[string]interface{}{"url": ""})
	if err == nil {
		t.Error("空URL应返回错误")
	}

	// 缺少url
	_, err = tool.Execute(map[string]interface{}{})
	if err == nil {
		t.Error("缺少url应返回错误")
	}

	// 非字符串url
	_, err = tool.Execute(map[string]interface{}{"url": 123})
	if err == nil {
		t.Error("非字符串url应返回错误")
	}
}

// TestWebFetchTool_MaxLength 测试最大长度限制
func TestWebFetchTool_MaxLength(t *testing.T) {
	tool := NewWebFetchTool()

	result, err := tool.Execute(map[string]interface{}{
		"url":       "example.com",
		"maxLength": 10,
	})

	// 即使出错也不应panic
	_ = result
	_ = err
}

// TestPermissionGuardTool_InvalidOperation 测试无效操作
func TestPermissionGuardTool_InvalidOperation(t *testing.T) {
	tool := NewPermissionGuardTool()

	// 空操作
	_, err := tool.Execute(map[string]interface{}{"operation": ""})
	if err == nil {
		t.Error("空操作应返回错误")
	}

	// 缺少operation
	_, err = tool.Execute(map[string]interface{}{})
	if err == nil {
		t.Error("缺少operation应返回错误")
	}
}

// TestPermissionGuardTool_RiskLevels 测试各种风险等级
func TestPermissionGuardTool_RiskLevels(t *testing.T) {
	tool := NewPermissionGuardTool()

	testCases := []struct {
		operation  string
		details    string
		shouldContain string
	}{
		{"read", "读取文件", "低风险"},
		{"write", "写入文件", "高风险"},
		{"delete", "删除文件", "高风险"},
		{"rm -rf", "删除系统目录", "严重风险"},
		{"sudo", "执行管理员命令", "高风险"},
		{"format", "格式化磁盘", "高风险"},
		{"chmod", "修改权限", "高风险"},
		{"mv", "移动文件", "低风险"},
		{"cp", "复制文件", "低风险"},
		{"mkdir", "创建目录", "高风险"},
	}

	for _, tc := range testCases {
		t.Run(tc.operation, func(t *testing.T) {
			result, err := tool.Execute(map[string]interface{}{
				"operation": tc.operation,
				"details":   tc.details,
			})
			if err != nil {
				t.Errorf("评估操作失败: %v", err)
				return
			}
			if !strings.Contains(result, tc.shouldContain) {
				t.Errorf("操作 '%s' 应包含 '%s'，得到: %s", tc.operation, tc.shouldContain, result)
			}
		})
	}
}

// TestPermissionGuardTool_CustomRiskLevel 测试自定义风险等级
func TestPermissionGuardTool_CustomRiskLevel(t *testing.T) {
	tool := NewPermissionGuardTool()

	testCases := []struct {
		riskLevel string
		expected  string
	}{
		{"low", "低风险"},
		{"medium", "中风险"},
		{"high", "高风险"},
		{"critical", "严重风险"},
	}

	for _, tc := range testCases {
		t.Run(tc.riskLevel, func(t *testing.T) {
			result, err := tool.Execute(map[string]interface{}{
				"operation": "custom",
				"details":   "自定义操作",
				"riskLevel": tc.riskLevel,
			})
			if err != nil {
				t.Errorf("评估失败: %v", err)
				return
			}
			if !strings.Contains(result, tc.expected) {
				t.Errorf("风险等级 '%s' 应包含 '%s'，得到: %s", tc.riskLevel, tc.expected, result)
			}
		})
	}
}

// TestHTMLToMarkdown_EdgeCases 测试HTML转Markdown边界情况
func TestHTMLToMarkdown_EdgeCases(t *testing.T) {
	testCases := []struct {
		name     string
		html     string
		expected string
	}{
		{
			name:     "空HTML",
			html:     "",
			expected: "",
		},
		{
			name:     "纯文本",
			html:     "纯文本内容",
			expected: "纯文本内容",
		},
		{
			name:     "嵌套标题",
			html:     "<h1><span>标题</span></h1>",
			expected: "# 标题",
		},
		{
			name:     "多个段落",
			html:     "<p>第一段</p><p>第二段</p>",
			expected: "第一段",
		},
		{
			name:     "无属性链接",
			html:     "<a>无链接</a>",
			expected: "无链接",
		},
		{
			name:     "空白HTML",
			html:     "   \n\t  ",
			expected: "",
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			result := htmlToMarkdown(tc.html)
			if tc.expected != "" && !strings.Contains(result, tc.expected) {
				t.Errorf("期望包含 '%s'，得到: '%s'", tc.expected, result)
			}
		})
	}
}

// TestStripHTMLTags_EdgeCases 测试HTML标签清理边界情况
func TestStripHTMLTags_EdgeCases(t *testing.T) {
	testCases := []struct {
		input    string
		expected string
	}{
		{"", ""},
		{"<>", "<>"},
		{"</>", ""},
		{"<a>", ""},
		{"<a href=\"test\">", ""},
		{"text<br>more", "textmore"},
		{"<div><p>nested</p></div>", "nested"},
		{"mixed <b>bold</b> text", "mixed bold text"},
	}

	for _, tc := range testCases {
		result := stripHTMLTags(tc.input)
		if result != tc.expected {
			t.Errorf("stripHTMLTags(%q) = %q, want %q", tc.input, result, tc.expected)
		}
	}
}

// TestLimitLines_EdgeCases 测试行数限制边界情况
func TestLimitLines_EdgeCases(t *testing.T) {
	// 空字符串
	result := limitLines("", 5)
	if result != "" {
		t.Error("空字符串应返回空")
	}

	// 单行
	result = limitLines("single line", 1)
	if !strings.Contains(result, "single line") {
		t.Error("单行应保留")
	}

	// 刚好达到限制
	input := "line1\nline2\nline3"
	result = limitLines(input, 3)
	if strings.Contains(result, "输出已截断") {
		t.Error("刚好达到限制不应截断")
	}

	// 超过限制1行
	result = limitLines(input, 2)
	if !strings.Contains(result, "输出已截断") {
		t.Error("超过限制应截断")
	}

	// 限制为负数
	result = limitLines(input, -1)
	// 实现可能不处理负数，只验证不panic
	_ = result
}

// TestLimitLength_EdgeCases 测试长度限制边界情况
func TestLimitLength_EdgeCases(t *testing.T) {
	// 空字符串
	result := limitLength("", 10)
	if result != "" {
		t.Error("空字符串应返回空")
	}

	// 刚好达到限制
	result = limitLength("1234567890", 10)
	if strings.Contains(result, "内容已截断") {
		t.Error("刚好达到限制不应截断")
	}

	// 超过限制
	result = limitLength("12345678901", 10)
	if !strings.Contains(result, "内容已截断") {
		t.Error("超过限制应截断")
	}

	// 限制为0
	result = limitLength("test", 0)
	if !strings.Contains(result, "内容已截断") {
		t.Error("限制为0应截断")
	}
}

// TestCleanWhitespace_EdgeCases 测试空白字符清理边界情况
func TestCleanWhitespace_EdgeCases(t *testing.T) {
	testCases := []struct {
		input    string
		expected string
	}{
		{"", ""},
		{"   ", ""},
		{"\n\n\n", ""},
		{"  a  ", "a"},
		{"a\n\n\nb", "a\n\nb"},
		{"\t\t\t", ""},
	}

	for _, tc := range testCases {
		result := cleanWhitespace(tc.input)
		if result != tc.expected {
			t.Errorf("cleanWhitespace(%q) = %q, want %q", tc.input, result, tc.expected)
		}
	}
}

// TestGetStringArg 测试字符串参数提取
func TestGetStringArg(t *testing.T) {
	// 正常情况
	val, ok := getStringArg(map[string]interface{}{"key": "value"}, "key")
	if !ok || val != "value" {
		t.Error("应正确提取字符串参数")
	}

	// 键不存在
	val, ok = getStringArg(map[string]interface{}{}, "key")
	if ok {
		t.Error("不存在的键应返回 false")
	}

	// 非字符串值
	val, ok = getStringArg(map[string]interface{}{"key": 123}, "key")
	if ok {
		t.Error("非字符串值应返回 false")
	}

	// nil值
	val, ok = getStringArg(map[string]interface{}{"key": nil}, "key")
	if ok {
		t.Error("nil值应返回 false")
	}
}

// TestIsDangerousOperation_EdgeCases 测试危险操作判断边界情况
func TestIsDangerousOperation_EdgeCases(t *testing.T) {
	testCases := []struct {
		operation string
		expected  bool
	}{
		{"", false},
		{"read", false},
		{"READ", false},
		{"Read File", false},
		{"delete", true},
		{"DELETE", true},
		{"rm", true},
		{"sudo", true},
		{"format", true},
		{"write", true},
		{"install", true},
		{"copy", false},
		{"move", false},
	}

	for _, tc := range testCases {
		result := IsDangerousOperation(tc.operation)
		if result != tc.expected {
			t.Errorf("IsDangerousOperation(%q) = %v, want %v", tc.operation, result, tc.expected)
		}
	}
}

// TestConvertHeaders 测试标题转换
func TestConvertHeaders(t *testing.T) {
	html := "<h1>标题1</h1><h2>标题2</h2><h3>标题3</h3><h4>标题4</h4><h5>标题5</h5><h6>标题6</h6>"
	var builder strings.Builder
	convertHeaders(html, &builder)
	result := builder.String()

	expected := []string{"# 标题1", "## 标题2", "### 标题3", "#### 标题4", "##### 标题5", "###### 标题6"}
	for _, exp := range expected {
		if !strings.Contains(result, exp) {
			t.Errorf("期望包含 '%s'，得到: %s", exp, result)
		}
	}
}

// TestConvertLists 测试列表转换
func TestConvertLists(t *testing.T) {
	html := "<ul><li>item1</li><li>item2</li></ul><ol><li>num1</li><li>num2</li></ol>"
	var builder strings.Builder
	result := convertLists(html, &builder)

	// 无序列表
	if !strings.Contains(result, "- item1") {
		t.Errorf("期望包含无序列表项，得到: %s", result)
	}

	// 有序列表
	if !strings.Contains(result, "1. num1") {
		t.Errorf("期望包含有序列表项，得到: %s", result)
	}
}

// BenchmarkFormatGrepResult 基准测试grep结果格式化
func BenchmarkFormatGrepResult(b *testing.B) {
	input := ""
	for i := 0; i < 100; i++ {
		input += fmt.Sprintf("file%d.go:%d:func main() {\n", i, i*10)
	}

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		formatGrepResult(input)
	}
}

// BenchmarkStripHTMLTags 基准测试HTML标签清理
func BenchmarkStripHTMLTags(b *testing.B) {
	html := "<div><p>这是一个包含<b>粗体</b>和<i>斜体</i>的段落。</p><a href=\"https://example.com\">链接</a></div>"

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		stripHTMLTags(html)
	}
}

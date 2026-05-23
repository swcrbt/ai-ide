package tools

import (
	"fmt"
	"os/exec"
	"runtime"
	"strings"
)

// GrepTool 基于 ripgrep 的代码搜索工具
type GrepTool struct{}

// NewGrepTool 创建新的 Grep 工具实例
func NewGrepTool() *GrepTool {
	return &GrepTool{}
}

// Name 返回工具名称
func (t *GrepTool) Name() string {
	return "grep_app"
}

// Description 返回工具描述
func (t *GrepTool) Description() string {
	return "基于 ripgrep 的代码搜索工具，支持在指定目录中搜索代码模式，返回匹配的文件路径、行号和内容"
}

// Execute 执行代码搜索
// 参数:
//   - pattern (string): 搜索模式（必需）
//   - path (string): 搜索路径，默认为当前目录
//   - include (string): 包含的文件模式，如 "*.go"
//   - exclude (string): 排除的文件模式，如 "*_test.go"
//
// 返回格式化的搜索结果：文件路径:行号:匹配内容
func (t *GrepTool) Execute(args map[string]interface{}) (string, error) {
	// 提取参数
	pattern, ok := getStringArg(args, "pattern")
	if !ok || pattern == "" {
		return "", fmt.Errorf("缺少必需参数 'pattern'")
	}

	path, _ := getStringArg(args, "path")
	if path == "" {
		path = "."
	}

	include, _ := getStringArg(args, "include")
	exclude, _ := getStringArg(args, "exclude")

	// 检查 ripgrep 是否可用
	if !isRipgrepAvailable() {
		return t.fallbackGrep(pattern, path, include, exclude)
	}

	return t.executeRipgrep(pattern, path, include, exclude)
}

// isRipgrepAvailable 检查 ripgrep 是否已安装
func isRipgrepAvailable() bool {
	cmd := exec.Command("rg", "--version")
	err := cmd.Run()
	return err == nil
}

// executeRipgrep 使用 ripgrep 执行搜索
func (t *GrepTool) executeRipgrep(pattern, path, include, exclude string) (string, error) {
	// 构建 ripgrep 命令参数
	args := []string{
		"--line-number",      // 显示行号
		"--no-heading",       // 不显示文件标题
		"--color", "never",   // 禁用颜色输出
		"--max-count", "50",  // 每个文件最多匹配 50 行
		"--max-columns", "200", // 每行最多 200 字符
		"--smart-case",       // 智能大小写匹配
	}

	// 添加包含过滤
	if include != "" {
		args = append(args, "--glob", include)
	}

	// 添加排除过滤
	if exclude != "" {
		args = append(args, "--glob", "!"+exclude)
	}

	// 添加搜索模式和路径
	args = append(args, pattern, path)

	// 执行 ripgrep
	cmd := exec.Command("rg", args...)
	output, err := cmd.CombinedOutput()

	// ripgrep 退出码 1 表示没有匹配，这不是错误
	if err != nil {
		exitErr, ok := err.(*exec.ExitError)
		if ok && exitErr.ExitCode() == 1 {
			return "未找到匹配结果", nil
		}
		return string(output), fmt.Errorf("ripgrep 执行失败: %w", err)
	}

	result := string(output)
	if result == "" {
		return "未找到匹配结果", nil
	}

	return formatGrepResult(result), nil
}

// fallbackGrep 当 ripgrep 不可用时使用系统 grep 作为回退
func (t *GrepTool) fallbackGrep(pattern, path, include, exclude string) (string, error) {
	// 检查系统 grep 是否可用
	grepCmd := "grep"
	if runtime.GOOS == "windows" {
		// Windows 可能没有 grep，尝试 findstr
		return t.fallbackFindstr(pattern, path, include, exclude)
	}

	// 构建 grep 命令
	args := []string{
		"-r",                       // 递归搜索
		"-n",                       // 显示行号
		"--include", include,       // 包含模式
		"-e", pattern,             // 搜索模式
		path,                       // 搜索路径
	}

	// 如果 include 为空，移除 --include 参数
	if include == "" {
		args = []string{"-r", "-n", "-e", pattern, path}
	}

	cmd := exec.Command(grepCmd, args...)
	output, err := cmd.CombinedOutput()

	// grep 退出码 1 表示没有匹配
	if err != nil {
		exitErr, ok := err.(*exec.ExitError)
		if ok && exitErr.ExitCode() == 1 {
			return "未找到匹配结果", nil
		}
		return string(output), fmt.Errorf("grep 执行失败: %w", err)
	}

	result := string(output)
	if result == "" {
		return "未找到匹配结果", nil
	}

	return formatGrepResult(result), nil
}

// fallbackFindstr Windows 系统使用 findstr 作为回退
func (t *GrepTool) fallbackFindstr(pattern, path, include, exclude string) (string, error) {
	args := []string{
		"/S",  // 递归搜索
		"/N",  // 显示行号
		"/I",  // 忽略大小写
	}

	if include != "" {
		args = append(args, "/P")
	}

	args = append(args, pattern, path)

	cmd := exec.Command("findstr", args...)
	output, err := cmd.CombinedOutput()

	if err != nil {
		exitErr, ok := err.(*exec.ExitError)
		if ok && exitErr.ExitCode() == 1 {
			return "未找到匹配结果", nil
		}
		return string(output), fmt.Errorf("findstr 执行失败: %w", err)
	}

	result := string(output)
	if result == "" {
		return "未找到匹配结果", nil
	}

	return formatGrepResult(result), nil
}

// formatGrepResult 格式化搜索结果
// 统一输出格式：文件路径:行号:匹配内容
func formatGrepResult(output string) string {
	lines := strings.Split(output, "\n")
	var result strings.Builder

	for _, line := range lines {
		line = strings.TrimSpace(line)
		if line == "" {
			continue
		}

		// ripgrep 输出格式: path:line:content
		// grep 输出格式: path:line:content
		// 统一处理
		parts := strings.SplitN(line, ":", 3)
		if len(parts) >= 3 {
			filePath := parts[0]
			lineNum := parts[1]
			content := parts[2]

			result.WriteString(fmt.Sprintf("%s:%s:%s\n", filePath, lineNum, strings.TrimSpace(content)))
		} else {
			result.WriteString(line + "\n")
		}
	}

	return strings.TrimSpace(result.String())
}

// getStringArg 从参数映射中获取字符串值
func getStringArg(args map[string]interface{}, key string) (string, bool) {
	val, ok := args[key]
	if !ok {
		return "", false
	}

	str, ok := val.(string)
	return str, ok
}

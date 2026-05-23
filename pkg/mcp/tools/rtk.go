package tools

import (
	"fmt"
	"os/exec"
	"regexp"
	"strings"
)

// RTKTool 命令输出优化工具 (Runtime Toolkit)
// 执行系统命令并智能优化输出，过滤无用信息
type RTKTool struct{}

// NewRTKTool 创建新的 RTK 工具实例
func NewRTKTool() *RTKTool {
	return &RTKTool{}
}

// Name 返回工具名称
func (t *RTKTool) Name() string {
	return "rtk"
}

// Description 返回工具描述
func (t *RTKTool) Description() string {
	return "命令输出优化工具，执行系统命令并智能过滤空行、重复行、进度条等无用信息，返回精简的输出结果"
}

// Execute 执行系统命令并优化输出
// 参数:
//   - command (string): 要执行的命令（必需）
//   - maxLines (int): 最大输出行数，默认 100
//   - workingDir (string): 工作目录，默认为当前目录
//
// 返回优化后的命令输出
func (t *RTKTool) Execute(args map[string]interface{}) (string, error) {
	// 提取命令参数
	command, ok := getStringArg(args, "command")
	if !ok || command == "" {
		return "", fmt.Errorf("缺少必需参数 'command'")
	}

	// 提取最大行数
	maxLines := 100
	if val, ok := args["maxLines"]; ok {
		switch v := val.(type) {
		case int:
			maxLines = v
		case float64:
			maxLines = int(v)
		case string:
			fmt.Sscanf(v, "%d", &maxLines)
		}
	}

	// 提取工作目录
	workingDir, _ := getStringArg(args, "workingDir")

	return t.executeCommand(command, maxLines, workingDir)
}

// executeCommand 执行命令并优化输出
func (t *RTKTool) executeCommand(command string, maxLines int, workingDir string) (string, error) {
	// 解析命令和参数
	cmdParts := parseCommand(command)
	if len(cmdParts) == 0 {
		return "", fmt.Errorf("无效的命令")
	}

	cmdName := cmdParts[0]
	cmdArgs := cmdParts[1:]

	// 创建命令
	cmd := exec.Command(cmdName, cmdArgs...)
	if workingDir != "" {
		cmd.Dir = workingDir
	}

	// 执行命令
	output, err := cmd.CombinedOutput()
	outputStr := string(output)

	// 某些命令即使返回错误也有有用的输出
	if err != nil && outputStr == "" {
		return "", fmt.Errorf("命令执行失败: %w", err)
	}

	// 根据命令类型应用特定的优化策略
	optimized := t.optimizeOutput(cmdName, cmdArgs, outputStr)

	// 限制输出行数
	optimized = limitLines(optimized, maxLines)

	if optimized == "" {
		return "[命令执行成功，但无有效输出]", nil
	}

	return optimized, nil
}

// parseCommand 解析命令字符串为命令和参数列表
// 支持简单的引号处理
func parseCommand(command string) []string {
	var parts []string
	var current strings.Builder
	inQuotes := false
	quoteChar := rune(0)

	for _, ch := range command {
		switch ch {
		case '"', '\'':
			if !inQuotes {
				inQuotes = true
				quoteChar = ch
			} else if ch == quoteChar {
				inQuotes = false
				quoteChar = 0
			} else {
				current.WriteRune(ch)
			}
		case ' ', '\t':
			if inQuotes {
				current.WriteRune(ch)
			} else {
				if current.Len() > 0 {
					parts = append(parts, current.String())
					current.Reset()
				}
			}
		default:
			current.WriteRune(ch)
		}
	}

	if current.Len() > 0 {
		parts = append(parts, current.String())
	}

	return parts
}

// optimizeOutput 根据命令类型优化输出
func (t *RTKTool) optimizeOutput(cmdName string, cmdArgs []string, output string) string {
	// 构建完整命令字符串用于判断
	fullCmd := cmdName
	for _, arg := range cmdArgs {
		fullCmd += " " + arg
	}

	// 根据命令类型应用不同的优化策略
	switch cmdName {
	case "git":
		return optimizeGitOutput(fullCmd, output)
	case "ls", "dir":
		return optimizeLsOutput(output)
	case "npm", "yarn", "pnpm":
		return optimizeNpmOutput(output)
	case "go":
		return optimizeGoOutput(fullCmd, output)
	case "docker":
		return optimizeDockerOutput(output)
	default:
		return optimizeGenericOutput(output)
	}
}

// optimizeGitOutput 优化 git 命令输出
func optimizeGitOutput(fullCmd, output string) string {
	lines := strings.Split(output, "\n")
	var result strings.Builder

	// git status 优化
	if strings.Contains(fullCmd, "status") {
		for _, line := range lines {
			line = strings.TrimSpace(line)
			// 保留重要信息，过滤提示信息
			if strings.Contains(line, "(use \"git") {
				continue
			}
			if line == "" {
				continue
			}
			result.WriteString(line + "\n")
		}
		return strings.TrimSpace(result.String())
	}

	// git log 优化
	if strings.Contains(fullCmd, "log") {
		return limitLines(output, 50)
	}

	// 其他 git 命令通用优化
	return optimizeGenericOutput(output)
}

// optimizeLsOutput 优化 ls/dir 命令输出
func optimizeLsOutput(output string) string {
	lines := strings.Split(output, "\n")
	var result strings.Builder

	for _, line := range lines {
		line = strings.TrimSpace(line)
		if line == "" || line == "." || line == ".." {
			continue
		}
		result.WriteString(line + "\n")
	}

	return strings.TrimSpace(result.String())
}

// optimizeNpmOutput 优化 npm/yarn/pnpm 输出
func optimizeNpmOutput(output string) string {
	lines := strings.Split(output, "\n")
	var result strings.Builder

	// 进度条相关正则
	progressPatterns := []*regexp.Regexp{
		regexp.MustCompile(`^\[.*\]\s*[/\\|\\-]+\s*.*$`),     // [===>] 进度条
		regexp.MustCompile(`^\s*\d+%\s*.*$`),                   // 百分比进度
		regexp.MustCompile(`^\s*⠋|⠙|⠹|⠸|⠼|⠴|⠦|⠧|⠇|⠏\s*.*$`), // spinner
	}

	for _, line := range lines {
		line = strings.TrimSpace(line)
		if line == "" {
			continue
		}

		// 过滤进度条
		skip := false
		for _, pattern := range progressPatterns {
			if pattern.MatchString(line) {
				skip = true
				break
			}
		}
		if skip {
			continue
		}

		// 过滤下载进度信息
		if strings.Contains(line, "downloading") && strings.Contains(line, "%") {
			continue
		}

		result.WriteString(line + "\n")
	}

	return strings.TrimSpace(result.String())
}

// optimizeGoOutput 优化 go 命令输出
func optimizeGoOutput(fullCmd, output string) string {
	// go test 优化
	if strings.Contains(fullCmd, "test") {
		lines := strings.Split(output, "\n")
		var result strings.Builder

		for _, line := range lines {
			line = strings.TrimSpace(line)
			// 保留测试结果摘要和失败信息
			if strings.HasPrefix(line, "PASS") || strings.HasPrefix(line, "FAIL") ||
				strings.HasPrefix(line, "ok") || strings.HasPrefix(line, "---") ||
				strings.Contains(line, "Error") || strings.Contains(line, "error") {
				result.WriteString(line + "\n")
				continue
			}
			// 过滤覆盖率详细行（保留汇总）
			if strings.Contains(line, "coverage:") && !strings.Contains(line, "of statements") {
				continue
			}
		}

		return strings.TrimSpace(result.String())
	}

	return optimizeGenericOutput(output)
}

// optimizeDockerOutput 优化 docker 命令输出
func optimizeDockerOutput(output string) string {
	lines := strings.Split(output, "\n")
	var result strings.Builder

	for _, line := range lines {
		line = strings.TrimSpace(line)
		if line == "" {
			continue
		}

		// 过滤拉取进度
		if strings.Contains(line, "Pulling from") || strings.Contains(line, "Pull complete") ||
			strings.Contains(line, "Already exists") || strings.Contains(line, "Downloading") && strings.Contains(line, "/") {
			continue
		}

		result.WriteString(line + "\n")
	}

	return strings.TrimSpace(result.String())
}

// optimizeGenericOutput 通用输出优化
func optimizeGenericOutput(output string) string {
	lines := strings.Split(output, "\n")
	var result strings.Builder
	lastLine := ""
	duplicateCount := 0

	for _, line := range lines {
		line = strings.TrimSpace(line)
		if line == "" {
			continue
		}

		// 过滤常见的进度条字符
		if isProgressBar(line) {
			continue
		}

		// 过滤 ANSI 转义序列（颜色代码等）
		line = stripANSI(line)

		// 合并连续重复行
		if line == lastLine {
			duplicateCount++
			if duplicateCount >= 3 {
				continue
			}
		} else {
			duplicateCount = 0
			lastLine = line
		}

		result.WriteString(line + "\n")
	}

	return strings.TrimSpace(result.String())
}

// isProgressBar 检测是否为进度条行
func isProgressBar(line string) bool {
	progressIndicators := []string{
		"▸", "▹", "▪", "▫", "◆", "◇", "●", "○",
		"█", "░", "▒", "▓",
	}

	for _, indicator := range progressIndicators {
		if strings.Contains(line, indicator) {
			return true
		}
	}

	return false
}

// stripANSI 去除 ANSI 转义序列
func stripANSI(input string) string {
	// ANSI 转义序列正则表达式
	ansiRegex := regexp.MustCompile(`\x1b\[[0-9;]*[a-zA-Z]`)
	return ansiRegex.ReplaceAllString(input, "")
}

// limitLines 限制输出行数
// 如果超过限制，截断并添加提示信息
func limitLines(output string, maxLines int) string {
	lines := strings.Split(output, "\n")
	if len(lines) <= maxLines {
		return output
	}

	var result strings.Builder
	for i := 0; i < maxLines; i++ {
		result.WriteString(lines[i] + "\n")
	}

	result.WriteString(fmt.Sprintf("\n... [输出已截断，共 %d 行，显示前 %d 行] ...", len(lines), maxLines))
	return result.String()
}

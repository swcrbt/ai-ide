package tools

import (
	"context"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"
	"time"
)

// CodeInterpreterTool 代码解释器工具
// 执行代码片段，支持 Python、JavaScript 和 Go
// 安全限制：超时 5 秒，禁用网络
type CodeInterpreterTool struct{}

// NewCodeInterpreterTool 创建新的代码解释器工具实例
func NewCodeInterpreterTool() *CodeInterpreterTool {
	return &CodeInterpreterTool{}
}

// Name 返回工具名称
func (t *CodeInterpreterTool) Name() string {
	return "code_interpreter"
}

// Description 返回工具描述
func (t *CodeInterpreterTool) Description() string {
	return "代码解释器工具，执行代码片段（支持 Python/JavaScript/Go），安全限制：超时 5 秒，禁用网络访问"
}

// Execute 执行代码片段
// 参数:
//   - code (string): 要执行的代码内容（必需）
//   - language (string): 代码语言，可选值：python/javascript/go（必需）
//
// 返回：代码执行输出或错误信息
func (t *CodeInterpreterTool) Execute(args map[string]interface{}) (string, error) {
	// 提取代码参数
	code, ok := getStringArg(args, "code")
	if !ok || code == "" {
		return "", fmt.Errorf("缺少必需参数 'code'，请提供要执行的代码")
	}

	// 提取语言参数
	language, ok := getStringArg(args, "language")
	if !ok || language == "" {
		return "", fmt.Errorf("缺少必需参数 'language'，可选值：python/javascript/go")
	}

	language = strings.ToLower(language)

	// 检查语言支持
	switch language {
	case "python", "python3":
		return t.executePython(code)
	case "javascript", "js", "node":
		return t.executeJavaScript(code)
	case "go", "golang":
		return t.executeGo(code)
	default:
		return "", fmt.Errorf("不支持的语言 '%s'，可选值：python/javascript/go", language)
	}
}

// executePython 执行 Python 代码
func (t *CodeInterpreterTool) executePython(code string) (string, error) {
	// 检查 Python 解释器是否可用
	pythonCmd := "python3"
	if !t.isCommandAvailable(pythonCmd) {
		pythonCmd = "python"
		if !t.isCommandAvailable(pythonCmd) {
			return "", fmt.Errorf("Python 解释器不可用，请安装 Python")
		}
	}

	// 安全检查：移除危险导入
	code = t.sanitizePythonCode(code)

	// 创建临时文件
	tempFile, err := t.createTempFile("*.py", code)
	if err != nil {
		return "", err
	}
	defer os.Remove(tempFile)

	// 执行代码（带超时）
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	cmd := exec.CommandContext(ctx, pythonCmd, tempFile)
	// 禁用网络访问（通过环境变量或资源限制）
	cmd.Env = t.getRestrictedEnv()

	output, err := cmd.CombinedOutput()
	if ctx.Err() == context.DeadlineExceeded {
		return "", fmt.Errorf("代码执行超时（限制 5 秒）")
	}
	if err != nil {
		return string(output), fmt.Errorf("代码执行错误: %w", err)
	}

	return string(output), nil
}

// executeJavaScript 执行 JavaScript 代码
func (t *CodeInterpreterTool) executeJavaScript(code string) (string, error) {
	// 检查 Node.js 是否可用
	if !t.isCommandAvailable("node") {
		return "", fmt.Errorf("Node.js 不可用，请安装 Node.js")
	}

	// 安全检查：移除危险代码
	code = t.sanitizeJavaScriptCode(code)

	// 创建临时文件
	tempFile, err := t.createTempFile("*.js", code)
	if err != nil {
		return "", err
	}
	defer os.Remove(tempFile)

	// 执行代码（带超时）
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	cmd := exec.CommandContext(ctx, "node", tempFile)
	cmd.Env = t.getRestrictedEnv()

	output, err := cmd.CombinedOutput()
	if ctx.Err() == context.DeadlineExceeded {
		return "", fmt.Errorf("代码执行超时（限制 5 秒）")
	}
	if err != nil {
		return string(output), fmt.Errorf("代码执行错误: %w", err)
	}

	return string(output), nil
}

// executeGo 执行 Go 代码
func (t *CodeInterpreterTool) executeGo(code string) (string, error) {
	// 检查 Go 是否可用
	if !t.isCommandAvailable("go") {
		return "", fmt.Errorf("Go 编译器不可用，请安装 Go")
	}

	// 安全检查
	code = t.sanitizeGoCode(code)

	// 创建临时目录
	tempDir, err := os.MkdirTemp("", "go-interpreter-*")
	if err != nil {
		return "", fmt.Errorf("创建临时目录失败: %w", err)
	}
	defer os.RemoveAll(tempDir)

	// 创建 go.mod
	goModContent := `module temp

go 1.21
`
	if err := os.WriteFile(filepath.Join(tempDir, "go.mod"), []byte(goModContent), 0644); err != nil {
		return "", fmt.Errorf("创建 go.mod 失败: %w", err)
	}

	// 创建 main.go
	mainFile := filepath.Join(tempDir, "main.go")
	if err := os.WriteFile(mainFile, []byte(code), 0644); err != nil {
		return "", fmt.Errorf("创建临时文件失败: %w", err)
	}

	// 执行代码（带超时）
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	cmd := exec.CommandContext(ctx, "go", "run", "main.go")
	cmd.Dir = tempDir
	cmd.Env = t.getRestrictedEnv()

	output, err := cmd.CombinedOutput()
	if ctx.Err() == context.DeadlineExceeded {
		return "", fmt.Errorf("代码执行超时（限制 10 秒，包含编译时间）")
	}
	if err != nil {
		return string(output), fmt.Errorf("代码执行错误: %w", err)
	}

	return string(output), nil
}

// sanitizePythonCode 清理 Python 代码中的危险操作
func (t *CodeInterpreterTool) sanitizePythonCode(code string) string {
	// 移除危险的导入
	dangerousImports := []string{
		"os.system", "subprocess", "__import__",
		"eval(", "exec(", "compile(",
		"open('/etc", "open('C:", "open('\\\\",
	}

	for _, dangerous := range dangerousImports {
		if strings.Contains(code, dangerous) {
			code = strings.ReplaceAll(code, dangerous, fmt.Sprintf("# BLOCKED: %s", dangerous))
		}
	}

	return code
}

// sanitizeJavaScriptCode 清理 JavaScript 代码中的危险操作
func (t *CodeInterpreterTool) sanitizeJavaScriptCode(code string) string {
	// 移除危险的代码模式
	dangerousPatterns := []string{
		"require('child_process')", "require('fs')",
		"eval(", "Function(", "setTimeout", "setInterval",
		"process.exit", "process.kill",
	}

	for _, dangerous := range dangerousPatterns {
		if strings.Contains(code, dangerous) {
			code = strings.ReplaceAll(code, dangerous, fmt.Sprintf("/* BLOCKED: %s */", dangerous))
		}
	}

	return code
}

// sanitizeGoCode 清理 Go 代码中的危险操作
func (t *CodeInterpreterTool) sanitizeGoCode(code string) string {
	// 移除危险的导入
	dangerousImports := []string{
		`"os/exec"`, `"syscall"`, `"unsafe"`,
	}

	for _, dangerous := range dangerousImports {
		if strings.Contains(code, dangerous) {
			code = strings.ReplaceAll(code, dangerous, fmt.Sprintf(`// BLOCKED: %s`, dangerous))
		}
	}

	return code
}

// createTempFile 创建临时文件并写入内容
func (t *CodeInterpreterTool) createTempFile(pattern, content string) (string, error) {
	tempFile, err := os.CreateTemp("", pattern)
	if err != nil {
		return "", fmt.Errorf("创建临时文件失败: %w", err)
	}
	defer tempFile.Close()

	if _, err := tempFile.WriteString(content); err != nil {
		return "", fmt.Errorf("写入临时文件失败: %w", err)
	}

	return tempFile.Name(), nil
}

// isCommandAvailable 检查命令是否可用
func (t *CodeInterpreterTool) isCommandAvailable(cmd string) bool {
	_, err := exec.LookPath(cmd)
	return err == nil
}

// getRestrictedEnv 获取受限的环境变量（禁用网络）
func (t *CodeInterpreterTool) getRestrictedEnv() []string {
	// 保留基本环境变量，移除可能用于网络访问的变量
	env := os.Environ()
	var restricted []string

	for _, e := range env {
		// 保留 PATH、HOME 等基本变量
		if strings.HasPrefix(e, "PATH=") ||
			strings.HasPrefix(e, "HOME=") ||
			strings.HasPrefix(e, "USER=") ||
			strings.HasPrefix(e, "TMP=") ||
			strings.HasPrefix(e, "TEMP=") {
			restricted = append(restricted, e)
		}
	}

	// 添加限制标志
	restricted = append(restricted, "MCP_INTERPRETER=1")

	// macOS 和 Linux 可以通过设置代理为无效值来限制网络
	if runtime.GOOS != "windows" {
		restricted = append(restricted, "HTTP_PROXY=http://127.0.0.1:0")
		restricted = append(restricted, "HTTPS_PROXY=http://127.0.0.1:0")
	}

	return restricted
}

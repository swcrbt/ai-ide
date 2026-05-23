package tools

import (
	"encoding/base64"
	"fmt"
	"os"
	"os/exec"
	"runtime"
	"strings"
	"time"
)

// ComputerUseTool 计算机控制工具
// 支持截图、点击和输入操作
// 风险评估：high
type ComputerUseTool struct{}

// NewComputerUseTool 创建新的计算机控制工具实例
func NewComputerUseTool() *ComputerUseTool {
	return &ComputerUseTool{}
}

// Name 返回工具名称
func (t *ComputerUseTool) Name() string {
	return "computer_use"
}

// Description 返回工具描述
func (t *ComputerUseTool) Description() string {
	return "计算机控制工具，支持截图、点击和输入操作。风险评估：high。仅限 macOS 系统使用。"
}

// Execute 执行计算机控制操作
// 参数:
//   - action (string): 操作类型，可选值：screenshot/click/type（必需）
//   - target (string): 目标元素或坐标（click/type 时必需）
//   - value (string): 输入值（type 时必需）
//
// screenshot: 使用 screencapture 截图，返回 base64 编码的图片
// click: 使用 osascript 控制 macOS Accessibility API 点击
// type: 使用 osascript 控制 macOS Accessibility API 输入文本
func (t *ComputerUseTool) Execute(args map[string]interface{}) (string, error) {
	// 检查操作系统（仅支持 macOS）
	if runtime.GOOS != "darwin" {
		return "", fmt.Errorf("computer_use 工具仅支持 macOS 系统")
	}

	// 提取 action 参数
	action, ok := getStringArg(args, "action")
	if !ok || action == "" {
		return "", fmt.Errorf("缺少必需参数 'action'，可选值：screenshot/click/type")
	}

	action = strings.ToLower(action)

	switch action {
	case "screenshot":
		return t.executeScreenshot(args)
	case "click":
		return t.executeClick(args)
	case "type":
		return t.executeType(args)
	default:
		return "", fmt.Errorf("不支持的操作类型 '%s'，可选值：screenshot/click/type", action)
	}
}

// executeScreenshot 执行截图操作
func (t *ComputerUseTool) executeScreenshot(args map[string]interface{}) (string, error) {
	// 创建临时文件保存截图
	tempFile := fmt.Sprintf("/tmp/mcp_screenshot_%d.png", time.Now().Unix())
	defer os.Remove(tempFile)

	// 使用 screencapture 命令截图
	cmd := exec.Command("screencapture", "-x", tempFile)
	output, err := cmd.CombinedOutput()
	if err != nil {
		return "", fmt.Errorf("截图失败: %w (输出: %s)", err, string(output))
	}

	// 读取截图文件
	data, err := os.ReadFile(tempFile)
	if err != nil {
		return "", fmt.Errorf("读取截图文件失败: %w", err)
	}

	// 编码为 base64
	base64Str := base64.StdEncoding.EncodeToString(data)

	return fmt.Sprintf("data:image/png;base64,%s", base64Str), nil
}

// executeClick 执行点击操作
func (t *ComputerUseTool) executeClick(args map[string]interface{}) (string, error) {
	target, ok := getStringArg(args, "target")
	if !ok || target == "" {
		return "", fmt.Errorf("click 操作需要 'target' 参数（元素名称或坐标）")
	}

	// 尝试解析为坐标 (x,y)
	var x, y int
	if _, err := fmt.Sscanf(target, "%d,%d", &x, &y); err == nil {
		// 使用坐标点击
		script := fmt.Sprintf(`
			tell application "System Events"
				key code 53 -- 先按 Escape 确保没有焦点问题
				delay 0.5
			end tell
			tell application "System Events"
				click at {%d, %d}
			end tell
		`, x, y)

		cmd := exec.Command("osascript", "-e", script)
		output, err := cmd.CombinedOutput()
		if err != nil {
			return "", fmt.Errorf("坐标点击失败: %w (输出: %s)", err, string(output))
		}
		return fmt.Sprintf("已在坐标 (%d, %d) 执行点击", x, y), nil
	}

	// 使用元素名称点击
	script := fmt.Sprintf(`
		tell application "System Events"
			click UI element "%s" of application process "Finder"
		end tell
	`, target)

	cmd := exec.Command("osascript", "-e", script)
	output, err := cmd.CombinedOutput()
	if err != nil {
		return "", fmt.Errorf("元素点击失败: %w (输出: %s)", err, string(output))
	}

	return fmt.Sprintf("已点击元素 '%s'", target), nil
}

// executeType 执行输入操作
func (t *ComputerUseTool) executeType(args map[string]interface{}) (string, error) {
	target, hasTarget := getStringArg(args, "target")
	value, ok := getStringArg(args, "value")
	if !ok || value == "" {
		return "", fmt.Errorf("type 操作需要 'value' 参数（要输入的文本）")
	}

	var script string
	if hasTarget && target != "" {
		// 先点击目标元素，再输入文本
		script = fmt.Sprintf(`
			tell application "System Events"
				click UI element "%s" of application process "Finder"
				delay 0.3
				keystroke "%s"
			end tell
		`, target, escapeAppleScript(value))
	} else {
		// 直接输入文本到当前焦点
		script = fmt.Sprintf(`
			tell application "System Events"
				keystroke "%s"
			end tell
		`, escapeAppleScript(value))
	}

	cmd := exec.Command("osascript", "-e", script)
	output, err := cmd.CombinedOutput()
	if err != nil {
		return "", fmt.Errorf("输入失败: %w (输出: %s)", err, string(output))
	}

	if hasTarget && target != "" {
		return fmt.Sprintf("已在元素 '%s' 输入文本", target), nil
	}
	return "已向当前焦点输入文本", nil
}

// escapeAppleScript 转义 AppleScript 字符串中的特殊字符
func escapeAppleScript(input string) string {
	// 转义双引号和反斜杠
	input = strings.ReplaceAll(input, `\`, `\\`)
	input = strings.ReplaceAll(input, `"`, `\"`)
	return input
}

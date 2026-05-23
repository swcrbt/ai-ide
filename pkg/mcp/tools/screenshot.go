package tools

import (
	"encoding/base64"
	"fmt"
	"os"
	"os/exec"
	"runtime"
	"time"
)

// ScreenshotTool 屏幕截图工具
// 支持全屏、窗口和选择区域截图
type ScreenshotTool struct{}

// NewScreenshotTool 创建新的屏幕截图工具实例
func NewScreenshotTool() *ScreenshotTool {
	return &ScreenshotTool{}
}

// Name 返回工具名称
func (t *ScreenshotTool) Name() string {
	return "screenshot"
}

// Description 返回工具描述
func (t *ScreenshotTool) Description() string {
	return "屏幕截图工具，支持全屏、窗口和选择区域截图，返回 base64 编码的图片。仅限 macOS 系统使用。"
}

// Execute 执行截图操作
// 参数:
//   - area (string): 截图区域类型，可选值：full/window/selection，默认为 full
//
// full: 截取整个屏幕
// window: 截取当前活动窗口
// selection: 截取用户选择的区域（需要交互）
//
// 返回：base64 编码的图片
func (t *ScreenshotTool) Execute(args map[string]interface{}) (string, error) {
	// 检查操作系统（仅支持 macOS）
	if runtime.GOOS != "darwin" {
		return "", fmt.Errorf("screenshot 工具仅支持 macOS 系统")
	}

	// 检查 screencapture 命令是否可用
	if !t.isScreencaptureAvailable() {
		return "", fmt.Errorf("screencapture 命令不可用，请确认系统支持")
	}

	// 提取 area 参数
	area, _ := getStringArg(args, "area")
	if area == "" {
		area = "full"
	}

	// 创建临时文件
	tempFile := fmt.Sprintf("/tmp/mcp_screenshot_%d.png", time.Now().Unix())
	defer os.Remove(tempFile)

	var cmdArgs []string

	switch area {
	case "full":
		// 截取整个屏幕（静默模式，不播放声音）
		cmdArgs = []string{"-x", tempFile}
	case "window":
		// 截取当前活动窗口
		cmdArgs = []string{"-x", "-w", tempFile}
	case "selection":
		// 截取选择区域（交互式，无法静默）
		cmdArgs = []string{"-i", tempFile}
	default:
		return "", fmt.Errorf("不支持的截图区域 '%s'，可选值：full/window/selection", area)
	}

	// 执行截图命令
	cmd := exec.Command("screencapture", cmdArgs...)
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

// isScreencaptureAvailable 检查 screencapture 命令是否可用
func (t *ScreenshotTool) isScreencaptureAvailable() bool {
	cmd := exec.Command("which", "screencapture")
	err := cmd.Run()
	return err == nil
}

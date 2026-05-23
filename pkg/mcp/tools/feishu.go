package tools

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"
)

// FeishuIMTool 飞书 IM 工具
// 发送消息到飞书 webhook，支持文本和 markdown 格式
type FeishuIMTool struct {
	httpClient *http.Client
}

// NewFeishuIMTool 创建新的飞书 IM 工具实例
func NewFeishuIMTool() *FeishuIMTool {
	return &FeishuIMTool{
		httpClient: &http.Client{
			Timeout: 10 * time.Second,
		},
	}
}

// Name 返回工具名称
func (t *FeishuIMTool) Name() string {
	return "feishu_im"
}

// Description 返回工具描述
func (t *FeishuIMTool) Description() string {
	return "飞书消息工具，发送消息到飞书 webhook，支持文本和 markdown 格式，返回发送状态"
}

// Execute 发送飞书消息
// 参数:
//   - webhook (string): 飞书 webhook URL（必需）
//   - message (string): 消息内容（必需）
//   - msg_type (string): 消息类型，可选值：text/markdown，默认为 text
//   - title (string): 消息标题（markdown 类型时可用）
//
// 返回：发送状态
func (t *FeishuIMTool) Execute(args map[string]interface{}) (string, error) {
	// 提取 webhook 参数
	webhook, ok := getStringArg(args, "webhook")
	if !ok || webhook == "" {
		return "", fmt.Errorf("缺少必需参数 'webhook'，请提供飞书 webhook URL")
	}

	// 验证 webhook URL 格式
	if !strings.HasPrefix(webhook, "https://open.feishu.cn/") {
		return "", fmt.Errorf("无效的飞书 webhook URL，格式应为 https://open.feishu.cn/open-apis/bot/v2/hook/xxx")
	}

	// 提取消息内容
	message, ok := getStringArg(args, "message")
	if !ok || message == "" {
		return "", fmt.Errorf("缺少必需参数 'message'，请提供消息内容")
	}

	// 提取消息类型
	msgType, _ := getStringArg(args, "msg_type")
	if msgType == "" {
		msgType = "text"
	}
	msgType = strings.ToLower(msgType)

	// 提取标题（可选）
	title, _ := getStringArg(args, "title")

	// 根据消息类型构建请求体
	var requestBody map[string]interface{}

	switch msgType {
	case "text":
		requestBody = t.buildTextMessage(message)
	case "markdown":
		requestBody = t.buildMarkdownMessage(message, title)
	default:
		return "", fmt.Errorf("不支持的消息类型 '%s'，可选值：text/markdown", msgType)
	}

	// 发送请求
	return t.sendMessage(webhook, requestBody)
}

// buildTextMessage 构建文本消息体
func (t *FeishuIMTool) buildTextMessage(content string) map[string]interface{} {
	return map[string]interface{}{
		"msg_type": "text",
		"content": map[string]string{
			"text": content,
		},
	}
}

// buildMarkdownMessage 构建 Markdown 消息体
func (t *FeishuIMTool) buildMarkdownMessage(content, title string) map[string]interface{} {
	// 如果提供了标题，将其添加到内容前面
	if title != "" {
		content = fmt.Sprintf("# %s\n\n%s", title, content)
	}

	return map[string]interface{}{
		"msg_type": "interactive",
		"card": map[string]interface{}{
			"config": map[string]interface{}{
				"wide_screen_mode": true,
			},
			"header": map[string]interface{}{
				"title": map[string]interface{}{
					"tag":     "plain_text",
					"content": title,
				},
			},
			"elements": []map[string]interface{}{
				{
					"tag":  "div",
					"text": map[string]interface{}{
						"tag":     "lark_md",
						"content": content,
					},
				},
			},
		},
	}
}

// sendMessage 发送消息到飞书 webhook
func (t *FeishuIMTool) sendMessage(webhook string, body map[string]interface{}) (string, error) {
	// 序列化请求体
	jsonBody, err := json.Marshal(body)
	if err != nil {
		return "", fmt.Errorf("序列化请求体失败: %w", err)
	}

	// 创建 HTTP 请求
	req, err := http.NewRequest("POST", webhook, bytes.NewBuffer(jsonBody))
	if err != nil {
		return "", fmt.Errorf("创建请求失败: %w", err)
	}

	// 设置请求头
	req.Header.Set("Content-Type", "application/json")

	// 发送请求
	resp, err := t.httpClient.Do(req)
	if err != nil {
		return "", fmt.Errorf("发送请求失败: %w", err)
	}
	defer resp.Body.Close()

	// 解析响应
	var response struct {
		Code int    `json:"code"`
		Msg  string `json:"msg"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&response); err != nil {
		return "", fmt.Errorf("解析响应失败: %w", err)
	}

	// 构建返回结果
	var builder strings.Builder
	builder.WriteString("飞书消息发送结果\n")
	builder.WriteString(strings.Repeat("=", 40) + "\n\n")

	if response.Code == 0 {
		builder.WriteString("状态: 发送成功\n")
	} else {
		builder.WriteString(fmt.Sprintf("状态: 发送失败 (错误码: %d)\n", response.Code))
	}

	if response.Msg != "" {
		builder.WriteString(fmt.Sprintf("消息: %s\n", response.Msg))
	}

	builder.WriteString(fmt.Sprintf("HTTP 状态码: %d\n", resp.StatusCode))

	return builder.String(), nil
}

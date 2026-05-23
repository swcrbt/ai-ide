package ai

import (
	"bufio"
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"
)

const (
	// defaultTimeout 默认请求超时时间
	defaultTimeout = 60 * time.Second
	// maxRetries 最大重试次数
	maxRetries = 3
	// retryDelay 重试间隔
	retryDelay = 1 * time.Second
)

// AIClient AI HTTP 客户端
type AIClient struct {
	httpClient *http.Client
	config     *ProviderConfig
}

// NewAIClient 创建新的 AI 客户端
func NewAIClient(config *ProviderConfig) *AIClient {
	return &AIClient{
		httpClient: &http.Client{
			Timeout: defaultTimeout,
		},
		config: config,
	}
}

// SetTimeout 设置请求超时时间
func (c *AIClient) SetTimeout(timeout time.Duration) {
	c.httpClient.Timeout = timeout
}

// GetConfig 获取当前客户端配置
func (c *AIClient) GetConfig() *ProviderConfig {
	return c.config
}

// buildChatCompletionURL 构建聊天补全 API 地址
func (c *AIClient) buildChatCompletionURL() string {
	return fmt.Sprintf("%s/chat/completions", strings.TrimRight(c.config.BaseURL, "/"))
}

// buildHeaders 构建请求头
func (c *AIClient) buildHeaders() http.Header {
	headers := http.Header{}
	headers.Set("Content-Type", "application/json")
	headers.Set("Authorization", fmt.Sprintf("Bearer %s", c.config.APIKey))
	headers.Set("Accept", "text/event-stream")
	return headers
}

// ChatCompletion 发送流式聊天请求，返回 SSE 数据流通道
func (c *AIClient) ChatCompletion(ctx context.Context, req ChatRequest) (<-chan StreamChunk, error) {
	// 设置模型
	if req.Model == "" {
		req.Model = c.config.Model
	}
	req.Stream = true

	// 构建请求体
	body, err := json.Marshal(req)
	if err != nil {
		return nil, fmt.Errorf("序列化请求失败: %w", err)
	}

	// 创建 HTTP 请求
	httpReq, err := http.NewRequestWithContext(ctx, http.MethodPost, c.buildChatCompletionURL(), bytes.NewReader(body))
	if err != nil {
		return nil, fmt.Errorf("创建请求失败: %w", err)
	}
	httpReq.Header = c.buildHeaders()

	// 发送请求（带重试）
	resp, err := c.doWithRetry(httpReq)
	if err != nil {
		return nil, err
	}

	// 检查响应状态码
	if resp.StatusCode != http.StatusOK {
		bodyBytes, _ := io.ReadAll(resp.Body)
		resp.Body.Close()
		return nil, fmt.Errorf("API 请求失败: status=%d, body=%s", resp.StatusCode, string(bodyBytes))
	}

	// 解析 SSE 流
	return c.parseSSEStream(ctx, resp.Body), nil
}

// doWithRetry 带重试机制的请求发送
func (c *AIClient) doWithRetry(req *http.Request) (*http.Response, error) {
	var lastErr error

	for attempt := 0; attempt < maxRetries; attempt++ {
		if attempt > 0 {
			time.Sleep(retryDelay * time.Duration(attempt))
		}

		resp, err := c.httpClient.Do(req)
		if err != nil {
			lastErr = err
			// 检查是否为可重试错误
			if isRetryableError(err) {
				continue
			}
			return nil, fmt.Errorf("请求失败: %w", err)
		}

		// 5xx 错误可重试
		if resp.StatusCode >= 500 {
			lastErr = fmt.Errorf("服务器错误: status=%d", resp.StatusCode)
			resp.Body.Close()
			continue
		}

		return resp, nil
	}

	return nil, fmt.Errorf("请求重试 %d 次后仍然失败: %w", maxRetries, lastErr)
}

// isRetryableError 判断错误是否可重试
func isRetryableError(err error) bool {
	if err == nil {
		return false
	}
	errStr := err.Error()
	// 网络超时、连接错误等可重试
	retryable := []string{
		"timeout",
		"connection refused",
		"no such host",
		"temporary",
		"eof",
	}
	for _, keyword := range retryable {
		if strings.Contains(strings.ToLower(errStr), keyword) {
			return true
		}
	}
	return false
}

// parseSSEStream 解析 SSE 流式响应
func (c *AIClient) parseSSEStream(ctx context.Context, body io.ReadCloser) <-chan StreamChunk {
	chunkChan := make(chan StreamChunk, 10)

	go func() {
		defer close(chunkChan)
		defer body.Close()

		reader := bufio.NewReader(body)
		var currentData strings.Builder

		for {
			select {
			case <-ctx.Done():
				chunkChan <- StreamChunk{Error: ctx.Err()}
				return
			default:
			}

			line, err := reader.ReadString('\n')
			if err != nil {
				if err == io.EOF {
					// 处理最后未发送的数据
					if currentData.Len() > 0 {
						c.processSSEData(currentData.String(), chunkChan)
					}
					chunkChan <- StreamChunk{Done: true}
					return
				}
				chunkChan <- StreamChunk{Error: fmt.Errorf("读取 SSE 流失败: %w", err)}
				return
			}

			line = strings.TrimRight(line, "\n\r")

			// 空行表示一个 SSE 事件结束
			if line == "" {
				if currentData.Len() > 0 {
					c.processSSEData(currentData.String(), chunkChan)
					currentData.Reset()
				}
				continue
			}

			// 解析 SSE 字段
			if strings.HasPrefix(line, "data: ") {
				data := strings.TrimPrefix(line, "data: ")
				if currentData.Len() > 0 {
					currentData.WriteString("\n")
				}
				currentData.WriteString(data)
			}
			// 忽略其他字段（event:, id: 等）
		}
	}()

	return chunkChan
}

// processSSEData 处理 SSE 数据块
func (c *AIClient) processSSEData(data string, chunkChan chan<- StreamChunk) {
	// 检查是否为结束标记
	if strings.TrimSpace(data) == "[DONE]" {
		chunkChan <- StreamChunk{Done: true}
		return
	}

	// 解析 JSON 数据
	var chunk ChatResponseChunk
	if err := json.Unmarshal([]byte(data), &chunk); err != nil {
		chunkChan <- StreamChunk{Error: fmt.Errorf("解析 SSE 数据失败: %w", err)}
		return
	}

	// 检查是否有错误
	if len(chunk.Choices) == 0 {
		return
	}

	// 提取内容增量
	for _, choice := range chunk.Choices {
		if choice.Delta.Content != "" {
			chunkChan <- StreamChunk{Content: choice.Delta.Content}
		}
		if choice.FinishReason != nil && *choice.FinishReason != "" {
			chunkChan <- StreamChunk{Done: true}
		}
	}
}

// ChatCompletionSync 发送非流式聊天请求
func (c *AIClient) ChatCompletionSync(ctx context.Context, req ChatRequest) (*ChatCompletionResponse, error) {
	if req.Model == "" {
		req.Model = c.config.Model
	}
	req.Stream = false

	body, err := json.Marshal(req)
	if err != nil {
		return nil, fmt.Errorf("序列化请求失败: %w", err)
	}

	httpReq, err := http.NewRequestWithContext(ctx, http.MethodPost, c.buildChatCompletionURL(), bytes.NewReader(body))
	if err != nil {
		return nil, fmt.Errorf("创建请求失败: %w", err)
	}

	headers := c.buildHeaders()
	headers.Set("Accept", "application/json")
	httpReq.Header = headers

	resp, err := c.doWithRetry(httpReq)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		bodyBytes, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("API 请求失败: status=%d, body=%s", resp.StatusCode, string(bodyBytes))
	}

	var result ChatCompletionResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("解析响应失败: %w", err)
	}

	return &result, nil
}

// ValidateConnection 验证与 Provider 的连接是否可用
func (c *AIClient) ValidateConnection(ctx context.Context) error {
	// 构建一个简单的请求来验证连接
	req := ChatRequest{
		Model:    c.config.Model,
		Messages: []Message{{Role: RoleSystem, Content: "test"}},
		Stream:   false,
		MaxTokens: 1,
	}

	_, err := c.ChatCompletionSync(ctx, req)
	return err
}

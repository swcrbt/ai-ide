package ai

import "fmt"

// Provider AI Provider 枚举类型
type Provider int

const (
	// ProviderKimi 月之暗面 Kimi
	ProviderKimi Provider = iota
	// ProviderGLM 智谱 GLM
	ProviderGLM
	// ProviderDeepSeek DeepSeek
	ProviderDeepSeek
	// ProviderAnthropic Anthropic Claude
	ProviderAnthropic
	// ProviderOpenAI OpenAI
	ProviderOpenAI
	// ProviderOllama Ollama 本地模型
	ProviderOllama
)

// String 返回 Provider 的字符串表示
func (p Provider) String() string {
	switch p {
	case ProviderKimi:
		return "kimi"
	case ProviderGLM:
		return "glm"
	case ProviderDeepSeek:
		return "deepseek"
	case ProviderAnthropic:
		return "anthropic"
	case ProviderOpenAI:
		return "openai"
	case ProviderOllama:
		return "ollama"
	default:
		return "unknown"
	}
}

// ProviderFromString 从字符串解析 Provider
func ProviderFromString(s string) (Provider, error) {
	switch s {
	case "kimi":
		return ProviderKimi, nil
	case "glm":
		return ProviderGLM, nil
	case "deepseek":
		return ProviderDeepSeek, nil
	case "anthropic":
		return ProviderAnthropic, nil
	case "openai":
		return ProviderOpenAI, nil
	case "ollama":
		return ProviderOllama, nil
	default:
		return ProviderOpenAI, fmt.Errorf("未知的 Provider: %s", s)
	}
}

// MessageRole 消息角色类型
type MessageRole string

const (
	// RoleSystem 系统角色
	RoleSystem MessageRole = "system"
	// RoleUser 用户角色
	RoleUser MessageRole = "user"
	// RoleAssistant 助手角色
	RoleAssistant MessageRole = "assistant"
)

// Message 对话消息结构体
type Message struct {
	// Role 消息角色
	Role MessageRole `json:"role"`
	// Content 消息内容
	Content string `json:"content"`
}

// ChatRequest 聊天请求结构体
type ChatRequest struct {
	// Model 使用的模型名称
	Model string `json:"model"`
	// Messages 对话历史消息列表
	Messages []Message `json:"messages"`
	// Stream 是否使用流式响应
	Stream bool `json:"stream"`
	// Temperature 采样温度
	Temperature float64 `json:"temperature,omitempty"`
	// MaxTokens 最大生成 token 数
	MaxTokens int `json:"max_tokens,omitempty"`
}

// ChatResponseChunk 流式响应数据块
type ChatResponseChunk struct {
	// ID 响应唯一标识
	ID string `json:"id"`
	// Object 对象类型
	Object string `json:"object"`
	// Created 创建时间戳
	Created int64 `json:"created"`
	// Model 使用的模型
	Model string `json:"model"`
	// Choices 生成选项列表
	Choices []ChunkChoice `json:"choices"`
}

// ChunkChoice 数据块中的选项
type ChunkChoice struct {
	// Index 选项索引
	Index int `json:"index"`
	// Delta 增量内容
	Delta DeltaContent `json:"delta"`
	// FinishReason 结束原因
	FinishReason *string `json:"finish_reason"`
}

// DeltaContent 增量内容结构体
type DeltaContent struct {
	// Role 角色（仅在第一条消息中出现）
	Role string `json:"role,omitempty"`
	// Content 内容增量
	Content string `json:"content,omitempty"`
}

// ProviderConfig Provider 配置结构体
type ProviderConfig struct {
	// Provider Provider 类型
	Provider Provider `json:"provider"`
	// APIKey API 密钥
	APIKey string `json:"api_key"`
	// BaseURL API 基础地址
	BaseURL string `json:"base_url"`
	// Model 默认模型名称
	Model string `json:"model"`
	// Enabled 是否启用
	Enabled bool `json:"enabled"`
	// Priority 优先级（数字越小优先级越高，用于国产优先策略）
	Priority int `json:"priority"`
}

// StreamChunk 流式输出数据块（对外暴露的简化结构）
type StreamChunk struct {
	// Content 文本内容增量
	Content string
	// Done 是否结束
	Done bool
	// Error 错误信息（如果有）
	Error error
}

// ChatSessionInfo 会话信息结构体
type ChatSessionInfo struct {
	// ID 会话唯一标识
	ID string `json:"id"`
	// Title 会话标题
	Title string `json:"title"`
	// Provider 使用的 Provider
	Provider string `json:"provider"`
	// Model 使用的模型
	Model string `json:"model"`
	// CreatedAt 创建时间
	CreatedAt string `json:"created_at"`
	// UpdatedAt 更新时间
	UpdatedAt string `json:"updated_at"`
}

// ConversationRecord 数据库中的对话记录
type ConversationRecord struct {
	// ID 记录唯一标识
	ID int64 `json:"id"`
	// SessionID 所属会话ID
	SessionID string `json:"session_id"`
	// Role 消息角色
	Role string `json:"role"`
	// Content 消息内容
	Content string `json:"content"`
	// Provider 使用的 Provider
	Provider string `json:"provider"`
	// CreatedAt 创建时间
	CreatedAt string `json:"created_at"`
}

// ChatCompletionResponse 非流式完整响应
type ChatCompletionResponse struct {
	// ID 响应唯一标识
	ID string `json:"id"`
	// Object 对象类型
	Object string `json:"object"`
	// Created 创建时间戳
	Created int64 `json:"created"`
	// Model 使用的模型
	Model string `json:"model"`
	// Choices 生成选项列表
	Choices []CompletionChoice `json:"choices"`
	// Usage Token 使用量
	Usage TokenUsage `json:"usage"`
}

// CompletionChoice 完整响应选项
type CompletionChoice struct {
	// Index 选项索引
	Index int `json:"index"`
	// Message 完整消息
	Message Message `json:"message"`
	// FinishReason 结束原因
	FinishReason string `json:"finish_reason"`
}

// TokenUsage Token 使用量统计
type TokenUsage struct {
	// PromptTokens 提示 token 数
	PromptTokens int `json:"prompt_tokens"`
	// CompletionTokens 生成 token 数
	CompletionTokens int `json:"completion_tokens"`
	// TotalTokens 总 token 数
	TotalTokens int `json:"total_tokens"`
}

package mcp

import (
	"fmt"
	"strings"
	"sync"
)

// Tool MCP 工具接口
// 所有 MCP 工具必须实现此接口
type Tool interface {
	// Name 返回工具名称
	Name() string
	// Description 返回工具描述
	Description() string
	// Execute 执行工具，接收参数映射，返回结果字符串或错误
	Execute(args map[string]interface{}) (string, error)
}

// ToolRegistry MCP 工具注册表
// 管理所有已注册的工具，提供注册、查找和列出功能
type ToolRegistry struct {
	mu    sync.RWMutex
	tools map[string]Tool
}

// NewToolRegistry 创建新的工具注册表
func NewToolRegistry() *ToolRegistry {
	return &ToolRegistry{
		tools: make(map[string]Tool),
	}
}

// Register 注册一个工具
// 如果工具名称已存在，返回错误
func (r *ToolRegistry) Register(tool Tool) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	name := tool.Name()
	if _, exists := r.tools[name]; exists {
		return fmt.Errorf("工具 '%s' 已注册", name)
	}

	r.tools[name] = tool
	return nil
}

// Unregister 注销一个工具
func (r *ToolRegistry) Unregister(name string) {
	r.mu.Lock()
	defer r.mu.Unlock()

	delete(r.tools, name)
}

// Get 根据名称获取工具
// 如果工具不存在，返回错误
func (r *ToolRegistry) Get(name string) (Tool, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()

	tool, exists := r.tools[name]
	if !exists {
		return nil, fmt.Errorf("工具 '%s' 未找到", name)
	}

	return tool, nil
}

// List 列出所有已注册的工具名称
func (r *ToolRegistry) List() []string {
	r.mu.RLock()
	defer r.mu.RUnlock()

	names := make([]string, 0, len(r.tools))
	for name := range r.tools {
		names = append(names, name)
	}

	return names
}

// ListWithDescription 列出所有工具及其描述
// 返回格式：名称 - 描述
func (r *ToolRegistry) ListWithDescription() []string {
	r.mu.RLock()
	defer r.mu.RUnlock()

	result := make([]string, 0, len(r.tools))
	for name, tool := range r.tools {
		result = append(result, fmt.Sprintf("%s - %s", name, tool.Description()))
	}

	return result
}

// Count 返回已注册工具数量
func (r *ToolRegistry) Count() int {
	r.mu.RLock()
	defer r.mu.RUnlock()

	return len(r.tools)
}

// ToolCall 工具调用请求结构体
// 用于 AI Agent 发起工具调用
type ToolCall struct {
	// Name 要调用的工具名称
	Name string `json:"name"`
	// Arguments 工具参数
	Arguments map[string]interface{} `json:"arguments"`
}

// ToolCallResult 工具调用结果结构体
// 用于返回工具执行结果给 AI Agent
type ToolCallResult struct {
	// Name 工具名称
	Name string `json:"name"`
	// Output 工具输出内容
	Output string `json:"output"`
	// Error 错误信息（如果有）
	Error string `json:"error,omitempty"`
	// Success 是否执行成功
	Success bool `json:"success"`
}

// ExecuteToolCall 执行工具调用
// 根据 ToolCall 请求，查找并执行对应的工具
func (r *ToolRegistry) ExecuteToolCall(call ToolCall) ToolCallResult {
	tool, err := r.Get(call.Name)
	if err != nil {
		return ToolCallResult{
			Name:    call.Name,
			Error:   err.Error(),
			Success: false,
		}
	}

	output, err := tool.Execute(call.Arguments)
	if err != nil {
		return ToolCallResult{
			Name:    call.Name,
			Output:  output,
			Error:   err.Error(),
			Success: false,
		}
	}

	return ToolCallResult{
		Name:    call.Name,
		Output:  output,
		Success: true,
	}
}

// ExecuteToolCallString 从 JSON 字符串解析并执行工具调用
// 简化 AI Agent 的工具调用流程
func (r *ToolRegistry) ExecuteToolCallString(jsonStr string) ToolCallResult {
	// 尝试解析简单的 "tool_name: {...args}" 格式
	// 或使用标准 JSON 格式
	var call ToolCall

	// 简单解析：尝试提取工具名和参数
	jsonStr = strings.TrimSpace(jsonStr)

	// 尝试标准 JSON 解析
	if strings.HasPrefix(jsonStr, "{") {
		// 使用简单的方式提取 name 和 arguments
		// 这里使用简单的字符串解析，避免引入复杂的 JSON 解析逻辑
		name := extractJSONField(jsonStr, "name")
		if name != "" {
			call.Name = name
			call.Arguments = extractJSONArguments(jsonStr)
		}
	}

	if call.Name == "" {
		return ToolCallResult{
			Name:    "",
			Error:   "无法解析工具调用请求",
			Success: false,
		}
	}

	return r.ExecuteToolCall(call)
}

// extractJSONField 从 JSON 字符串中提取字段值（简单实现）
func extractJSONField(jsonStr, field string) string {
	// 查找 "field": "value" 模式
	pattern := fmt.Sprintf(`"%s"`, field)
	idx := strings.Index(jsonStr, pattern)
	if idx == -1 {
		return ""
	}

	// 找到冒号后的值
	colonIdx := strings.Index(jsonStr[idx:], ":")
	if colonIdx == -1 {
		return ""
	}

	valueStart := idx + colonIdx + 1
	valueStr := strings.TrimSpace(jsonStr[valueStart:])

	// 提取引号内的值
	if strings.HasPrefix(valueStr, `"`) {
		endIdx := strings.Index(valueStr[1:], `"`)
		if endIdx != -1 {
			return valueStr[1 : endIdx+1]
		}
	}

	return ""
}

// extractJSONArguments 从 JSON 字符串中提取 arguments 对象
func extractJSONArguments(jsonStr string) map[string]interface{} {
	args := make(map[string]interface{})

	// 查找 "arguments": { ... } 模式
	idx := strings.Index(jsonStr, `"arguments"`)
	if idx == -1 {
		return args
	}

	// 找到冒号后的对象开始
	colonIdx := strings.Index(jsonStr[idx:], ":")
	if colonIdx == -1 {
		return args
	}

	objStart := idx + colonIdx + 1
	objStr := strings.TrimSpace(jsonStr[objStart:])

	// 找到对象的结束位置（简单实现，不考虑嵌套）
	if strings.HasPrefix(objStr, "{") {
		// 找到匹配的右括号
		depth := 0
		endIdx := -1
		for i, ch := range objStr {
			if ch == '{' {
				depth++
			} else if ch == '}' {
				depth--
				if depth == 0 {
					endIdx = i
					break
				}
			}
		}

		if endIdx != -1 {
			objContent := objStr[1:endIdx]
			// 解析简单的键值对
			pairs := strings.Split(objContent, ",")
			for _, pair := range pairs {
				pair = strings.TrimSpace(pair)
				if pair == "" {
					continue
				}

				kv := strings.SplitN(pair, ":", 2)
				if len(kv) != 2 {
					continue
				}

				key := strings.Trim(strings.TrimSpace(kv[0]), `"`)
				value := strings.TrimSpace(kv[1])

				// 简单类型推断
				if strings.HasPrefix(value, `"`) && strings.HasSuffix(value, `"`) {
					args[key] = strings.Trim(value, `"`)
				} else if value == "true" {
					args[key] = true
				} else if value == "false" {
					args[key] = false
				} else if num, err := fmt.Sscanf(value, "%f", new(float64)); err == nil && num == 1 {
					// 尝试解析为数字
					var f float64
					fmt.Sscanf(value, "%f", &f)
					args[key] = f
				} else {
					args[key] = value
				}
			}
		}
	}

	return args
}

// MCPError MCP 相关错误类型
type MCPError struct {
	// Code 错误码
	Code string
	// Message 错误信息
	Message string
}

// Error 实现 error 接口
func (e *MCPError) Error() string {
	return fmt.Sprintf("MCP 错误 [%s]: %s", e.Code, e.Message)
}

// NewMCPError 创建新的 MCP 错误
func NewMCPError(code, message string) *MCPError {
	return &MCPError{
		Code:    code,
		Message: message,
	}
}

// 预定义错误码
const (
	// ErrToolNotFound 工具未找到
	ErrToolNotFound = "TOOL_NOT_FOUND"
	// ErrToolExecution 工具执行错误
	ErrToolExecution = "TOOL_EXECUTION_FAILED"
	// ErrInvalidArgs 参数无效
	ErrInvalidArgs = "INVALID_ARGUMENTS"
	// ErrToolNotRegistered 工具未注册
	ErrToolNotRegistered = "TOOL_NOT_REGISTERED"
	// ErrPermissionDenied 权限不足
	ErrPermissionDenied = "PERMISSION_DENIED"
)

// GetToolDefinitions 获取所有工具的定义信息
// 用于发送给 AI 模型，让模型了解可用工具
func (r *ToolRegistry) GetToolDefinitions() []ToolDefinition {
	r.mu.RLock()
	defer r.mu.RUnlock()

	definitions := make([]ToolDefinition, 0, len(r.tools))
	for name, tool := range r.tools {
		definitions = append(definitions, ToolDefinition{
			Name:        name,
			Description: tool.Description(),
		})
	}

	return definitions
}

// ToolDefinition 工具定义信息
// 用于向 AI 描述可用工具
type ToolDefinition struct {
	// Name 工具名称
	Name string `json:"name"`
	// Description 工具描述
	Description string `json:"description"`
}

// String 返回工具定义的字符串表示
func (td ToolDefinition) String() string {
	return fmt.Sprintf("%s: %s", td.Name, td.Description)
}

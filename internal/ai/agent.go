package ai

import (
	"encoding/json"
	"fmt"
	"strings"

	"github.com/swcrbt/ai-ide/pkg/mcp"
	"github.com/swcrbt/ai-ide/pkg/mcp/tools"
)

// MCPToolManager MCP 工具管理器
// 管理所有 MCP 工具的注册和调用，集成到 AI Agent 中
type MCPToolManager struct {
	// registry MCP 工具注册表
	registry *mcp.ToolRegistry
}

// NewMCPToolManager 创建新的 MCP 工具管理器
// 自动注册所有 P0 工具
func NewMCPToolManager() *MCPToolManager {
	manager := &MCPToolManager{
		registry: mcp.NewToolRegistry(),
	}

	// 注册 P0 工具
	manager.registerDefaultTools()

	return manager
}

// registerDefaultTools 注册默认的 P0 和 P1/P2 工具
func (m *MCPToolManager) registerDefaultTools() {
	// 注册 P0 工具
	// 注册 grep_app 工具
	_ = m.registry.Register(tools.NewGrepTool())

	// 注册 rtk 工具
	_ = m.registry.Register(tools.NewRTKTool())

	// 注册 webfetch 工具
	_ = m.registry.Register(tools.NewWebFetchTool())

	// 注册 permission_guard 工具
	_ = m.registry.Register(tools.NewPermissionGuardTool())

	// 注册 P1/P2 工具
	// 注册 computer_use 工具（macOS 计算机控制）
	_ = m.registry.Register(tools.NewComputerUseTool())

	// 注册 command_suggest 工具（命令建议）
	_ = m.registry.Register(tools.NewCommandSuggestTool())

	// 注册 code_review 工具（代码审查）
	_ = m.registry.Register(tools.NewCodeReviewTool())

	// 注册 screenshot 工具（屏幕截图）
	_ = m.registry.Register(tools.NewScreenshotTool())

	// 注册 workflow 工具（工作流管理）
	_ = m.registry.Register(tools.NewWorkflowTool())

	// 注册 code_interpreter 工具（代码解释器）
	_ = m.registry.Register(tools.NewCodeInterpreterTool())

	// 注册 documentation 工具（文档生成）
	_ = m.registry.Register(tools.NewDocumentationTool())

	// 注册 feishu_im 工具（飞书消息）
	_ = m.registry.Register(tools.NewFeishuIMTool())
}

// GetRegistry 获取工具注册表
func (m *MCPToolManager) GetRegistry() *mcp.ToolRegistry {
	return m.registry
}

// GetToolDescriptions 获取所有工具的描述信息
// 用于注入到 AI 系统提示中
func (m *MCPToolManager) GetToolDescriptions() string {
	definitions := m.registry.GetToolDefinitions()
	if len(definitions) == 0 {
		return ""
	}

	var builder strings.Builder
	builder.WriteString("\n\n你可以使用以下工具来帮助用户:\n")
	builder.WriteString("要使用工具，请在回复中使用以下格式:\n")
	builder.WriteString("```tool\n")
	builder.WriteString("{\n")
	builder.WriteString(`  "name": "工具名称",` + "\n")
	builder.WriteString(`  "arguments": {` + "\n")
	builder.WriteString(`    "参数名": "参数值"` + "\n")
	builder.WriteString(`  }` + "\n")
	builder.WriteString("}\n")
	builder.WriteString("```\n\n")
	builder.WriteString("可用工具列表:\n")

	for _, def := range definitions {
		builder.WriteString(fmt.Sprintf("- %s\n", def.String()))
	}

	return builder.String()
}

// ExecuteToolCall 执行工具调用
// 从 AI 的回复中解析工具调用请求并执行
func (m *MCPToolManager) ExecuteToolCall(callJSON string) (*mcp.ToolCallResult, error) {
	// 解析工具调用 JSON
	var call mcp.ToolCall
	if err := json.Unmarshal([]byte(callJSON), &call); err != nil {
		// 尝试从代码块中提取
		callJSON = extractToolCallFromMarkdown(callJSON)
		if callJSON == "" {
			return nil, fmt.Errorf("解析工具调用失败: %w", err)
		}
		if err := json.Unmarshal([]byte(callJSON), &call); err != nil {
			return nil, fmt.Errorf("解析工具调用失败: %w", err)
		}
	}

	// 执行工具调用
	result := m.registry.ExecuteToolCall(call)

	return &result, nil
}

// extractToolCallFromMarkdown 从 Markdown 代码块中提取工具调用
func extractToolCallFromMarkdown(content string) string {
	// 查找 ```tool 代码块
	marker := "```tool"
	startIdx := strings.Index(content, marker)
	if startIdx == -1 {
		// 尝试查找 ```json 代码块
		marker = "```json"
		startIdx = strings.Index(content, marker)
		if startIdx == -1 {
			// 尝试查找普通 ``` 代码块
			marker = "```"
			startIdx = strings.Index(content, marker)
			if startIdx == -1 {
				return ""
			}
		}
	}

	// 找到代码块结束标记
	contentAfterStart := content[startIdx+len(marker):]
	endIdx := strings.Index(contentAfterStart, "```")
	if endIdx == -1 {
		return ""
	}

	return strings.TrimSpace(contentAfterStart[:endIdx])
}

// ProcessAIResponse 处理 AI 响应，检查并执行工具调用
// 返回 AI 的最终响应内容（可能包含工具执行结果）
func (m *MCPToolManager) ProcessAIResponse(response string) (string, []mcp.ToolCallResult, error) {
	// 检查响应中是否包含工具调用
	if !strings.Contains(response, "```tool") {
		// 没有工具调用，直接返回
		return response, nil, nil
	}

	var results []mcp.ToolCallResult

	// 提取所有工具调用
	toolCalls := extractAllToolCalls(response)
	if len(toolCalls) == 0 {
		return response, nil, nil
	}

	// 执行每个工具调用
	for _, callJSON := range toolCalls {
		result, err := m.ExecuteToolCall(callJSON)
		if err != nil {
			results = append(results, mcp.ToolCallResult{
				Name:    "",
				Error:   err.Error(),
				Success: false,
			})
			continue
		}
		results = append(results, *result)
	}

	// 构建包含工具执行结果的响应
	var builder strings.Builder
	builder.WriteString(response)
	builder.WriteString("\n\n---\n\n")
	builder.WriteString("工具执行结果:\n\n")

	for _, result := range results {
		if result.Success {
			builder.WriteString(fmt.Sprintf("✅ **%s**:\n```\n%s\n```\n\n", result.Name, result.Output))
		} else {
			builder.WriteString(fmt.Sprintf("❌ **%s**: %s\n\n", result.Name, result.Error))
		}
	}

	return builder.String(), results, nil
}

// extractAllToolCalls 从文本中提取所有工具调用
func extractAllToolCalls(content string) []string {
	var calls []string
	marker := "```tool"

	for {
		idx := strings.Index(content, marker)
		if idx == -1 {
			break
		}

		contentAfterMarker := content[idx+len(marker):]
		endIdx := strings.Index(contentAfterMarker, "```")
		if endIdx == -1 {
			break
		}

		callJSON := strings.TrimSpace(contentAfterMarker[:endIdx])
		if callJSON != "" {
			calls = append(calls, callJSON)
		}

		content = contentAfterMarker[endIdx+3:]
	}

	return calls
}

// BuildSystemPromptWithTools 构建包含工具信息的系统提示
// 在原有系统提示基础上追加工具使用说明
func (m *MCPToolManager) BuildSystemPromptWithTools(basePrompt string) string {
	toolDesc := m.GetToolDescriptions()
	if toolDesc == "" {
		return basePrompt
	}

	return basePrompt + toolDesc
}

// IsToolAvailable 检查工具是否可用
func (m *MCPToolManager) IsToolAvailable(name string) bool {
	_, err := m.registry.Get(name)
	return err == nil
}

// ListTools 列出所有可用工具
func (m *MCPToolManager) ListTools() []string {
	return m.registry.List()
}

// GetGlobalToolManager 全局 MCP 工具管理器实例
var globalToolManager *MCPToolManager

// GetMCPToolManager 获取全局 MCP 工具管理器（懒加载）
func GetMCPToolManager() *MCPToolManager {
	if globalToolManager == nil {
		globalToolManager = NewMCPToolManager()
	}
	return globalToolManager
}

// SetMCPToolManager 设置全局 MCP 工具管理器（用于测试）
func SetMCPToolManager(manager *MCPToolManager) {
	globalToolManager = manager
}

// ChatSessionWithTools 带 MCP 工具的聊天会话扩展
type ChatSessionWithTools struct {
	*ChatSession
	toolManager *MCPToolManager
}

// SendMessageWithTools 发送消息并支持工具调用
// 在 AI 响应中检测工具调用，执行后返回结果
func (s *ChatSessionWithTools) SendMessageWithTools(content string) (<-chan StreamChunk, error) {
	// 获取工具管理器
	if s.toolManager == nil {
		s.toolManager = GetMCPToolManager()
	}

	// 这里可以实现工具调用逻辑
	// 目前保持简单，将工具信息注入到上下文中
	return s.SendMessage(nil, content)
}

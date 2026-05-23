package lsp

// 本文件定义 LSP (Language Server Protocol) 的基础数据类型
// 参考 LSP 规范: https://microsoft.github.io/language-server-protocol/specifications/specification-current/

// InitializeParams 初始化请求参数
type InitializeParams struct {
	// ProcessID 客户端进程ID，null 表示客户端没有进程
	ProcessID *int `json:"processId"`
	// ClientInfo 客户端信息
	ClientInfo *ClientInfo `json:"clientInfo,omitempty"`
	// Locale 客户端locale设置，如 "en-US"
	Locale string `json:"locale,omitempty"`
	// RootPath 工作区根路径（已废弃，使用 RootURI）
	RootPath string `json:"rootPath,omitempty"`
	// RootURI 工作区根目录的URI
	RootURI DocumentURI `json:"rootUri"`
	// Capabilities 客户端能力
	Capabilities ClientCapabilities `json:"capabilities"`
	// Trace 跟踪级别
	Trace string `json:"trace,omitempty"`
	// WorkspaceFolders 工作区文件夹列表
	WorkspaceFolders []WorkspaceFolder `json:"workspaceFolders,omitempty"`
}

// ClientInfo 客户端信息
type ClientInfo struct {
	// Name 客户端名称
	Name string `json:"name"`
	// Version 客户端版本
	Version string `json:"version,omitempty"`
}

// ClientCapabilities 客户端能力
type ClientCapabilities struct {
	// Workspace 工作区相关能力
	Workspace WorkspaceClientCapabilities `json:"workspace,omitempty"`
	// TextDocument 文本文档相关能力
	TextDocument TextDocumentClientCapabilities `json:"textDocument,omitempty"`
}

// WorkspaceClientCapabilities 工作区客户端能力
type WorkspaceClientCapabilities struct {
	// ApplyEdit 客户端是否支持应用工作区编辑
	ApplyEdit bool `json:"applyEdit,omitempty"`
	// WorkspaceEdit 工作区编辑能力
	WorkspaceEdit WorkspaceEditClientCapabilities `json:"workspaceEdit,omitempty"`
	// DidChangeConfiguration 客户端是否支持配置变更通知
	DidChangeConfiguration bool `json:"didChangeConfiguration,omitempty"`
	// DidChangeWatchedFiles 客户端是否支持文件监视变更通知
	DidChangeWatchedFiles bool `json:"didChangeWatchedFiles,omitempty"`
	// WorkspaceFolders 客户端是否支持工作区文件夹
	WorkspaceFolders bool `json:"workspaceFolders,omitempty"`
	// Configuration 客户端是否支持从服务器获取配置
	Configuration bool `json:"configuration,omitempty"`
}

// WorkspaceEditClientCapabilities 工作区编辑客户端能力
type WorkspaceEditClientCapabilities struct {
	// DocumentChanges 客户端是否支持文档级别变更
	DocumentChanges bool `json:"documentChanges,omitempty"`
}

// TextDocumentClientCapabilities 文本文档客户端能力
type TextDocumentClientCapabilities struct {
	// Synchronization 文本文档同步能力
	Synchronization TextDocumentSyncClientCapabilities `json:"synchronization,omitempty"`
	// Completion 补全能力
	Completion CompletionClientCapabilities `json:"completion,omitempty"`
	// Hover hover 能力
	Hover bool `json:"hover,omitempty"`
	// Definition 定义跳转能力
	Definition bool `json:"definition,omitempty"`
}

// TextDocumentSyncClientCapabilities 文本文档同步客户端能力
type TextDocumentSyncClientCapabilities struct {
	// DynamicRegistration 是否支持动态注册
	DynamicRegistration bool `json:"dynamicRegistration,omitempty"`
	// WillSave 是否支持 willSave 通知
	WillSave bool `json:"willSave,omitempty"`
	// WillSaveWaitUntil 是否支持 willSaveWaitUntil 请求
	WillSaveWaitUntil bool `json:"willSaveWaitUntil,omitempty"`
	// DidSave 是否支持 didSave 通知
	DidSave bool `json:"didSave,omitempty"`
}

// CompletionClientCapabilities 补全客户端能力
type CompletionClientCapabilities struct {
	// DynamicRegistration 是否支持动态注册
	DynamicRegistration bool `json:"dynamicRegistration,omitempty"`
	// CompletionItem 补全项能力
	CompletionItem CompletionItemClientCapabilities `json:"completionItem,omitempty"`
}

// CompletionItemClientCapabilities 补全项客户端能力
type CompletionItemClientCapabilities struct {
	// SnippetSupport 是否支持 snippet
	SnippetSupport bool `json:"snippetSupport,omitempty"`
	// CommitCharactersSupport 是否支持提交字符
	CommitCharactersSupport bool `json:"commitCharactersSupport,omitempty"`
	// DocumentationFormat 文档格式偏好
	DocumentationFormat []MarkupKind `json:"documentationFormat,omitempty"`
}

// MarkupKind 标记类型
type MarkupKind string

const (
	// PlainText 纯文本
	PlainText MarkupKind = "plaintext"
	// Markdown Markdown格式
	Markdown MarkupKind = "markdown"
)

// InitializeResult 初始化响应结果
type InitializeResult struct {
	// Capabilities 服务器能力
	Capabilities ServerCapabilities `json:"capabilities"`
	// ServerInfo 服务器信息（可选）
	ServerInfo *ServerInfo `json:"serverInfo,omitempty"`
}

// ServerInfo 语言服务器信息
type ServerInfo struct {
	// Name 服务器名称
	Name string `json:"name"`
	// Version 服务器版本
	Version string `json:"version,omitempty"`
}

// ServerCapabilities 服务器能力
type ServerCapabilities struct {
	// TextDocumentSync 文本文档同步选项
	TextDocumentSync *TextDocumentSyncOptions `json:"textDocumentSync,omitempty"`
	// CompletionProvider 补全提供者选项
	CompletionProvider *CompletionOptions `json:"completionProvider,omitempty"`
	// HoverProvider hover提供者
	HoverProvider bool `json:"hoverProvider,omitempty"`
	// DefinitionProvider 定义跳转提供者
	DefinitionProvider bool `json:"definitionProvider,omitempty"`
	// DocumentFormattingProvider 文档格式化提供者
	DocumentFormattingProvider bool `json:"documentFormattingProvider,omitempty"`
	// DocumentRangeFormattingProvider 范围格式化提供者
	DocumentRangeFormattingProvider bool `json:"documentRangeFormattingProvider,omitempty"`
	// DocumentSymbolProvider 文档符号提供者
	DocumentSymbolProvider bool `json:"documentSymbolProvider,omitempty"`
	// CodeActionProvider 代码动作提供者
	CodeActionProvider bool `json:"codeActionProvider,omitempty"`
	// CodeLensProvider 代码透镜提供者
	CodeLensProvider *CodeLensOptions `json:"codeLensProvider,omitempty"`
	// RenameProvider 重命名提供者
	RenameProvider bool `json:"renameProvider,omitempty"`
	// ExecuteCommandProvider 命令执行提供者
	ExecuteCommandProvider *ExecuteCommandOptions `json:"executeCommandProvider,omitempty"`
	// WorkspaceSymbolProvider 工作区符号提供者
	WorkspaceSymbolProvider bool `json:"workspaceSymbolProvider,omitempty"`
	// SignatureHelpProvider 签名帮助提供者
	SignatureHelpProvider *SignatureHelpOptions `json:"signatureHelpProvider,omitempty"`
}

// TextDocumentSyncOptions 文本文档同步选项
type TextDocumentSyncOptions struct {
	// OpenClose 是否在打开/关闭文档时发送通知
	OpenClose bool `json:"openClose,omitempty"`
	// Change 文档变更通知类型（1=Full, 2=Incremental）
	Change int `json:"change,omitempty"`
	// WillSave 是否发送 willSave 通知
	WillSave bool `json:"willSave,omitempty"`
	// WillSaveWaitUntil 是否发送 willSaveWaitUntil 请求
	WillSaveWaitUntil bool `json:"willSaveWaitUntil,omitempty"`
	// Save 保存选项
	Save *SaveOptions `json:"save,omitempty"`
}

// SaveOptions 保存选项
type SaveOptions struct {
	// IncludeText 是否包含文档全文
	IncludeText bool `json:"includeText,omitempty"`
}

// CompletionOptions 补全选项
type CompletionOptions struct {
	// ResolveProvider 是否支持解析额外信息
	ResolveProvider bool `json:"resolveProvider,omitempty"`
	// TriggerCharacters 触发补全的字符列表
	TriggerCharacters []string `json:"triggerCharacters,omitempty"`
}

// CodeLensOptions 代码透镜选项
type CodeLensOptions struct {
	// ResolveProvider 是否支持解析额外信息
	ResolveProvider bool `json:"resolveProvider,omitempty"`
}

// ExecuteCommandOptions 命令执行选项
type ExecuteCommandOptions struct {
	// Commands 支持的命令列表
	Commands []string `json:"commands"`
}

// SignatureHelpOptions 签名帮助选项
type SignatureHelpOptions struct {
	// TriggerCharacters 触发签名的字符列表
	TriggerCharacters []string `json:"triggerCharacters,omitempty"`
}

// WorkspaceFolder 工作区文件夹
type WorkspaceFolder struct {
	// URI 文件夹URI
	URI string `json:"uri"`
	// Name 文件夹名称
	Name string `json:"name"`
}

// DocumentURI 文档URI类型
type DocumentURI string

// TextDocumentItem 文本文档项
type TextDocumentItem struct {
	// URI 文档URI
	URI DocumentURI `json:"uri"`
	// LanguageID 语言标识符
	LanguageID string `json:"languageId"`
	// Version 文档版本号
	Version int `json:"version"`
	// Text 文档全文内容
	Text string `json:"text"`
}

// VersionedTextDocumentIdentifier 带版本号的文本文档标识符
type VersionedTextDocumentIdentifier struct {
	// URI 文档URI
	URI DocumentURI `json:"uri"`
	// Version 文档版本号
	Version int `json:"version"`
}

// TextDocumentIdentifier 文本文档标识符
type TextDocumentIdentifier struct {
	// URI 文档URI
	URI DocumentURI `json:"uri"`
}

// Position 位置（0-based）
type Position struct {
	// Line 行号（从0开始）
	Line int `json:"line"`
	// Character 字符位置（从0开始，UTF-16编码单位）
	Character int `json:"character"`
}

// Range 范围
type Range struct {
	// Start 起始位置
	Start Position `json:"start"`
	// End 结束位置
	End Position `json:"end"`
}

// Location 位置信息
type Location struct {
	// URI 文档URI
	URI DocumentURI `json:"uri"`
	// Range 范围
	Range Range `json:"range"`
}

// TextDocumentContentChangeEvent 文本文档内容变更事件
type TextDocumentContentChangeEvent struct {
	// Range 变更范围（增量更新时使用）
	Range *Range `json:"range,omitempty"`
	// RangeLength 变更范围长度（已废弃）
	RangeLength int `json:"rangeLength,omitempty"`
	// Text 新文本内容
	Text string `json:"text"`
}

// Diagnostic 诊断信息
type Diagnostic struct {
	// Range 诊断范围
	Range Range `json:"range"`
	// Severity 严重程度
	Severity DiagnosticSeverity `json:"severity,omitempty"`
	// Code 诊断代码
	Code string `json:"code,omitempty"`
	// Source 诊断来源
	Source string `json:"source,omitempty"`
	// Message 诊断消息
	Message string `json:"message"`
}

// DiagnosticSeverity 诊断严重程度
type DiagnosticSeverity int

const (
	// Error 错误
	Error DiagnosticSeverity = 1
	// Warning 警告
	Warning DiagnosticSeverity = 2
	// Information 信息
	Information DiagnosticSeverity = 3
	// Hint 提示
	Hint DiagnosticSeverity = 4
)

// MessageType 消息类型（用于 window/showMessage）
type MessageType int

const (
	// MsgError 错误消息
	MsgError MessageType = 1
	// MsgWarning 警告消息
	MsgWarning MessageType = 2
	// MsgInfo 信息消息
	MsgInfo MessageType = 3
	// MsgLog 日志消息
	MsgLog MessageType = 4
)

// ShowMessageParams 显示消息参数
type ShowMessageParams struct {
	// Type 消息类型
	Type MessageType `json:"type"`
	// Message 消息内容
	Message string `json:"message"`
}

// LogMessageParams 日志消息参数
type LogMessageParams struct {
	// Type 消息类型
	Type MessageType `json:"type"`
	// Message 消息内容
	Message string `json:"message"`
}

// PublishDiagnosticsParams 发布诊断参数
type PublishDiagnosticsParams struct {
	// URI 文档URI
	URI DocumentURI `json:"uri"`
	// Version 文档版本号（可选）
	Version int `json:"version,omitempty"`
	// Diagnostics 诊断列表
	Diagnostics []Diagnostic `json:"diagnostics"`
}

// CompletionItem 补全项
type CompletionItem struct {
	// Label 显示标签
	Label string `json:"label"`
	// Kind 补全类型
	Kind CompletionItemKind `json:"kind,omitempty"`
	// Detail 详细信息
	Detail string `json:"detail,omitempty"`
	// Documentation 文档说明
	Documentation string `json:"documentation,omitempty"`
	// InsertText 插入文本
	InsertText string `json:"insertText,omitempty"`
	// SortText 排序文本
	SortText string `json:"sortText,omitempty"`
	// FilterText 过滤文本
	FilterText string `json:"filterText,omitempty"`
}

// CompletionItemKind 补全项类型
type CompletionItemKind int

const (
	// TextKind 文本
	TextKind CompletionItemKind = 1
	// MethodKind 方法
	MethodKind CompletionItemKind = 2
	// FunctionKind 函数
	FunctionKind CompletionItemKind = 3
	// ConstructorKind 构造函数
	ConstructorKind CompletionItemKind = 4
	// FieldKind 字段
	FieldKind CompletionItemKind = 5
	// VariableKind 变量
	VariableKind CompletionItemKind = 6
	// ClassKind 类
	ClassKind CompletionItemKind = 7
	// InterfaceKind 接口
	InterfaceKind CompletionItemKind = 8
	// ModuleKind 模块
	ModuleKind CompletionItemKind = 9
	// PropertyKind 属性
	PropertyKind CompletionItemKind = 10
)

// CompletionList 补全列表
type CompletionList struct {
	// IsIncomplete 列表是否不完整
	IsIncomplete bool `json:"isIncomplete"`
	// Items 补全项列表
	Items []CompletionItem `json:"items"`
}

// Hover 悬浮提示
type Hover struct {
	// Contents 提示内容
	Contents MarkupContent `json:"contents"`
	// Range 范围（可选）
	Range *Range `json:"range,omitempty"`
}

// MarkupContent 标记内容
type MarkupContent struct {
	// Kind 内容类型
	Kind MarkupKind `json:"kind"`
	// Value 内容值
	Value string `json:"value"`
}

// ShutdownResult Shutdown 响应结果（无内容）
type ShutdownResult struct{}

// EmptyResult 空结果
type EmptyResult struct{}

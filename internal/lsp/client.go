package lsp

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"sync"
	"time"
)

// 本文件实现 LSP (Language Server Protocol) 客户端核心
// 负责管理语言服务器进程和 JSON-RPC 通信

// ClientState 客户端状态
type ClientState int

const (
	// ClientStateStopped 已停止
	ClientStateStopped ClientState = iota
	// ClientStateStarting 启动中
	ClientStateStarting
	// ClientStateRunning 运行中
	ClientStateRunning
	// ClientStateStopping 停止中
	ClientStateStopping
)

// String 返回状态字符串
func (s ClientState) String() string {
	switch s {
	case ClientStateStopped:
		return "stopped"
	case ClientStateStarting:
		return "starting"
	case ClientStateRunning:
		return "running"
	case ClientStateStopping:
		return "stopping"
	default:
		return "unknown"
	}
}

// LSPClient LSP 客户端
type LSPClient struct {
	// processManager 进程管理器
	processManager *ProcessManager
	// messageReader 消息读取器
	messageReader *MessageReader
	// messageWriter 消息写入器
	messageWriter *MessageWriter
	// idGenerator ID生成器
	idGenerator *IDGenerator
	// state 客户端状态
	state ClientState
	// stateMu 状态互斥锁
	stateMu sync.RWMutex
	// pendingRequests 等待中的请求
	pendingRequests map[ID]chan *Response
	// pendingMu 请求互斥锁
	pendingMu sync.RWMutex
	// serverCapabilities 服务器能力
	serverCapabilities ServerCapabilities
	// workspacePath 工作区路径
	workspacePath string
	// stopCh 停止信号通道
	stopCh chan struct{}
	// wg 等待组
	wg sync.WaitGroup
	// initialized 是否已完成初始化
	initialized bool
}

// NewLSPClient 创建新的 LSP 客户端
func NewLSPClient() *LSPClient {
	return &LSPClient{
		idGenerator:     NewIDGenerator(),
		state:           ClientStateStopped,
		pendingRequests: make(map[ID]chan *Response),
		stopCh:          make(chan struct{}),
	}
}

// Start 启动语言服务器
func (c *LSPClient) Start(serverPath string, args []string) error {
	c.stateMu.Lock()
	defer c.stateMu.Unlock()

	if c.state != ClientStateStopped {
		return fmt.Errorf("客户端状态为 %s，无法启动", c.state.String())
	}

	c.state = ClientStateStarting

	// 创建进程管理器
	c.processManager = NewProcessManager(serverPath, args)

	// 启动进程
	if err := c.processManager.Start(); err != nil {
		c.state = ClientStateStopped
		return fmt.Errorf("启动语言服务器失败: %w", err)
	}

	// 创建消息读写器
	c.messageReader = NewMessageReader(c.processManager.Stdout())
	c.messageWriter = NewMessageWriter(c.processManager.Stdin())

	c.state = ClientStateRunning
	c.stopCh = make(chan struct{})

	// 启动消息读取协程
	c.wg.Add(1)
	go c.readMessages()

	return nil
}

// Stop 停止语言服务器
func (c *LSPClient) Stop() error {
	c.stateMu.Lock()
	if c.state != ClientStateRunning && c.state != ClientStateStarting {
		c.stateMu.Unlock()
		return nil
	}
	c.state = ClientStateStopping
	c.stateMu.Unlock()

	// 发送停止信号
	close(c.stopCh)

	// 取消所有等待中的请求
	c.pendingMu.Lock()
	for id, ch := range c.pendingRequests {
		close(ch)
		delete(c.pendingRequests, id)
	}
	c.pendingMu.Unlock()

	// 停止进程
	if c.processManager != nil {
		if err := c.processManager.Stop(); err != nil {
			return fmt.Errorf("停止语言服务器失败: %w", err)
		}
	}

	// 等待消息读取协程结束
	c.wg.Wait()

	c.stateMu.Lock()
	c.state = ClientStateStopped
	c.initialized = false
	c.stateMu.Unlock()

	return nil
}

// Initialize 发送 Initialize 请求
func (c *LSPClient) Initialize(workspacePath string) (*InitializeResult, error) {
	if !c.IsRunning() {
		return nil, fmt.Errorf("客户端未运行")
	}

	c.workspacePath = workspacePath

	// 构建 workspace URI
	workspaceURI := ""
	if workspacePath != "" {
		workspaceURI = "file://" + workspacePath
	}

	// 获取进程ID
	processID := os.Getpid()

	// 构建初始化参数
	params := InitializeParams{
		ProcessID: &processID,
		ClientInfo: &ClientInfo{
			Name:    "ai-ide",
			Version: "1.0.0",
		},
		RootURI: DocumentURI(workspaceURI),
		Capabilities: ClientCapabilities{
			Workspace: WorkspaceClientCapabilities{
				ApplyEdit:              true,
				DidChangeConfiguration: true,
				DidChangeWatchedFiles:  true,
				WorkspaceFolders:       true,
				Configuration:          true,
			},
			TextDocument: TextDocumentClientCapabilities{
				Synchronization: TextDocumentSyncClientCapabilities{
					DynamicRegistration: true,
					WillSave:            true,
					WillSaveWaitUntil:   true,
					DidSave:             true,
				},
				Completion: CompletionClientCapabilities{
					DynamicRegistration: true,
					CompletionItem: CompletionItemClientCapabilities{
						SnippetSupport:      true,
						CommitCharactersSupport: true,
						DocumentationFormat: []MarkupKind{Markdown, PlainText},
					},
				},
				Hover:      true,
				Definition: true,
			},
		},
		Trace: "off",
	}

	// 如果存在工作区路径，添加 WorkspaceFolders
	if workspacePath != "" {
		params.WorkspaceFolders = []WorkspaceFolder{
			{
				URI:  workspaceURI,
				Name: workspacePath,
			},
		}
	}

	// 发送请求
	resp, err := c.sendRequest("initialize", params)
	if err != nil {
		return nil, fmt.Errorf("initialize 请求失败: %w", err)
	}

	// 检查错误
	if resp.Error != nil {
		return nil, fmt.Errorf("initialize 响应错误: %s", resp.Error.Error())
	}

	// 解析结果
	var result InitializeResult
	if err := json.Unmarshal(*resp.Result, &result); err != nil {
		return nil, fmt.Errorf("解析 initialize 结果失败: %w", err)
	}

	c.serverCapabilities = result.Capabilities

	// 发送 initialized 通知
	if err := c.sendNotification("initialized", EmptyResult{}); err != nil {
		return nil, fmt.Errorf("发送 initialized 通知失败: %w", err)
	}

	c.stateMu.Lock()
	c.initialized = true
	c.stateMu.Unlock()

	return &result, nil
}

// Shutdown 发送 Shutdown 请求
func (c *LSPClient) Shutdown() error {
	if !c.IsRunning() {
		return fmt.Errorf("客户端未运行")
	}

	c.stateMu.RLock()
	initialized := c.initialized
	c.stateMu.RUnlock()

	if !initialized {
		return fmt.Errorf("客户端尚未初始化")
	}

	// 发送 shutdown 请求
	resp, err := c.sendRequest("shutdown", nil)
	if err != nil {
		return fmt.Errorf("shutdown 请求失败: %w", err)
	}

	if resp.Error != nil {
		return fmt.Errorf("shutdown 响应错误: %s", resp.Error.Error())
	}

	// 发送 exit 通知
	if err := c.sendNotification("exit", nil); err != nil {
		return fmt.Errorf("发送 exit 通知失败: %w", err)
	}

	c.stateMu.Lock()
	c.initialized = false
	c.stateMu.Unlock()

	return nil
}

// IsRunning 检查客户端是否运行中
func (c *LSPClient) IsRunning() bool {
	c.stateMu.RLock()
	defer c.stateMu.RUnlock()
	return c.state == ClientStateRunning
}

// IsInitialized 检查客户端是否已初始化
func (c *LSPClient) IsInitialized() bool {
	c.stateMu.RLock()
	defer c.stateMu.RUnlock()
	return c.initialized
}

// GetState 获取客户端状态
func (c *LSPClient) GetState() ClientState {
	c.stateMu.RLock()
	defer c.stateMu.RUnlock()
	return c.state
}

// GetServerCapabilities 获取服务器能力
func (c *LSPClient) GetServerCapabilities() ServerCapabilities {
	c.stateMu.RLock()
	defer c.stateMu.RUnlock()
	return c.serverCapabilities
}

// sendRequest 发送请求并等待响应
func (c *LSPClient) sendRequest(method string, params interface{}) (*Response, error) {
	id := c.idGenerator.Next()

	// 创建响应通道
	respCh := make(chan *Response, 1)
	c.pendingMu.Lock()
	c.pendingRequests[id] = respCh
	c.pendingMu.Unlock()

	// 编码请求
	data, err := EncodeRequest(id, method, params)
	if err != nil {
		c.pendingMu.Lock()
		delete(c.pendingRequests, id)
		c.pendingMu.Unlock()
		return nil, fmt.Errorf("编码请求失败: %w", err)
	}

	// 发送请求
	if err := c.messageWriter.WriteMessage(data); err != nil {
		c.pendingMu.Lock()
		delete(c.pendingRequests, id)
		c.pendingMu.Unlock()
		return nil, fmt.Errorf("发送请求失败: %w", err)
	}

	// 等待响应（带超时）
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	select {
	case resp := <-respCh:
		if resp == nil {
			return nil, fmt.Errorf("请求被取消")
		}
		return resp, nil
	case <-ctx.Done():
		c.pendingMu.Lock()
		delete(c.pendingRequests, id)
		c.pendingMu.Unlock()
		return nil, fmt.Errorf("请求超时")
	case <-c.stopCh:
		c.pendingMu.Lock()
		delete(c.pendingRequests, id)
		c.pendingMu.Unlock()
		return nil, fmt.Errorf("客户端已停止")
	}
}

// sendNotification 发送通知
func (c *LSPClient) sendNotification(method string, params interface{}) error {
	data, err := EncodeNotification(method, params)
	if err != nil {
		return fmt.Errorf("编码通知失败: %w", err)
	}

	if err := c.messageWriter.WriteMessage(data); err != nil {
		return fmt.Errorf("发送通知失败: %w", err)
	}

	return nil
}

// readMessages 读取消息循环
func (c *LSPClient) readMessages() {
	defer c.wg.Done()

	for {
		select {
		case <-c.stopCh:
			return
		default:
		}

		// 读取消息
		data, err := c.messageReader.ReadMessage()
		if err != nil {
			select {
			case <-c.stopCh:
				return
			default:
				fmt.Printf("读取消息错误: %v\n", err)
				return
			}
		}

		// 处理消息
		go c.handleMessage(data)
	}
}

// handleMessage 处理收到的消息
func (c *LSPClient) handleMessage(data []byte) {
	// 判断是响应还是通知
	if !IsNotification(data) {
		// 解析响应
		resp, err := DecodeResponse(data)
		if err != nil {
			fmt.Printf("解码响应失败: %v\n", err)
			return
		}

		if resp.ID == nil {
			fmt.Println("收到无ID的响应")
			return
		}

		// 分发给等待的请求
		c.pendingMu.Lock()
		ch, ok := c.pendingRequests[*resp.ID]
		if ok {
			delete(c.pendingRequests, *resp.ID)
		}
		c.pendingMu.Unlock()

		if ok {
			select {
			case ch <- resp:
			default:
			}
		}
	} else {
		// 解析通知
		notif, err := DecodeNotification(data)
		if err != nil {
			fmt.Printf("解码通知失败: %v\n", err)
			return
		}

		// 处理通知
		c.handleNotification(notif)
	}
}

// handleNotification 处理服务器通知
func (c *LSPClient) handleNotification(notif *Notification) {
	switch notif.Method {
	case "window/showMessage":
		var params ShowMessageParams
		if data, err := json.Marshal(notif.Params); err == nil {
			json.Unmarshal(data, &params)
			fmt.Printf("[LSP Message] %s\n", params.Message)
		}
	case "window/logMessage":
		var params LogMessageParams
		if data, err := json.Marshal(notif.Params); err == nil {
			json.Unmarshal(data, &params)
			fmt.Printf("[LSP Log] %s\n", params.Message)
		}
	case "textDocument/publishDiagnostics":
		var params PublishDiagnosticsParams
		if data, err := json.Marshal(notif.Params); err == nil {
			json.Unmarshal(data, &params)
			fmt.Printf("[LSP Diagnostics] %s: %d 个诊断\n", params.URI, len(params.Diagnostics))
		}
	default:
		fmt.Printf("[LSP Notification] %s\n", notif.Method)
	}
}

// Restart 重启语言服务器
func (c *LSPClient) Restart() error {
	if err := c.Stop(); err != nil {
		return fmt.Errorf("停止失败: %w", err)
	}

	// 等待完全停止
	time.Sleep(100 * time.Millisecond)

	if c.processManager == nil {
		return fmt.Errorf("进程管理器未初始化")
	}

	return c.Start(c.processManager.GetServerPath(), c.processManager.GetArgs())
}

// GetWorkspacePath 获取工作区路径
func (c *LSPClient) GetWorkspacePath() string {
	c.stateMu.RLock()
	defer c.stateMu.RUnlock()
	return c.workspacePath
}

// DidOpen 发送 textDocument/didOpen 通知
func (c *LSPClient) DidOpen(document *TextDocumentItem) error {
	if !c.IsInitialized() {
		return fmt.Errorf("客户端未初始化")
	}

	params := struct {
		TextDocument TextDocumentItem `json:"textDocument"`
	}{
		TextDocument: *document,
	}

	return c.sendNotification("textDocument/didOpen", params)
}

// DidClose 发送 textDocument/didClose 通知
func (c *LSPClient) DidClose(uri DocumentURI) error {
	if !c.IsInitialized() {
		return fmt.Errorf("客户端未初始化")
	}

	params := struct {
		TextDocument TextDocumentIdentifier `json:"textDocument"`
	}{
		TextDocument: TextDocumentIdentifier{URI: uri},
	}

	return c.sendNotification("textDocument/didClose", params)
}

// DidChange 发送 textDocument/didChange 通知
func (c *LSPClient) DidChange(uri DocumentURI, version int, changes []TextDocumentContentChangeEvent) error {
	if !c.IsInitialized() {
		return fmt.Errorf("客户端未初始化")
	}

	params := struct {
		TextDocument   VersionedTextDocumentIdentifier `json:"textDocument"`
		ContentChanges []TextDocumentContentChangeEvent  `json:"contentChanges"`
	}{
		TextDocument: VersionedTextDocumentIdentifier{
			URI:     uri,
			Version: version,
		},
		ContentChanges: changes,
	}

	return c.sendNotification("textDocument/didChange", params)
}

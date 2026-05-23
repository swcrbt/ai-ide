package lsp

import (
	"encoding/json"
	"fmt"
	"io"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"sync"
	"testing"
	"time"
)

// TestMessageReader_EmptyMessage 测试读取空消息
func TestMessageReader_EmptyMessage(t *testing.T) {
	pr, pw := io.Pipe()
	reader := NewMessageReader(pr)

	go func() {
		// 发送只有头部没有内容的消息
		pw.Write([]byte("Content-Length: 0\r\n\r\n"))
		pw.Close()
	}()

	_, err := reader.ReadMessage()
	if err == nil {
		t.Error("空内容长度应返回错误")
	}
}

// TestMessageReader_MalformedContentLength 测试畸形 Content-Length
func TestMessageReader_MalformedContentLength(t *testing.T) {
	pr, pw := io.Pipe()
	reader := NewMessageReader(pr)

	go func() {
		pw.Write([]byte("Content-Length: abc\r\n\r\n{}"))
		pw.Close()
	}()

	_, err := reader.ReadMessage()
	if err == nil {
		t.Error("畸形 Content-Length 应返回错误")
	}
}

// TestMessageReader_MissingContentLength 测试缺少 Content-Length
func TestMessageReader_MissingContentLength(t *testing.T) {
	pr, pw := io.Pipe()
	reader := NewMessageReader(pr)

	go func() {
		pw.Write([]byte("X-Custom-Header: value\r\n\r\n{}"))
		pw.Close()
	}()

	_, err := reader.ReadMessage()
	if err == nil {
		t.Error("缺少 Content-Length 应返回错误")
	}
}

// TestMessageReader_LargeMessage 测试超大消息处理
func TestMessageReader_LargeMessage(t *testing.T) {
	pr, pw := io.Pipe()
	reader := NewMessageReader(pr)

	// 构建一个较大的消息（1MB）
	largeContent := make([]byte, 1024*1024)
	for i := range largeContent {
		largeContent[i] = 'a'
	}
	msg := []byte(`{"jsonrpc":"2.0","id":1,"result":"` + string(largeContent) + `"}`)

	done := make(chan []byte, 1)
	go func() {
		data, err := reader.ReadMessage()
		if err != nil {
			t.Errorf("读取大消息失败: %v", err)
		}
		done <- data
	}()

	header := fmt.Sprintf("Content-Length: %d\r\n\r\n", len(msg))
	pw.Write([]byte(header))
	pw.Write(msg)
	pw.Close()

	select {
	case data := <-done:
		if len(data) != len(msg) {
			t.Errorf("大消息长度不匹配: got %d, want %d", len(data), len(msg))
		}
	case <-time.After(5 * time.Second):
		t.Fatal("读取大消息超时")
	}
}

// TestMessageReader_MultipleMessages 测试连续读取多条消息
func TestMessageReader_MultipleMessages(t *testing.T) {
	pr, pw := io.Pipe()
	reader := NewMessageReader(pr)

	msgs := []string{
		`{"jsonrpc":"2.0","id":1,"result":{}}`,
		`{"jsonrpc":"2.0","id":2,"result":{"key":"value"}}`,
		`{"jsonrpc":"2.0","method":"notification","params":{}}`,
	}

	go func() {
		for _, msg := range msgs {
			header := fmt.Sprintf("Content-Length: %d\r\n\r\n", len(msg))
			pw.Write([]byte(header))
			pw.Write([]byte(msg))
		}
		pw.Close()
	}()

	for i, expected := range msgs {
		data, err := reader.ReadMessage()
		if err != nil {
			t.Fatalf("读取第%d条消息失败: %v", i+1, err)
		}
		if string(data) != expected {
			t.Errorf("第%d条消息不匹配", i+1)
		}
	}
}

// TestMessageWriter_Error 测试写入错误处理
func TestMessageWriter_Error(t *testing.T) {
	// 使用一个会返回错误的 writer
	pr, pw := io.Pipe()
	pw.Close() // 立即关闭，使写入失败
	reader := NewMessageReader(pr)
	writer := NewMessageWriter(pw)

	err := writer.WriteMessage([]byte(`{"test":true}`))
	if err == nil {
		t.Error("向已关闭的 writer 写入应返回错误")
	}

	// 尝试从已关闭的 reader 读取
	_, err = reader.ReadMessage()
	if err == nil {
		t.Error("从已关闭的 reader 读取应返回错误")
	}
}

// TestJSONRPC_BoundaryCases 测试 JSON-RPC 边界情况
func TestJSONRPC_BoundaryCases(t *testing.T) {
	t.Run("空的JSON-RPC版本", func(t *testing.T) {
		resp := Response{JSONRPC: "", ID: &ID{Num: 1}}
		data, _ := json.Marshal(resp)
		_, err := DecodeResponse(data)
		if err == nil {
			t.Error("空的JSON-RPC版本应返回错误")
		}
	})

	t.Run("畸形JSON", func(t *testing.T) {
		_, err := DecodeResponse([]byte(`{invalid json`))
		if err == nil {
			t.Error("畸形JSON应返回错误")
		}
	})

	t.Run("空通知解码", func(t *testing.T) {
		_, err := DecodeNotification([]byte(`{}`))
		if err == nil {
			t.Error("空通知缺少jsonrpc字段应返回错误")
		}
	})

	t.Run("超大ID", func(t *testing.T) {
		id := ID{Num: 9223372036854775807} // MaxInt64
		data, err := json.Marshal(id)
		if err != nil {
			t.Fatalf("序列化超大ID失败: %v", err)
		}
		var decoded ID
		if err := json.Unmarshal(data, &decoded); err != nil {
			t.Fatalf("反序列化超大ID失败: %v", err)
		}
		if decoded.Num != id.Num {
			t.Errorf("超大ID不匹配")
		}
	})

	t.Run("特殊字符ID", func(t *testing.T) {
		id := ID{Str: "test-id_123.abc", IsString: true}
		data, err := json.Marshal(id)
		if err != nil {
			t.Fatalf("序列化特殊字符ID失败: %v", err)
		}
		var decoded ID
		if err := json.Unmarshal(data, &decoded); err != nil {
			t.Fatalf("反序列化特殊字符ID失败: %v", err)
		}
		if !decoded.Equal(id) {
			t.Errorf("特殊字符ID不匹配")
		}
	})
}

// TestID_Equal 测试ID比较边界情况
func TestID_Equal(t *testing.T) {
	tests := []struct {
		name     string
		a        ID
		b        ID
		expected bool
	}{
		{"相同数字ID", ID{Num: 1}, ID{Num: 1}, true},
		{"不同数字ID", ID{Num: 1}, ID{Num: 2}, false},
		{"相同字符串ID", ID{Str: "abc", IsString: true}, ID{Str: "abc", IsString: true}, true},
		{"不同字符串ID", ID{Str: "abc", IsString: true}, ID{Str: "def", IsString: true}, false},
		{"数字与字符串", ID{Num: 1}, ID{Str: "1", IsString: true}, false},
		{"空ID", ID{}, ID{}, true},
		{"负数ID", ID{Num: -1}, ID{Num: -1}, true},
		{"零ID", ID{Num: 0}, ID{Num: 0}, true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := tt.a.Equal(tt.b); got != tt.expected {
				t.Errorf("ID.Equal() = %v, want %v", got, tt.expected)
			}
		})
	}
}

// TestID_String 测试ID字符串表示
func TestID_String(t *testing.T) {
	tests := []struct {
		id       ID
		expected string
	}{
		{ID{Num: 0}, "0"},
		{ID{Num: -1}, "-1"},
		{ID{Str: "", IsString: true}, ""},
		{ID{Str: "test", IsString: true}, "test"},
	}

	for _, tt := range tests {
		if got := tt.id.String(); got != tt.expected {
			t.Errorf("ID.String() = %q, want %q", got, tt.expected)
		}
	}
}

// TestConcurrentIDGenerator 测试并发ID生成安全
func TestConcurrentIDGenerator(t *testing.T) {
	gen := NewIDGenerator()
	const numGoroutines = 100
	const numIDsPerGoroutine = 100

	var wg sync.WaitGroup
	idSet := make(map[int64]bool)
	var mu sync.Mutex

	for i := 0; i < numGoroutines; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			for j := 0; j < numIDsPerGoroutine; j++ {
				id := gen.Next()
				mu.Lock()
				if idSet[id.Num] {
					t.Errorf("ID重复: %d", id.Num)
				}
				idSet[id.Num] = true
				mu.Unlock()
			}
		}()
	}

	wg.Wait()

	expectedCount := numGoroutines * numIDsPerGoroutine
	if len(idSet) != expectedCount {
		t.Errorf("生成的ID数量不匹配: got %d, want %d", len(idSet), expectedCount)
	}
}

// TestConcurrentMessageReadWrite 测试并发消息读写安全
func TestConcurrentMessageReadWrite(t *testing.T) {
	pr, pw := io.Pipe()
	reader := NewMessageReader(pr)
	writer := NewMessageWriter(pw)

	const numMessages = 50
	var wg sync.WaitGroup

	// 并发写入
	wg.Add(1)
	go func() {
		defer wg.Done()
		for i := 0; i < numMessages; i++ {
			msg := []byte(fmt.Sprintf(`{"id":%d}`, i))
			if err := writer.WriteMessage(msg); err != nil {
				t.Errorf("写入消息失败: %v", err)
				return
			}
		}
	}()

	// 并发读取
	var readCount int
	wg.Add(1)
	go func() {
		defer wg.Done()
		for i := 0; i < numMessages; i++ {
			_, err := reader.ReadMessage()
			if err != nil {
				t.Errorf("读取消息失败: %v", err)
				return
			}
			readCount++
		}
	}()

	done := make(chan struct{})
	go func() {
		wg.Wait()
		close(done)
	}()

	select {
	case <-done:
		if readCount != numMessages {
			t.Errorf("读取消息数量不匹配: got %d, want %d", readCount, numMessages)
		}
	case <-time.After(10 * time.Second):
		t.Fatal("并发读写测试超时")
	}
}

// TestLSPClient_ConcurrentOperations 测试LSP客户端并发操作
func TestLSPClient_ConcurrentOperations(t *testing.T) {
	serverPath := buildMockServer(t)
	client := NewLSPClient()
	defer client.Stop()

	if err := client.Start(serverPath, nil); err != nil {
		t.Fatalf("启动失败: %v", err)
	}

	if _, err := client.Initialize("/tmp/test-workspace"); err != nil {
		t.Fatalf("初始化失败: %v", err)
	}

	var wg sync.WaitGroup

	// 并发发送多个文档通知
	for i := 0; i < 10; i++ {
		wg.Add(1)
		go func(idx int) {
			defer wg.Done()
			doc := &TextDocumentItem{
				URI:        DocumentURI(fmt.Sprintf("file:///tmp/test%d.go", idx)),
				LanguageID: "go",
				Version:    1,
				Text:       "package main\n",
			}
			if err := client.DidOpen(doc); err != nil {
				t.Errorf("DidOpen失败: %v", err)
			}
		}(i)
	}

	wg.Wait()
}

// TestProcessManager_CrashRecovery 测试进程异常退出处理
func TestProcessManager_CrashRecovery(t *testing.T) {
	// 创建一个会立即退出的假服务器
	tmpDir := t.TempDir()
	serverPath := filepath.Join(tmpDir, "crash_server")
	if runtime.GOOS == "windows" {
		serverPath += ".exe"
	}

	src := `package main
func main() {}`
	srcPath := filepath.Join(tmpDir, "crash.go")
	os.WriteFile(srcPath, []byte(src), 0644)
	cmd := exec.Command("go", "build", "-o", serverPath, srcPath)
	cmd.Run()

	pm := NewProcessManager(serverPath, nil)

	if err := pm.Start(); err != nil {
		t.Fatalf("启动失败: %v", err)
	}

	// 等待进程退出
	time.Sleep(500 * time.Millisecond)

	// 进程应该已经退出
	if pm.IsRunning() {
		t.Error("崩溃的进程不应处于运行状态")
	}
}

// TestProcessManager_InvalidServerPath 测试无效服务器路径
func TestProcessManager_InvalidServerPath(t *testing.T) {
	pm := NewProcessManager("/nonexistent/server", nil)

	err := pm.Start()
	if err == nil {
		t.Error("无效路径应返回错误")
	}
}

// TestDecodeNotification_Boundary 测试通知解码边界情况
func TestDecodeNotification_Boundary(t *testing.T) {
	tests := []struct {
		name    string
		data    []byte
		wantErr bool
	}{
		{
			name:    "空消息",
			data:    []byte(""),
			wantErr: true,
		},
		{
			name:    "只有空白字符",
			data:    []byte("   "),
			wantErr: true,
		},
		{
			name:    "缺少jsonrpc字段",
			data:    []byte(`{"method":"test"}`),
			wantErr: true,
		},
		{
			name:    "正确的通知",
			data:    []byte(`{"jsonrpc":"2.0","method":"test","params":{}}`),
			wantErr: false,
		},
		{
			name:    "包含ID的通知（不应该）",
			data:    []byte(`{"jsonrpc":"2.0","id":1,"method":"test"}`),
			wantErr: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			notif, err := DecodeNotification(tt.data)
			if tt.wantErr {
				if err == nil {
					t.Error("期望返回错误")
				}
				return
			}
			if err != nil {
				t.Errorf("不期望错误: %v", err)
				return
			}
			if notif.Method != "test" && len(tt.data) > 0 {
				t.Error("方法名不匹配")
			}
		})
	}
}

// TestEncodeRequest_NilParams 测试nil参数编码
func TestEncodeRequest_NilParams(t *testing.T) {
	id := ID{Num: 1}
	data, err := EncodeRequest(id, "test", nil)
	if err != nil {
		t.Fatalf("编码失败: %v", err)
	}

	var req Request
	if err := json.Unmarshal(data, &req); err != nil {
		t.Fatalf("解码失败: %v", err)
	}

	if req.Params != nil {
		t.Error("nil参数应保持为nil")
	}
}

// TestMessageReader_SlowConnection 测试慢连接场景
func TestMessageReader_SlowConnection(t *testing.T) {
	pr, pw := io.Pipe()
	reader := NewMessageReader(pr)

	msg := []byte(`{"jsonrpc":"2.0","id":1,"result":{}}`)
	header := fmt.Sprintf("Content-Length: %d\r\n\r\n", len(msg))

	done := make(chan []byte, 1)
	go func() {
		data, err := reader.ReadMessage()
		if err != nil {
			t.Errorf("读取失败: %v", err)
		}
		done <- data
	}()

	// 分多次写入，模拟慢连接
	go func() {
		for i := 0; i < len(header); i++ {
			pw.Write([]byte{header[i]})
			time.Sleep(1 * time.Millisecond)
		}
		for i := 0; i < len(msg); i++ {
			pw.Write([]byte{msg[i]})
			time.Sleep(1 * time.Millisecond)
		}
		pw.Close()
	}()

	select {
	case data := <-done:
		if string(data) != string(msg) {
			t.Error("消息不匹配")
		}
	case <-time.After(5 * time.Second):
		t.Fatal("慢连接测试超时")
	}
}

// TestRPCError_Nil 测试nil RPCError
func TestRPCError_Nil(t *testing.T) {
	var err *RPCError
	if err != nil {
		t.Error("nil RPCError应为false")
	}
}

// BenchmarkMessageReadWrite 基准测试消息读写
func BenchmarkMessageReadWrite(b *testing.B) {
	msg := []byte(`{"jsonrpc":"2.0","id":1,"method":"textDocument/hover","params":{"textDocument":{"uri":"file:///test.go"},"position":{"line":10,"character":5}}}`)

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		pr, pw := io.Pipe()
		reader := NewMessageReader(pr)
		writer := NewMessageWriter(pw)

		go writer.WriteMessage(msg)
		reader.ReadMessage()
		pr.Close()
	}
}

// BenchmarkDecodeResponse 基准测试响应解码
func BenchmarkDecodeResponse(b *testing.B) {
	result := json.RawMessage(`{"contents":{"kind":"markdown","value":"test"}}`)
	resp := Response{
		JSONRPC: "2.0",
		ID:      &ID{Num: 1},
		Result:  &result,
	}
	data, _ := json.Marshal(resp)

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		DecodeResponse(data)
	}
}

// buildMockServer 构建 mock 语言服务器
func buildMockServer(t *testing.T) string {
	t.Helper()

	// 创建临时目录
	tmpDir := t.TempDir()
	serverPath := filepath.Join(tmpDir, "mock_lsp_server")
	if runtime.GOOS == "windows" {
		serverPath += ".exe"
	}

	// mock 服务器源码
	src := `package main

import (
	"bufio"
	"encoding/json"
	"fmt"
	"os"
	"strconv"
	"strings"
)

type Request struct {
	JSONRPC string          ` + "`json:\"jsonrpc\"`" + `
	ID      interface{}     ` + "`json:\"id\"`" + `
	Method  string          ` + "`json:\"method\"`" + `
	Params  json.RawMessage ` + "`json:\"params\"`" + `
}

type Response struct {
	JSONRPC string      ` + "`json:\"jsonrpc\"`" + `
	ID      interface{} ` + "`json:\"id\"`" + `
	Result  interface{} ` + "`json:\"result,omitempty\"`" + `
	Error   *struct {
		Code    int    ` + "`json:\"code\"`" + `
		Message string ` + "`json:\"message\"`" + `
	} ` + "`json:\"error,omitempty\"`" + `
}

func main() {
	reader := bufio.NewReader(os.Stdin)
	
	for {
		// 读取 Content-Length
		var contentLength int
		for {
			line, err := reader.ReadString('\n')
			if err != nil {
				return
			}
			line = strings.TrimSpace(line)
			if line == "" {
				break
			}
			if strings.HasPrefix(line, "Content-Length:") {
				val := strings.TrimSpace(line[len("Content-Length:"):])
				contentLength, _ = strconv.Atoi(val)
			}
		}
		
		if contentLength == 0 {
			continue
		}
		
		// 读取消息体
		body := make([]byte, contentLength)
		_, err := reader.Read(body)
		if err != nil {
			return
		}
		
		var req Request
		if err := json.Unmarshal(body, &req); err != nil {
			continue
		}
		
		// 处理通知（无ID）
		if req.ID == nil {
			continue
		}
		
		var resp Response
		resp.JSONRPC = "2.0"
		resp.ID = req.ID
		
		switch req.Method {
		case "initialize":
			resp.Result = map[string]interface{}{
				"capabilities": map[string]interface{}{
					"textDocumentSync": map[string]interface{}{
						"openClose": true,
						"change":    2,
					},
					"completionProvider": map[string]interface{}{
						"resolveProvider":   false,
						"triggerCharacters": []string{".", ":"},
					},
					"hoverProvider":      true,
					"definitionProvider": true,
				},
				"serverInfo": map[string]interface{}{
					"name":    "mock-lsp-server",
					"version": "1.0.0",
				},
			}
		case "shutdown":
			resp.Result = nil
		default:
			resp.Error = &struct {
				Code    int    ` + "`json:\"code\"`" + `
				Message string ` + "`json:\"message\"`" + `
			}{
				Code:    -32601,
				Message: "Method not found: " + req.Method,
			}
		}
		
		respData, _ := json.Marshal(resp)
		header := fmt.Sprintf("Content-Length: %d\r\n\r\n", len(respData))
		os.Stdout.Write([]byte(header))
		os.Stdout.Write(respData)
		os.Stdout.Sync()
	}
}
`

	// 写入源码文件
	srcPath := filepath.Join(tmpDir, "mock_server.go")
	if err := os.WriteFile(srcPath, []byte(src), 0644); err != nil {
		t.Fatalf("写入mock服务器源码失败: %v", err)
	}

	// 编译
	cmd := exec.Command("go", "build", "-o", serverPath, srcPath)
	cmd.Env = os.Environ()
	output, err := cmd.CombinedOutput()
	if err != nil {
		t.Fatalf("编译mock服务器失败: %v\n输出: %s", err, string(output))
	}

	return serverPath
}

// TestClient_InitializeShutdown 测试客户端初始化和关闭流程
func TestClient_InitializeShutdown(t *testing.T) {
	serverPath := buildMockServer(t)

	client := NewLSPClient()
	defer client.Stop()

	// 测试启动
	t.Run("启动", func(t *testing.T) {
		if err := client.Start(serverPath, nil); err != nil {
			t.Fatalf("启动失败: %v", err)
		}

		if !client.IsRunning() {
			t.Error("客户端应处于运行状态")
		}

		if client.GetState() != ClientStateRunning {
			t.Errorf("状态错误: got %s, want running", client.GetState().String())
		}
	})

	// 测试初始化
	t.Run("初始化", func(t *testing.T) {
		result, err := client.Initialize("/tmp/test-workspace")
		if err != nil {
			t.Fatalf("初始化失败: %v", err)
		}

		if result.ServerInfo == nil {
			t.Fatal("ServerInfo不应为空")
		}

		if result.ServerInfo.Name != "mock-lsp-server" {
			t.Errorf("服务器名称错误: got %s, want mock-lsp-server", result.ServerInfo.Name)
		}

		if !client.IsInitialized() {
			t.Error("客户端应已初始化")
		}

		// 验证服务器能力
		caps := client.GetServerCapabilities()
		if caps.HoverProvider != true {
			t.Error("HoverProvider应为true")
		}
		if caps.DefinitionProvider != true {
			t.Error("DefinitionProvider应为true")
		}
	})

	// 测试关闭
	t.Run("关闭", func(t *testing.T) {
		if err := client.Shutdown(); err != nil {
			t.Fatalf("关闭失败: %v", err)
		}

		if client.IsInitialized() {
			t.Error("客户端应未初始化")
		}
	})

	// 测试停止
	t.Run("停止", func(t *testing.T) {
		if err := client.Stop(); err != nil {
			t.Fatalf("停止失败: %v", err)
		}

		if client.IsRunning() {
			t.Error("客户端应已停止")
		}
	})
}

// TestClient_StopWhenNotRunning 测试停止未运行的客户端
func TestClient_StopWhenNotRunning(t *testing.T) {
	client := NewLSPClient()

	if err := client.Stop(); err != nil {
		t.Errorf("停止未运行的客户端不应返回错误: %v", err)
	}
}

// TestClient_DoubleStart 测试重复启动
func TestClient_DoubleStart(t *testing.T) {
	serverPath := buildMockServer(t)

	client := NewLSPClient()
	defer client.Stop()

	if err := client.Start(serverPath, nil); err != nil {
		t.Fatalf("首次启动失败: %v", err)
	}

	// 重复启动应返回错误
	if err := client.Start(serverPath, nil); err == nil {
		t.Error("重复启动应返回错误")
	}
}

// TestClient_InitializeWithoutStart 测试未启动时初始化
func TestClient_InitializeWithoutStart(t *testing.T) {
	client := NewLSPClient()

	_, err := client.Initialize("/tmp/test")
	if err == nil {
		t.Error("未启动时初始化应返回错误")
	}
}

// TestClient_DidOpenCloseChange 测试文档操作通知
func TestClient_DidOpenCloseChange(t *testing.T) {
	serverPath := buildMockServer(t)

	client := NewLSPClient()
	defer client.Stop()

	if err := client.Start(serverPath, nil); err != nil {
		t.Fatalf("启动失败: %v", err)
	}

	if _, err := client.Initialize("/tmp/test-workspace"); err != nil {
		t.Fatalf("初始化失败: %v", err)
	}

	// 测试 DidOpen
	doc := &TextDocumentItem{
		URI:        "file:///tmp/test.go",
		LanguageID: "go",
		Version:    1,
		Text:       "package main\n",
	}

	if err := client.DidOpen(doc); err != nil {
		t.Errorf("DidOpen失败: %v", err)
	}

	// 测试 DidChange
	changes := []TextDocumentContentChangeEvent{
		{
			Text: "package main\n\nfunc main() {}\n",
		},
	}

	if err := client.DidChange(doc.URI, 2, changes); err != nil {
		t.Errorf("DidChange失败: %v", err)
	}

	// 测试 DidClose
	if err := client.DidClose(doc.URI); err != nil {
		t.Errorf("DidClose失败: %v", err)
	}
}

// TestClient_Restart 测试重启功能
func TestClient_Restart(t *testing.T) {
	serverPath := buildMockServer(t)

	client := NewLSPClient()
	defer client.Stop()

	// 启动并初始化
	if err := client.Start(serverPath, nil); err != nil {
		t.Fatalf("启动失败: %v", err)
	}

	if _, err := client.Initialize("/tmp/test-workspace"); err != nil {
		t.Fatalf("初始化失败: %v", err)
	}

	// 重启
	if err := client.Restart(); err != nil {
		t.Fatalf("重启失败: %v", err)
	}

	if !client.IsRunning() {
		t.Error("重启后客户端应处于运行状态")
	}
}

// TestProcessManager_StartStop 测试进程管理器启动和停止
func TestProcessManager_StartStop(t *testing.T) {
	serverPath := buildMockServer(t)

	pm := NewProcessManager(serverPath, nil)

	// 启动
	if err := pm.Start(); err != nil {
		t.Fatalf("启动失败: %v", err)
	}

	if !pm.IsRunning() {
		t.Error("进程应处于运行状态")
	}

	// 停止
	if err := pm.Stop(); err != nil {
		t.Fatalf("停止失败: %v", err)
	}

	// 等待进程完全退出
	time.Sleep(100 * time.Millisecond)

	if pm.IsRunning() {
		t.Error("进程应已停止")
	}
}

// TestProcessManager_Restart 测试进程管理器重启
func TestProcessManager_Restart(t *testing.T) {
	serverPath := buildMockServer(t)

	pm := NewProcessManager(serverPath, nil)

	if err := pm.Start(); err != nil {
		t.Fatalf("启动失败: %v", err)
	}

	if err := pm.Restart(); err != nil {
		t.Fatalf("重启失败: %v", err)
	}

	if !pm.IsRunning() {
		t.Error("重启后进程应处于运行状态")
	}

	pm.Stop()
}

// TestProcessManager_DoubleStart 测试重复启动进程
func TestProcessManager_DoubleStart(t *testing.T) {
	serverPath := buildMockServer(t)

	pm := NewProcessManager(serverPath, nil)
	defer pm.Stop()

	if err := pm.Start(); err != nil {
		t.Fatalf("首次启动失败: %v", err)
	}

	if err := pm.Start(); err == nil {
		t.Error("重复启动应返回错误")
	}
}

// TestTypes_InitializeParams 测试类型定义
func TestTypes_InitializeParams(t *testing.T) {
	params := InitializeParams{
		RootURI: "file:///tmp/test",
		Capabilities: ClientCapabilities{
			Workspace: WorkspaceClientCapabilities{
				ApplyEdit: true,
			},
		},
	}

	data, err := json.Marshal(params)
	if err != nil {
		t.Fatalf("序列化失败: %v", err)
	}

	var decoded InitializeParams
	if err := json.Unmarshal(data, &decoded); err != nil {
		t.Fatalf("反序列化失败: %v", err)
	}

	if decoded.RootURI != params.RootURI {
		t.Errorf("RootURI不匹配")
	}
}

// TestTypes_ServerCapabilities 测试服务器能力类型
func TestTypes_ServerCapabilities(t *testing.T) {
	caps := ServerCapabilities{
		HoverProvider:      true,
		DefinitionProvider: true,
		TextDocumentSync: &TextDocumentSyncOptions{
			OpenClose: true,
			Change:    2,
		},
	}

	data, err := json.Marshal(caps)
	if err != nil {
		t.Fatalf("序列化失败: %v", err)
	}

	var decoded ServerCapabilities
	if err := json.Unmarshal(data, &decoded); err != nil {
		t.Fatalf("反序列化失败: %v", err)
	}

	if !decoded.HoverProvider {
		t.Error("HoverProvider应为true")
	}
	if decoded.TextDocumentSync == nil {
		t.Fatal("TextDocumentSync不应为空")
	}
	if decoded.TextDocumentSync.Change != 2 {
		t.Errorf("Change值错误")
	}
}

// TestTypes_PositionRange 测试位置和范围类型
func TestTypes_PositionRange(t *testing.T) {
	pos := Position{Line: 10, Character: 5}
	r := Range{Start: pos, End: Position{Line: 10, Character: 10}}

	data, err := json.Marshal(r)
	if err != nil {
		t.Fatalf("序列化失败: %v", err)
	}

	var decoded Range
	if err := json.Unmarshal(data, &decoded); err != nil {
		t.Fatalf("反序列化失败: %v", err)
	}

	if decoded.Start.Line != 10 {
		t.Errorf("行号错误")
	}
	if decoded.End.Character != 10 {
		t.Errorf("字符位置错误")
	}
}

// TestTypes_Diagnostic 测试诊断类型
func TestTypes_Diagnostic(t *testing.T) {
	diag := Diagnostic{
		Range: Range{
			Start: Position{Line: 0, Character: 0},
			End:   Position{Line: 0, Character: 5},
		},
		Severity: Error,
		Message:  "test error",
		Source:   "test",
	}

	data, err := json.Marshal(diag)
	if err != nil {
		t.Fatalf("序列化失败: %v", err)
	}

	var decoded Diagnostic
	if err := json.Unmarshal(data, &decoded); err != nil {
		t.Fatalf("反序列化失败: %v", err)
	}

	if decoded.Severity != Error {
		t.Errorf("严重程度错误")
	}
	if decoded.Message != "test error" {
		t.Errorf("消息错误")
	}
}

// TestJSONRPC_ID 测试 ID 序列化和反序列化
func TestJSONRPC_ID(t *testing.T) {
	tests := []struct {
		name     string
		id       ID
		expected string
	}{
		{"数字ID", ID{Num: 1}, "1"},
		{"字符串ID", ID{Str: "abc", IsString: true}, "abc"},
		{"大数字", ID{Num: 999999}, "999999"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// 测试序列化
			data, err := json.Marshal(tt.id)
			if err != nil {
				t.Fatalf("序列化失败: %v", err)
			}

			// 测试反序列化
			var decoded ID
			if err := json.Unmarshal(data, &decoded); err != nil {
				t.Fatalf("反序列化失败: %v", err)
			}

			if !decoded.Equal(tt.id) {
				t.Errorf("ID不匹配: got %+v, want %+v", decoded, tt.id)
			}

			if decoded.String() != tt.expected {
				t.Errorf("String()不匹配: got %s, want %s", decoded.String(), tt.expected)
			}
		})
	}
}

// TestJSONRPC_EncodeDecode 测试 JSON-RPC 消息编码解码
func TestJSONRPC_EncodeDecode(t *testing.T) {
	t.Run("请求编码", func(t *testing.T) {
		id := ID{Num: 1}
		params := map[string]string{"key": "value"}
		data, err := EncodeRequest(id, "test/method", params)
		if err != nil {
			t.Fatalf("编码请求失败: %v", err)
		}

		var req Request
		if err := json.Unmarshal(data, &req); err != nil {
			t.Fatalf("解码请求失败: %v", err)
		}

		if req.JSONRPC != "2.0" {
			t.Errorf("JSONRPC版本错误: got %s, want 2.0", req.JSONRPC)
		}
		if req.Method != "test/method" {
			t.Errorf("方法错误: got %s, want test/method", req.Method)
		}
		if req.ID == nil || req.ID.Num != 1 {
			t.Error("ID错误")
		}
	})

	t.Run("通知编码", func(t *testing.T) {
		params := map[string]string{"key": "value"}
		data, err := EncodeNotification("test/notification", params)
		if err != nil {
			t.Fatalf("编码通知失败: %v", err)
		}

		var notif Notification
		if err := json.Unmarshal(data, &notif); err != nil {
			t.Fatalf("解码通知失败: %v", err)
		}

		if notif.JSONRPC != "2.0" {
			t.Errorf("JSONRPC版本错误: got %s, want 2.0", notif.JSONRPC)
		}
		if notif.Method != "test/notification" {
			t.Errorf("方法错误: got %s, want test/notification", notif.Method)
		}
	})

	t.Run("响应解码", func(t *testing.T) {
		result := json.RawMessage(`{"key":"value"}`)
		resp := Response{
			JSONRPC: "2.0",
			ID:      &ID{Num: 1},
			Result:  &result,
		}
		data, _ := json.Marshal(resp)

		decoded, err := DecodeResponse(data)
		if err != nil {
			t.Fatalf("解码响应失败: %v", err)
		}

		if decoded.ID == nil || decoded.ID.Num != 1 {
			t.Error("ID错误")
		}
		if decoded.Result == nil {
			t.Error("Result不应为空")
		}
	})

	t.Run("错误响应解码", func(t *testing.T) {
		resp := Response{
			JSONRPC: "2.0",
			ID:      &ID{Num: 1},
			Error:   &RPCError{Code: -32600, Message: "Invalid Request"},
		}
		data, _ := json.Marshal(resp)

		decoded, err := DecodeResponse(data)
		if err != nil {
			t.Fatalf("解码响应失败: %v", err)
		}

		if decoded.Error == nil {
			t.Fatal("Error不应为空")
		}
		if decoded.Error.Code != -32600 {
			t.Errorf("错误码错误: got %d, want -32600", decoded.Error.Code)
		}
	})

	t.Run("通知判断", func(t *testing.T) {
		// 通知消息（无ID）
		notifData := []byte(`{"jsonrpc":"2.0","method":"test"}`)
		if !IsNotification(notifData) {
			t.Error("应识别为通知")
		}

		// 请求消息（有ID）
		reqData := []byte(`{"jsonrpc":"2.0","id":1,"method":"test"}`)
		if IsNotification(reqData) {
			t.Error("不应识别为通知")
		}
	})
}

// TestJSONRPC_MessageReadWrite 测试消息读写
func TestJSONRPC_MessageReadWrite(t *testing.T) {
	pr, pw := io.Pipe()
	reader := NewMessageReader(pr)
	writer := NewMessageWriter(pw)

	msg := []byte(`{"jsonrpc":"2.0","id":1,"result":{}}`)

	// 在协程中读取
	done := make(chan []byte, 1)
	go func() {
		data, err := reader.ReadMessage()
		if err != nil {
			t.Errorf("读取消息失败: %v", err)
		}
		done <- data
	}()

	// 写入消息
	if err := writer.WriteMessage(msg); err != nil {
		t.Fatalf("写入消息失败: %v", err)
	}

	// 等待读取完成
	select {
	case data := <-done:
		if string(data) != string(msg) {
			t.Errorf("消息不匹配: got %s, want %s", string(data), string(msg))
		}
	case <-time.After(2 * time.Second):
		t.Fatal("读取超时")
	}
}

// TestMessageReader_InvalidHeader 测试无效消息头
func TestMessageReader_InvalidHeader(t *testing.T) {
	pr, pw := io.Pipe()
	reader := NewMessageReader(pr)

	go func() {
		pw.Write([]byte("Invalid Header\r\n\r\n{}"))
		pw.Close()
	}()

	_, err := reader.ReadMessage()
	if err == nil {
		t.Error("应返回错误")
	}
}

// TestIDGenerator 测试 ID 生成器
func TestIDGenerator(t *testing.T) {
	gen := NewIDGenerator()

	id1 := gen.Next()
	id2 := gen.Next()
	id3 := gen.Next()

	if id1.Num != 1 {
		t.Errorf("第一个ID应为1, got %d", id1.Num)
	}
	if id2.Num != 2 {
		t.Errorf("第二个ID应为2, got %d", id2.Num)
	}
	if id3.Num != 3 {
		t.Errorf("第三个ID应为3, got %d", id3.Num)
	}
}

// TestClientState_String 测试客户端状态字符串
func TestClientState_String(t *testing.T) {
	tests := []struct {
		state    ClientState
		expected string
	}{
		{ClientStateStopped, "stopped"},
		{ClientStateStarting, "starting"},
		{ClientStateRunning, "running"},
		{ClientStateStopping, "stopping"},
		{ClientState(99), "unknown"},
	}

	for _, tt := range tests {
		if got := tt.state.String(); got != tt.expected {
			t.Errorf("ClientState(%d).String() = %s, want %s", tt.state, got, tt.expected)
		}
	}
}

// TestRPCError_Error 测试 RPC 错误接口
func TestRPCError_Error(t *testing.T) {
	err := &RPCError{Code: -32600, Message: "Invalid Request"}
	expected := "JSON-RPC error -32600: Invalid Request"
	if got := err.Error(); got != expected {
		t.Errorf("Error() = %s, want %s", got, expected)
	}
}

// BenchmarkIDGenerator 基准测试 ID 生成器
func BenchmarkIDGenerator(b *testing.B) {
	gen := NewIDGenerator()
	b.RunParallel(func(pb *testing.PB) {
		for pb.Next() {
			gen.Next()
		}
	})
}

// BenchmarkEncodeRequest 基准测试请求编码
func BenchmarkEncodeRequest(b *testing.B) {
	id := ID{Num: 1}
	params := map[string]string{"key": "value"}
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		EncodeRequest(id, "test/method", params)
	}
}

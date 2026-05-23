package lsp

import (
	"bufio"
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"strconv"
	"sync"
	"sync/atomic"
)

// 本文件实现 JSON-RPC 2.0 协议通信层
// 参考规范: https://www.jsonrpc.org/specification

// Request JSON-RPC 请求消息
type Request struct {
	// JSONRPC 协议版本，必须为 "2.0"
	JSONRPC string `json:"jsonrpc"`
	// ID 请求标识符（通知可为null）
	ID *ID `json:"id,omitempty"`
	// Method 请求方法名
	Method string `json:"method"`
	// Params 请求参数
	Params interface{} `json:"params,omitempty"`
}

// Response JSON-RPC 响应消息
type Response struct {
	// JSONRPC 协议版本，必须为 "2.0"
	JSONRPC string `json:"jsonrpc"`
	// ID 对应请求的标识符
	ID *ID `json:"id"`
	// Result 成功结果（与Error互斥）
	Result *json.RawMessage `json:"result,omitempty"`
	// Error 错误信息（与Result互斥）
	Error *RPCError `json:"error,omitempty"`
}

// Notification JSON-RPC 通知消息（无ID）
type Notification struct {
	// JSONRPC 协议版本，必须为 "2.0"
	JSONRPC string `json:"jsonrpc"`
	// Method 通知方法名
	Method string `json:"method"`
	// Params 通知参数
	Params interface{} `json:"params,omitempty"`
}

// RPCError JSON-RPC 错误对象
type RPCError struct {
	// Code 错误码
	Code int `json:"code"`
	// Message 错误消息
	Message string `json:"message"`
	// Data 附加错误数据（可选）
	Data interface{} `json:"data,omitempty"`
}

// Error 实现 error 接口
func (e *RPCError) Error() string {
	return fmt.Sprintf("JSON-RPC error %d: %s", e.Code, e.Message)
}

// 标准 JSON-RPC 错误码
const (
	// ParseError 解析错误（-32700）
	ParseError = -32700
	// InvalidRequest 无效请求（-32600）
	InvalidRequest = -32600
	// MethodNotFound 方法不存在（-32601）
	MethodNotFound = -32601
	// InvalidParams 无效参数（-32602）
	InvalidParams = -32602
	// InternalError 内部错误（-32603）
	InternalError = -32603
	// ServerErrorStart 服务器错误起始（-32099）
	ServerErrorStart = -32099
	// ServerErrorEnd 服务器错误结束（-32000）
	ServerErrorEnd = -32000
)

// ID JSON-RPC 消息标识符（支持字符串或整数）
type ID struct {
	// Num 数字ID（优先使用）
	Num int64
	// Str 字符串ID
	Str string
	// IsString 是否为字符串类型
	IsString bool
}

// MarshalJSON 实现自定义JSON序列化
func (id ID) MarshalJSON() ([]byte, error) {
	if id.IsString {
		return json.Marshal(id.Str)
	}
	return json.Marshal(id.Num)
}

// UnmarshalJSON 实现自定义JSON反序列化
func (id *ID) UnmarshalJSON(data []byte) error {
	// 尝试解析为字符串
	var s string
	if err := json.Unmarshal(data, &s); err == nil {
		id.Str = s
		id.IsString = true
		return nil
	}
	// 尝试解析为数字
	var n int64
	if err := json.Unmarshal(data, &n); err != nil {
		return fmt.Errorf("ID必须是字符串或整数: %w", err)
	}
	id.Num = n
	id.IsString = false
	return nil
}

// String 返回ID的字符串表示
func (id ID) String() string {
	if id.IsString {
		return id.Str
	}
	return strconv.FormatInt(id.Num, 10)
}

// Equal 比较两个ID是否相等
func (id ID) Equal(other ID) bool {
	if id.IsString != other.IsString {
		return false
	}
	if id.IsString {
		return id.Str == other.Str
	}
	return id.Num == other.Num
}

// IDGenerator 消息ID生成器
type IDGenerator struct {
	counter atomic.Int64
}

// NewIDGenerator 创建新的ID生成器
func NewIDGenerator() *IDGenerator {
	return &IDGenerator{}
}

// Next 生成下一个ID
func (g *IDGenerator) Next() ID {
	return ID{Num: g.counter.Add(1)}
}

// MessageReader JSON-RPC 消息读取器
// LSP 使用 Length-Prefixed Message 格式:
// Content-Length: <num>\r\n\r\n<json>
type MessageReader struct {
	reader *bufio.Reader
	mu     sync.Mutex
}

// NewMessageReader 创建消息读取器
func NewMessageReader(r io.Reader) *MessageReader {
	return &MessageReader{reader: bufio.NewReader(r)}
}

// ReadMessage 读取一条JSON-RPC消息
func (r *MessageReader) ReadMessage() ([]byte, error) {
	r.mu.Lock()
	defer r.mu.Unlock()

	var contentLength int

	// 读取头部
	for {
		line, err := r.reader.ReadString('\n')
		if err != nil {
			return nil, fmt.Errorf("读取消息头失败: %w", err)
		}

		// 空行表示头部结束
		if line == "\r\n" || line == "\n" {
			break
		}

		// 解析 Content-Length
		if bytes.HasPrefix([]byte(line), []byte("Content-Length:")) {
			val := bytes.TrimSpace([]byte(line[len("Content-Length:"):]))
			length, err := strconv.Atoi(string(val))
			if err != nil {
				return nil, fmt.Errorf("解析Content-Length失败: %w", err)
			}
			contentLength = length
		}
	}

	if contentLength == 0 {
		return nil, fmt.Errorf("消息缺少Content-Length头")
	}

	// 读取消息体
	body := make([]byte, contentLength)
	_, err := io.ReadFull(r.reader, body)
	if err != nil {
		return nil, fmt.Errorf("读取消息体失败: %w", err)
	}

	return body, nil
}

// MessageWriter JSON-RPC 消息写入器
type MessageWriter struct {
	writer io.Writer
	mu     sync.Mutex
}

// NewMessageWriter 创建消息写入器
func NewMessageWriter(w io.Writer) *MessageWriter {
	return &MessageWriter{writer: w}
}

// WriteMessage 写入一条JSON-RPC消息
func (w *MessageWriter) WriteMessage(data []byte) error {
	w.mu.Lock()
	defer w.mu.Unlock()

	// 构建 LSP 消息格式
	header := fmt.Sprintf("Content-Length: %d\r\n\r\n", len(data))

	if _, err := w.writer.Write([]byte(header)); err != nil {
		return fmt.Errorf("写入消息头失败: %w", err)
	}
	if _, err := w.writer.Write(data); err != nil {
		return fmt.Errorf("写入消息体失败: %w", err)
	}

	return nil
}

// EncodeRequest 编码请求消息
func EncodeRequest(id ID, method string, params interface{}) ([]byte, error) {
	req := Request{
		JSONRPC: "2.0",
		ID:      &id,
		Method:  method,
		Params:  params,
	}
	return json.Marshal(req)
}

// EncodeNotification 编码通知消息
func EncodeNotification(method string, params interface{}) ([]byte, error) {
	notif := Notification{
		JSONRPC: "2.0",
		Method:  method,
		Params:  params,
	}
	return json.Marshal(notif)
}

// DecodeResponse 解码响应消息
func DecodeResponse(data []byte) (*Response, error) {
	var resp Response
	if err := json.Unmarshal(data, &resp); err != nil {
		return nil, fmt.Errorf("解码响应失败: %w", err)
	}
	if resp.JSONRPC != "2.0" {
		return nil, fmt.Errorf("无效的JSON-RPC版本: %s", resp.JSONRPC)
	}
	return &resp, nil
}

// DecodeNotification 解码通知消息
func DecodeNotification(data []byte) (*Notification, error) {
	var notif Notification
	if err := json.Unmarshal(data, &notif); err != nil {
		return nil, fmt.Errorf("解码通知失败: %w", err)
	}
	if notif.JSONRPC != "2.0" {
		return nil, fmt.Errorf("无效的JSON-RPC版本: %s", notif.JSONRPC)
	}
	return &notif, nil
}

// IsNotification 判断消息是否为通知（无ID字段）
func IsNotification(data []byte) bool {
	var msg struct {
		ID interface{} `json:"id"`
	}
	json.Unmarshal(data, &msg)
	return msg.ID == nil
}

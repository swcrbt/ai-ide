package ai

import (
	"context"
	"database/sql"
	"fmt"
	"strings"
	"sync"
	"time"

	"github.com/google/uuid"
	"github.com/swcrbt/ai-ide/internal/config"
)

// ChatSession 对话会话
type ChatSession struct {
	mu       sync.RWMutex
	id       string
	title    string
	messages []Message
	provider *ProviderConfig
	client   *AIClient
	manager  *ProviderManager
}

// NewChatSession 创建新的对话会话
func NewChatSession(manager *ProviderManager) (*ChatSession, error) {
	// 获取最佳可用 Provider
	providerConfig, err := manager.GetBestProvider()
	if err != nil {
		return nil, err
	}

	session := &ChatSession{
		id:       uuid.New().String(),
		title:    "新对话",
		messages: make([]Message, 0),
		provider: providerConfig,
		client:   NewAIClient(providerConfig),
		manager:  manager,
	}

	// 保存会话信息到数据库
	if err := session.saveSessionToDB(); err != nil {
		// 数据库保存失败不影响会话创建
		_ = err
	}

	return session, nil
}

// NewChatSessionWithProvider 使用指定 Provider 创建对话会话
func NewChatSessionWithProvider(manager *ProviderManager, provider Provider) (*ChatSession, error) {
	providerConfig, ok := manager.GetConfig(provider)
	if !ok {
		return nil, fmt.Errorf("Provider %s 未配置", provider.String())
	}

	if err := manager.ValidateConfig(provider); err != nil {
		return nil, err
	}

	session := &ChatSession{
		id:       uuid.New().String(),
		title:    "新对话",
		messages: make([]Message, 0),
		provider: providerConfig,
		client:   NewAIClient(providerConfig),
		manager:  manager,
	}

	if err := session.saveSessionToDB(); err != nil {
		_ = err
	}

	return session, nil
}

// GetID 获取会话 ID
func (s *ChatSession) GetID() string {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.id
}

// GetTitle 获取会话标题
func (s *ChatSession) GetTitle() string {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.title
}

// SetTitle 设置会话标题
func (s *ChatSession) SetTitle(title string) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.title = title
}

// GetMessages 获取对话历史（副本）
func (s *ChatSession) GetMessages() []Message {
	s.mu.RLock()
	defer s.mu.RUnlock()

	copy := make([]Message, len(s.messages))
	for i, msg := range s.messages {
		copy[i] = msg
	}
	return copy
}

// GetProvider 获取当前使用的 Provider
func (s *ChatSession) GetProvider() *ProviderConfig {
	s.mu.RLock()
	defer s.mu.RUnlock()
	copy := *s.provider
	return &copy
}

// SwitchProvider 切换当前会话使用的 Provider
func (s *ChatSession) SwitchProvider(provider Provider) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	providerConfig, ok := s.manager.GetConfig(provider)
	if !ok {
		return fmt.Errorf("Provider %s 未配置", provider.String())
	}

	if err := s.manager.ValidateConfig(provider); err != nil {
		return err
	}

	s.provider = providerConfig
	s.client = NewAIClient(providerConfig)
	return nil
}

// SendMessage 发送消息并获取流式响应
func (s *ChatSession) SendMessage(ctx context.Context, content string) (<-chan StreamChunk, error) {
	s.mu.Lock()
	// 添加用户消息到历史
	userMsg := Message{Role: RoleUser, Content: content}
	s.messages = append(s.messages, userMsg)

	// 构建请求
	req := ChatRequest{
		Model:    s.provider.Model,
		Messages: s.messages,
		Stream:   true,
		Temperature: 0.7,
		MaxTokens: 4096,
	}
	s.mu.Unlock()

	// 保存用户消息到数据库
	_ = s.saveMessageToDB(userMsg)

	// 发送流式请求
	stream, err := s.client.ChatCompletion(ctx, req)
	if err != nil {
		return nil, err
	}

	// 包装流式响应，收集完整内容并保存助手回复
	return s.wrapStream(ctx, stream, content), nil
}

// wrapStream 包装流式响应通道，在结束时保存助手回复
func (s *ChatSession) wrapStream(ctx context.Context, stream <-chan StreamChunk, userContent string) <-chan StreamChunk {
	wrapped := make(chan StreamChunk, 10)

	go func() {
		defer close(wrapped)

		var fullContent strings.Builder
		for chunk := range stream {
			select {
			case <-ctx.Done():
				wrapped <- StreamChunk{Error: ctx.Err()}
				return
			default:
			}

			if chunk.Content != "" {
				fullContent.WriteString(chunk.Content)
			}

			// 转发原始 chunk
			wrapped <- chunk

			if chunk.Done || chunk.Error != nil {
				break
			}
		}

		// 保存助手回复到历史
		if fullContent.Len() > 0 {
			assistantMsg := Message{Role: RoleAssistant, Content: fullContent.String()}
			s.mu.Lock()
			s.messages = append(s.messages, assistantMsg)
			s.mu.Unlock()

			_ = s.saveMessageToDB(assistantMsg)

			// 更新标题（如果是第一次对话）
			s.updateTitleIfNeeded(userContent)
		}
	}()

	return wrapped
}

// updateTitleIfNeeded 如果会话标题是默认标题，使用用户第一条消息更新
func (s *ChatSession) updateTitleIfNeeded(content string) {
	s.mu.Lock()
	defer s.mu.Unlock()

	if s.title != "新对话" {
		return
	}

	// 使用消息前 20 个字符作为标题
	title := content
	if len([]rune(title)) > 20 {
		runes := []rune(title)
		title = string(runes[:20]) + "..."
	}
	s.title = title

	// 更新数据库中的标题
	_ = s.updateTitleInDB(title)
}

// ClearHistory 清空对话历史
func (s *ChatSession) ClearHistory() {
	s.mu.Lock()
	defer s.mu.Unlock()

	s.messages = make([]Message, 0)
}

// GetMessageCount 获取消息数量
func (s *ChatSession) GetMessageCount() int {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return len(s.messages)
}

// saveMessageToDB 保存单条消息到数据库
func (s *ChatSession) saveMessageToDB(msg Message) error {
	if config.DB == nil {
		return fmt.Errorf("数据库未初始化")
	}

	_, err := config.DB.Exec(
		`INSERT INTO conversations (session_id, role, content, provider, created_at)
		 VALUES (?, ?, ?, ?, ?)`,
		s.id, string(msg.Role), msg.Content, s.provider.Provider.String(), time.Now().Format(time.RFC3339),
	)
	return err
}

// saveSessionToDB 保存会话信息到数据库
func (s *ChatSession) saveSessionToDB() error {
	if config.DB == nil {
		return fmt.Errorf("数据库未初始化")
	}

	_, err := config.DB.Exec(
		`INSERT INTO chat_sessions (id, title, provider, model, created_at, updated_at)
		 VALUES (?, ?, ?, ?, ?, ?)`,
		s.id, s.title, s.provider.Provider.String(), s.provider.Model,
		time.Now().Format(time.RFC3339), time.Now().Format(time.RFC3339),
	)
	return err
}

// updateTitleInDB 更新数据库中的会话标题
func (s *ChatSession) updateTitleInDB(title string) error {
	if config.DB == nil {
		return fmt.Errorf("数据库未初始化")
	}

	_, err := config.DB.Exec(
		`UPDATE chat_sessions SET title = ?, updated_at = ? WHERE id = ?`,
		title, time.Now().Format(time.RFC3339), s.id,
	)
	return err
}

// LoadSessionFromDB 从数据库加载会话历史
func (s *ChatSession) LoadSessionFromDB() error {
	if config.DB == nil {
		return fmt.Errorf("数据库未初始化")
	}

	rows, err := config.DB.Query(
		`SELECT role, content, provider, created_at FROM conversations
		 WHERE session_id = ? ORDER BY created_at ASC`,
		s.id,
	)
	if err != nil {
		return fmt.Errorf("查询对话历史失败: %w", err)
	}
	defer rows.Close()

	s.mu.Lock()
	defer s.mu.Unlock()

	s.messages = make([]Message, 0)
	for rows.Next() {
		var role, content, providerStr, createdAt string
		if err := rows.Scan(&role, &content, &providerStr, &createdAt); err != nil {
			continue
		}
		s.messages = append(s.messages, Message{
			Role:    MessageRole(role),
			Content: content,
		})
	}

	return rows.Err()
}

// ChatHistoryManager 对话历史管理器
type ChatHistoryManager struct {
	mu       sync.RWMutex
	sessions map[string]*ChatSession
	manager  *ProviderManager
}

// NewChatHistoryManager 创建新的对话历史管理器
func NewChatHistoryManager(manager *ProviderManager) *ChatHistoryManager {
	return &ChatHistoryManager{
		sessions: make(map[string]*ChatSession),
		manager:  manager,
	}
}

// CreateSession 创建新会话
func (hm *ChatHistoryManager) CreateSession() (*ChatSession, error) {
	session, err := NewChatSession(hm.manager)
	if err != nil {
		return nil, err
	}

	hm.mu.Lock()
	defer hm.mu.Unlock()
	hm.sessions[session.GetID()] = session

	return session, nil
}

// GetSession 获取指定 ID 的会话
func (hm *ChatHistoryManager) GetSession(id string) (*ChatSession, bool) {
	hm.mu.RLock()
	defer hm.mu.RUnlock()

	session, ok := hm.sessions[id]
	return session, ok
}

// RemoveSession 移除会话
func (hm *ChatHistoryManager) RemoveSession(id string) {
	hm.mu.Lock()
	defer hm.mu.Unlock()

	delete(hm.sessions, id)
}

// ListSessions 列出所有会话信息
func (hm *ChatHistoryManager) ListSessions() []ChatSessionInfo {
	hm.mu.RLock()
	defer hm.mu.RUnlock()

	var infos []ChatSessionInfo
	for _, session := range hm.sessions {
		infos = append(infos, ChatSessionInfo{
			ID:        session.GetID(),
			Title:     session.GetTitle(),
			Provider:  session.GetProvider().Provider.String(),
			Model:     session.GetProvider().Model,
			CreatedAt: time.Now().Format(time.RFC3339),
			UpdatedAt: time.Now().Format(time.RFC3339),
		})
	}

	return infos
}

// LoadAllSessionsFromDB 从数据库加载所有会话
func (hm *ChatHistoryManager) LoadAllSessionsFromDB() error {
	if config.DB == nil {
		return fmt.Errorf("数据库未初始化")
	}

	rows, err := config.DB.Query(
		`SELECT id, title, provider, model, created_at, updated_at FROM chat_sessions
		 ORDER BY updated_at DESC`,
	)
	if err != nil {
		return fmt.Errorf("查询会话列表失败: %w", err)
	}
	defer rows.Close()

	hm.mu.Lock()
	defer hm.mu.Unlock()

	for rows.Next() {
		var id, title, providerStr, model, createdAt, updatedAt string
		if err := rows.Scan(&id, &title, &providerStr, &model, &createdAt, &updatedAt); err != nil {
			continue
		}

		provider, _ := ProviderFromString(providerStr)
		providerConfig, ok := hm.manager.GetConfig(provider)
		if !ok {
			continue
		}

		session := &ChatSession{
			id:       id,
			title:    title,
			messages: make([]Message, 0),
			provider: providerConfig,
			client:   NewAIClient(providerConfig),
			manager:  hm.manager,
		}

		// 加载历史消息
		_ = session.LoadSessionFromDB()

		hm.sessions[id] = session
	}

	return rows.Err()
}

// DeleteSessionFromDB 从数据库删除会话及其历史
func DeleteSessionFromDB(sessionID string) error {
	if config.DB == nil {
		return fmt.Errorf("数据库未初始化")
	}

	tx, err := config.DB.Begin()
	if err != nil {
		return fmt.Errorf("开启事务失败: %w", err)
	}
	defer tx.Rollback()

	if _, err := tx.Exec(`DELETE FROM conversations WHERE session_id = ?`, sessionID); err != nil {
		return fmt.Errorf("删除对话记录失败: %w", err)
	}

	if _, err := tx.Exec(`DELETE FROM chat_sessions WHERE id = ?`, sessionID); err != nil {
		return fmt.Errorf("删除会话记录失败: %w", err)
	}

	return tx.Commit()
}

// GetSessionHistoryFromDB 从数据库获取指定会话的历史记录
func GetSessionHistoryFromDB(sessionID string) ([]ConversationRecord, error) {
	if config.DB == nil {
		return nil, fmt.Errorf("数据库未初始化")
	}

	rows, err := config.DB.Query(
		`SELECT id, session_id, role, content, provider, created_at FROM conversations
		 WHERE session_id = ? ORDER BY created_at ASC`,
		sessionID,
	)
	if err != nil {
		return nil, fmt.Errorf("查询对话历史失败: %w", err)
	}
	defer rows.Close()

	var records []ConversationRecord
	for rows.Next() {
		var record ConversationRecord
		var createdAt sql.NullString
		if err := rows.Scan(&record.ID, &record.SessionID, &record.Role, &record.Content, &record.Provider, &createdAt); err != nil {
			continue
		}
		if createdAt.Valid {
			record.CreatedAt = createdAt.String
		}
		records = append(records, record)
	}

	return records, rows.Err()
}

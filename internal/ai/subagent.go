package ai

import (
	"context"
	"errors"
	"fmt"
	"sync"
	"time"

	"github.com/google/uuid"
)

// SubagentStatus Subagent 执行状态

type SubagentStatus string

const (
	// StatusPending 等待执行
	StatusPending SubagentStatus = "pending"
	// StatusRunning 执行中
	StatusRunning SubagentStatus = "running"
	// StatusCompleted 执行完成
	StatusCompleted SubagentStatus = "completed"
	// StatusFailed 执行失败
	StatusFailed SubagentStatus = "failed"
	// StatusTimeout 执行超时
	StatusTimeout SubagentStatus = "timeout"
)

// SubagentReport Subagent 实时汇报信息
type SubagentReport struct {
	// SubagentID 所属 Subagent ID
	SubagentID string
	// Status 当前状态
	Status SubagentStatus
	// Progress 进度百分比（0-100）
	Progress int
	// Detail 详细描述
	Detail string
	// Timestamp 汇报时间
	Timestamp time.Time
}

// Subagent AI Subagent 结构体
type Subagent struct {
	// ID 唯一标识
	ID string
	// Task 任务描述
	Task string
	// Status 当前执行状态
	Status SubagentStatus
	// Result 执行结果
	Result string
	// Error 执行错误（如果有）
	Error error
	// StartTime 开始执行时间
	StartTime time.Time
	// EndTime 执行结束时间
	EndTime time.Time
	// 内部互斥锁
	mu sync.RWMutex
}

// SubagentManager Subagent 管理器
type SubagentManager struct {
	// subagents 管理的 Subagent 映射
	subagents map[string]*Subagent
	// reportChan 实时汇报通道
	reportChan chan SubagentReport
	// mu 互斥锁
	mu sync.RWMutex
	// maxConcurrent 最大并发数（默认 5）
	maxConcurrent int
	// client AI 客户端（用于执行任务）
	client *AIClient
	// parentMessages 主 Agent 的上下文消息
	parentMessages []Message
}

// NewSubagentManager 创建新的 Subagent 管理器
func NewSubagentManager(client *AIClient) *SubagentManager {
	return &SubagentManager{
		subagents:      make(map[string]*Subagent),
		reportChan:     make(chan SubagentReport, 100),
		maxConcurrent:  5,
		client:         client,
		parentMessages: make([]Message, 0),
	}
}

// SetMaxConcurrent 设置最大并发数
func (sm *SubagentManager) SetMaxConcurrent(n int) {
	if n > 0 {
		sm.maxConcurrent = n
	}
}

// SetParentMessages 设置主 Agent 的上下文消息
func (sm *SubagentManager) SetParentMessages(messages []Message) {
	sm.mu.Lock()
	defer sm.mu.Unlock()
	sm.parentMessages = make([]Message, len(messages))
	copy(sm.parentMessages, messages)
}

// GetReportChannel 获取实时汇报通道
func (sm *SubagentManager) GetReportChannel() <-chan SubagentReport {
	return sm.reportChan
}

// CreateSubagent 创建新的 Subagent
func (sm *SubagentManager) CreateSubagent(task string) *Subagent {
	subagent := &Subagent{
		ID:     uuid.New().String(),
		Task:   task,
		Status: StatusPending,
	}

	sm.mu.Lock()
	sm.subagents[subagent.ID] = subagent
	sm.mu.Unlock()

	// 发送创建汇报
	sm.reportChan <- SubagentReport{
		SubagentID: subagent.ID,
		Status:     StatusPending,
		Progress:   0,
		Detail:     fmt.Sprintf("Subagent %s 已创建，任务: %s", subagent.ID, task),
		Timestamp:  time.Now(),
	}

	return subagent
}

// GetSubagent 获取指定 ID 的 Subagent
func (sm *SubagentManager) GetSubagent(id string) (*Subagent, bool) {
	sm.mu.RLock()
	defer sm.mu.RUnlock()
	subagent, ok := sm.subagents[id]
	return subagent, ok
}

// ListSubagents 列出所有 Subagent
func (sm *SubagentManager) ListSubagents() []*Subagent {
	sm.mu.RLock()
	defer sm.mu.RUnlock()

	result := make([]*Subagent, 0, len(sm.subagents))
	for _, subagent := range sm.subagents {
		result = append(result, subagent)
	}
	return result
}

// updateSubagentStatus 更新 Subagent 状态（内部方法）
func (sm *SubagentManager) updateSubagentStatus(subagent *Subagent, status SubagentStatus) {
	subagent.mu.Lock()
	subagent.Status = status
	subagent.mu.Unlock()
}

// updateSubagentResult 更新 Subagent 结果（内部方法）
func (sm *SubagentManager) updateSubagentResult(subagent *Subagent, result string, err error) {
	subagent.mu.Lock()
	defer subagent.mu.Unlock()

	subagent.Result = result
	subagent.Error = err
	subagent.EndTime = time.Now()

	if err != nil {
		if errors.Is(err, context.DeadlineExceeded) {
			subagent.Status = StatusTimeout
		} else {
			subagent.Status = StatusFailed
		}
	} else {
		subagent.Status = StatusCompleted
	}
}

// sendReport 发送实时汇报（内部方法）
func (sm *SubagentManager) sendReport(subagentID string, status SubagentStatus, progress int, detail string) {
	select {
	case sm.reportChan <- SubagentReport{
		SubagentID: subagentID,
		Status:     status,
		Progress:   progress,
		Detail:     detail,
		Timestamp:  time.Now(),
	}:
	default:
		// 通道已满时丢弃汇报，避免阻塞
	}
}

// ExecuteSubagent 执行单个 Subagent
// 使用 AIClient 发送任务并获取结果
func (sm *SubagentManager) ExecuteSubagent(ctx context.Context, subagent *Subagent) {
	// 标记为执行中
	subagent.mu.Lock()
	subagent.Status = StatusRunning
	subagent.StartTime = time.Now()
	subagent.mu.Unlock()

	sm.sendReport(subagent.ID, StatusRunning, 10, fmt.Sprintf("Subagent %s 开始执行任务", subagent.ID))

	// 构建系统提示，告知这是一个 Subagent 任务
	systemPrompt := fmt.Sprintf("你是一个专门执行特定任务的 Subagent。你的任务ID是 %s。请专注完成以下任务，并给出详细结果。", subagent.ID)

	// 构建消息列表
	messages := make([]Message, 0, len(sm.parentMessages)+2)
	messages = append(messages, Message{Role: RoleSystem, Content: systemPrompt})
	// 添加主 Agent 的上下文消息
	for _, msg := range sm.parentMessages {
		messages = append(messages, msg)
	}
	// 添加任务消息
	messages = append(messages, Message{Role: RoleUser, Content: subagent.Task})

	sm.sendReport(subagent.ID, StatusRunning, 30, fmt.Sprintf("Subagent %s 正在构建请求", subagent.ID))

	// 构建请求
	req := ChatRequest{
		Model:       sm.client.GetConfig().Model,
		Messages:    messages,
		Stream:      false,
		Temperature: 0.7,
		MaxTokens:   4096,
	}

	sm.sendReport(subagent.ID, StatusRunning, 50, fmt.Sprintf("Subagent %s 正在发送 AI 请求", subagent.ID))

	// 发送请求
	resp, err := sm.client.ChatCompletionSync(ctx, req)

	sm.sendReport(subagent.ID, StatusRunning, 80, fmt.Sprintf("Subagent %s 已收到响应，正在处理", subagent.ID))

	if err != nil {
		sm.updateSubagentResult(subagent, "", fmt.Errorf("Subagent %s 执行失败: %w", subagent.ID, err))
		sm.sendReport(subagent.ID, subagent.Status, 100, fmt.Sprintf("Subagent %s 执行失败: %v", subagent.ID, err))
		return
	}

	// 提取结果
	var result string
	if len(resp.Choices) > 0 {
		result = resp.Choices[0].Message.Content
	}

	sm.updateSubagentResult(subagent, result, nil)
	sm.sendReport(subagent.ID, StatusCompleted, 100, fmt.Sprintf("Subagent %s 执行完成，结果长度: %d", subagent.ID, len(result)))
}

// ExecuteSubagentWithTimeout 带超时的单个 Subagent 执行
func (sm *SubagentManager) ExecuteSubagentWithTimeout(subagent *Subagent, timeout time.Duration) {
	ctx, cancel := context.WithTimeout(context.Background(), timeout)
	defer cancel()

	sm.ExecuteSubagent(ctx, subagent)
}

// ExecuteParallel 并行执行多个任务
// maxConcurrent 为 0 时使用管理器的默认最大并发数
func (sm *SubagentManager) ExecuteParallel(tasks []string, maxConcurrent int) []*Subagent {
	if maxConcurrent <= 0 {
		maxConcurrent = sm.maxConcurrent
	}

	// 创建所有 Subagent
	subagents := make([]*Subagent, 0, len(tasks))
	for _, task := range tasks {
		subagent := sm.CreateSubagent(task)
		subagents = append(subagents, subagent)
	}

	// 创建信号量控制并发
	semaphore := make(chan struct{}, maxConcurrent)
	var wg sync.WaitGroup

	// 默认超时时间：5分钟
	defaultTimeout := 5 * time.Minute

	for _, subagent := range subagents {
		wg.Add(1)
		go func(sa *Subagent) {
			defer wg.Done()

			// 获取信号量
			semaphore <- struct{}{}
			defer func() { <-semaphore }()

			// 执行带超时的任务
			sm.ExecuteSubagentWithTimeout(sa, defaultTimeout)
		}(subagent)
	}

	// 等待所有任务完成
	wg.Wait()

	return subagents
}

// ExecuteParallelWithContext 使用指定上下文并行执行任务
func (sm *SubagentManager) ExecuteParallelWithContext(ctx context.Context, tasks []string, maxConcurrent int) []*Subagent {
	if maxConcurrent <= 0 {
		maxConcurrent = sm.maxConcurrent
	}

	// 创建所有 Subagent
	subagents := make([]*Subagent, 0, len(tasks))
	for _, task := range tasks {
		subagent := sm.CreateSubagent(task)
		subagents = append(subagents, subagent)
	}

	// 创建信号量控制并发
	semaphore := make(chan struct{}, maxConcurrent)
	var wg sync.WaitGroup

	for _, subagent := range subagents {
		wg.Add(1)
		go func(sa *Subagent) {
			defer wg.Done()

			select {
			case <-ctx.Done():
				// 上下文已取消
				sm.updateSubagentResult(sa, "", fmt.Errorf("Subagent %s 被取消: %w", sa.ID, ctx.Err()))
				sm.sendReport(sa.ID, StatusFailed, 0, fmt.Sprintf("Subagent %s 因上下文取消而终止", sa.ID))
				return
			default:
			}

			// 获取信号量
			select {
			case semaphore <- struct{}{}:
			case <-ctx.Done():
				sm.updateSubagentResult(sa, "", fmt.Errorf("Subagent %s 被取消: %w", sa.ID, ctx.Err()))
				sm.sendReport(sa.ID, StatusFailed, 0, fmt.Sprintf("Subagent %s 因上下文取消而终止", sa.ID))
				return
			}
			defer func() { <-semaphore }()

			// 使用上下文的截止时间或默认 5 分钟
			timeout := 5 * time.Minute
			if deadline, ok := ctx.Deadline(); ok {
				remaining := time.Until(deadline)
				if remaining > 0 && remaining < timeout {
					timeout = remaining
				}
			}

			execCtx, cancel := context.WithTimeout(ctx, timeout)
			defer cancel()

			// 执行
			sm.ExecuteSubagent(execCtx, sa)
		}(subagent)
	}

	// 等待所有任务完成
	wg.Wait()

	return subagents
}

// AggregateResults 聚合所有 Subagent 的执行结果
func (sm *SubagentManager) AggregateResults() *SubagentAggregateResult {
	sm.mu.RLock()
	defer sm.mu.RUnlock()

	result := &SubagentAggregateResult{
		Total:     len(sm.subagents),
		Details:   make(map[string]SubagentResult),
		Completed: make([]string, 0),
		Failed:    make([]string, 0),
		Timeouts:  make([]string, 0),
	}

	for id, subagent := range sm.subagents {
		subagent.mu.RLock()
		status := subagent.Status
		task := subagent.Task
		res := subagent.Result
		err := subagent.Error
		subagent.mu.RUnlock()

		result.Details[id] = SubagentResult{
			Task:   task,
			Status: status,
			Result: res,
			Error:  err,
		}

		switch status {
		case StatusCompleted:
			result.SuccessCount++
			result.Completed = append(result.Completed, id)
		case StatusFailed:
			result.FailedCount++
			result.Failed = append(result.Failed, id)
		case StatusTimeout:
			result.TimeoutCount++
			result.Timeouts = append(result.Timeouts, id)
		}
	}

	return result
}

// SubagentResult 单个 Subagent 的结果
type SubagentResult struct {
	// Task 原始任务
	Task string
	// Status 执行状态
	Status SubagentStatus
	// Result 执行结果
	Result string
	// Error 错误信息
	Error error
}

// SubagentAggregateResult 聚合结果
type SubagentAggregateResult struct {
	// Total Subagent 总数
	Total int
	// SuccessCount 成功数量
	SuccessCount int
	// FailedCount 失败数量
	FailedCount int
	// TimeoutCount 超时数量
	TimeoutCount int
	// Details 详细结果映射
	Details map[string]SubagentResult
	// Completed 成功的 Subagent ID 列表
	Completed []string
	// Failed 失败的 Subagent ID 列表
	Failed []string
	// Timeouts 超时的 Subagent ID 列表
	Timeouts []string
}

// HasErrors 检查是否有失败或超时的任务
func (r *SubagentAggregateResult) HasErrors() bool {
	return r.FailedCount > 0 || r.TimeoutCount > 0
}

// ErrorRate 计算错误率
func (r *SubagentAggregateResult) ErrorRate() float64 {
	if r.Total == 0 {
		return 0
	}
	return float64(r.FailedCount+r.TimeoutCount) / float64(r.Total)
}

// MainAgentDecision 主 Agent 决策函数类型
type MainAgentDecision func(result *SubagentAggregateResult) []string

// ExecuteWithDynamicDecision 执行初始任务，并根据结果动态创建新 Subagent
// decision 函数接收聚合结果，返回需要创建的新任务列表
func (sm *SubagentManager) ExecuteWithDynamicDecision(
	initialTasks []string,
	maxConcurrent int,
	decision MainAgentDecision,
) *SubagentAggregateResult {
	// 第一轮执行
	sm.ExecuteParallelWithContext(context.Background(), initialTasks, maxConcurrent)

	// 获取聚合结果
	result := sm.AggregateResults()

	// 主 Agent 决策：根据结果判断是否需要创建新 Subagent
	newTasks := decision(result)

	// 如果有新任务，递归执行
	if len(newTasks) > 0 {
		sm.ExecuteParallelWithContext(context.Background(), newTasks, maxConcurrent)
		// 重新聚合所有结果
		result = sm.AggregateResults()
	}

	return result
}

// Close 关闭管理器，清理资源
func (sm *SubagentManager) Close() {
	close(sm.reportChan)
}

// GetStatus 获取 Subagent 当前状态（线程安全）
func (s *Subagent) GetStatus() SubagentStatus {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.Status
}

// GetResult 获取 Subagent 执行结果（线程安全）
func (s *Subagent) GetResult() string {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.Result
}

// GetError 获取 Subagent 错误信息（线程安全）
func (s *Subagent) GetError() error {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.Error
}

// IsDone 检查 Subagent 是否已完成（成功、失败或超时）
func (s *Subagent) IsDone() bool {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.Status == StatusCompleted || s.Status == StatusFailed || s.Status == StatusTimeout
}

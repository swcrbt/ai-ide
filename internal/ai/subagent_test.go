package ai

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
)

// 创建模拟 AI 服务器的辅助函数
func createMockServer(response string, delay time.Duration) *httptest.Server {
	return httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if delay > 0 {
			time.Sleep(delay)
		}

		resp := ChatCompletionResponse{
			ID:      "test-id",
			Object:  "chat.completion",
			Created: 1234567890,
			Model:   "test-model",
			Choices: []CompletionChoice{
				{
					Index: 0,
					Message: Message{
						Role:    RoleAssistant,
						Content: response,
					},
					FinishReason: "stop",
				},
			},
			Usage: TokenUsage{
				PromptTokens:     10,
				CompletionTokens: 20,
				TotalTokens:      30,
			},
		}

		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		json.NewEncoder(w).Encode(resp)
	}))
}

// 创建返回错误的模拟服务器
func createErrorMockServer(statusCode int) *httptest.Server {
	return httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(statusCode)
		w.Write([]byte(`{"error": "test error"}`))
	}))
}

// TestSubagentCreation 测试 Subagent 创建
func TestSubagentCreation(t *testing.T) {
	config := &ProviderConfig{
		BaseURL: "https://test.com",
		APIKey:  "test-key",
		Model:   "test-model",
	}
	client := NewAIClient(config)
	manager := NewSubagentManager(client)
	defer manager.Close()

	subagent := manager.CreateSubagent("测试任务")

	if subagent.ID == "" {
		t.Error("Subagent ID 不应为空")
	}
	if subagent.Task != "测试任务" {
		t.Errorf("Task = %v, want 测试任务", subagent.Task)
	}
	if subagent.Status != StatusPending {
		t.Errorf("Status = %v, want %v", subagent.Status, StatusPending)
	}
	if !subagent.StartTime.IsZero() {
		t.Error("创建后 StartTime 应为零值")
	}

	// 验证可以从管理器获取
	got, ok := manager.GetSubagent(subagent.ID)
	if !ok {
		t.Fatal("GetSubagent 返回 false")
	}
	if got.ID != subagent.ID {
		t.Errorf("获取的 Subagent ID 不匹配")
	}
}

// TestSubagentExecution 测试单个 Subagent 执行
func TestSubagentExecution(t *testing.T) {
	server := createMockServer("任务执行结果", 0)
	defer server.Close()

	config := &ProviderConfig{
		BaseURL: server.URL,
		APIKey:  "test-key",
		Model:   "test-model",
	}
	client := NewAIClient(config)
	manager := NewSubagentManager(client)
	defer manager.Close()

	subagent := manager.CreateSubagent("执行测试任务")

	// 使用短超时执行
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	manager.ExecuteSubagent(ctx, subagent)

	// 验证状态
	if subagent.Status != StatusCompleted {
		t.Errorf("Status = %v, want %v", subagent.Status, StatusCompleted)
	}
	if subagent.Result != "任务执行结果" {
		t.Errorf("Result = %v, want 任务执行结果", subagent.Result)
	}
	if subagent.Error != nil {
		t.Errorf("Error = %v, want nil", subagent.Error)
	}
	if subagent.StartTime.IsZero() {
		t.Error("StartTime 应该已设置")
	}
	if subagent.EndTime.IsZero() {
		t.Error("EndTime 应该已设置")
	}
}

// TestSubagentParallelExecution 测试并行执行多个 Subagent
func TestSubagentParallelExecution(t *testing.T) {
	server := createMockServer("并行任务结果", 100*time.Millisecond)
	defer server.Close()

	config := &ProviderConfig{
		BaseURL: server.URL,
		APIKey:  "test-key",
		Model:   "test-model",
	}
	client := NewAIClient(config)
	manager := NewSubagentManager(client)
	defer manager.Close()

	tasks := []string{
		"并行任务1",
		"并行任务2",
		"并行任务3",
		"并行任务4",
		"并行任务5",
	}

	start := time.Now()
	subagents := manager.ExecuteParallel(tasks, 5)
	elapsed := time.Since(start)

	// 验证所有 Subagent 都已创建
	if len(subagents) != len(tasks) {
		t.Errorf("Subagent 数量 = %d, want %d", len(subagents), len(tasks))
	}

	// 验证并行执行（5个100ms的任务串行需要500ms+，并行应该小于300ms）
	if elapsed > 300*time.Millisecond {
		t.Errorf("并行执行时间 %v 过长，可能未正确并行化", elapsed)
	}

	// 验证所有任务完成
	completedCount := 0
	for _, sa := range subagents {
		if sa.Status == StatusCompleted {
			completedCount++
		}
	}
	if completedCount != len(tasks) {
		t.Errorf("完成任务数 = %d, want %d", completedCount, len(tasks))
	}
}

// TestSubagentParallelWithLimitedConcurrency 测试限制并发数的并行执行
func TestSubagentParallelWithLimitedConcurrency(t *testing.T) {
	server := createMockServer("结果", 50*time.Millisecond)
	defer server.Close()

	config := &ProviderConfig{
		BaseURL: server.URL,
		APIKey:  "test-key",
		Model:   "test-model",
	}
	client := NewAIClient(config)
	manager := NewSubagentManager(client)
	defer manager.Close()

	tasks := []string{"任务1", "任务2", "任务3", "任务4"}

	// 设置最大并发数为 2
	start := time.Now()
	manager.ExecuteParallel(tasks, 2)
	elapsed := time.Since(start)

	// 4个50ms的任务，并发为2，最少需要100ms
	if elapsed < 100*time.Millisecond {
		t.Errorf("限制并发后执行时间 %v 过短，可能未限制并发", elapsed)
	}

	// 验证所有任务都已完成
	for i, task := range tasks {
		subagents := manager.ListSubagents()
		found := false
		for _, sa := range subagents {
			if sa.Task == task && sa.Status == StatusCompleted {
				found = true
				break
			}
		}
		if !found {
			t.Errorf("任务 %d (%s) 未正确完成", i, task)
		}
	}
}

// TestSubagentTimeout 测试超时控制
func TestSubagentTimeout(t *testing.T) {
	// 创建一个慢速服务器，响应时间超过超时时间
	server := createMockServer("慢速结果", 200*time.Millisecond)
	defer server.Close()

	config := &ProviderConfig{
		BaseURL: server.URL,
		APIKey:  "test-key",
		Model:   "test-model",
	}
	client := NewAIClient(config)
	manager := NewSubagentManager(client)
	defer manager.Close()

	subagent := manager.CreateSubagent("超时测试任务")

	// 设置50ms超时，服务器响应200ms
	manager.ExecuteSubagentWithTimeout(subagent, 50*time.Millisecond)

	// 验证状态为超时
	if subagent.Status != StatusTimeout {
		t.Errorf("Status = %v, want %v", subagent.Status, StatusTimeout)
	}
	if subagent.Error == nil {
		t.Error("Error 不应为 nil")
	}
	if !strings.Contains(subagent.Error.Error(), "context deadline exceeded") {
		t.Errorf("错误信息应包含超时信息: %v", subagent.Error)
	}
}

// TestSubagentErrorHandling 测试错误处理
func TestSubagentErrorHandling(t *testing.T) {
	server := createErrorMockServer(http.StatusInternalServerError)
	defer server.Close()

	config := &ProviderConfig{
		BaseURL: server.URL,
		APIKey:  "test-key",
		Model:   "test-model",
	}
	client := NewAIClient(config)
	manager := NewSubagentManager(client)
	defer manager.Close()

	subagent := manager.CreateSubagent("错误测试任务")

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	manager.ExecuteSubagent(ctx, subagent)

	// 验证状态为失败
	if subagent.Status != StatusFailed {
		t.Errorf("Status = %v, want %v", subagent.Status, StatusFailed)
	}
	if subagent.Error == nil {
		t.Error("Error 不应为 nil")
	}
}

// TestSubagentAggregateResults 测试结果聚合
func TestSubagentAggregateResults(t *testing.T) {
	server := createMockServer("结果", 0)
	defer server.Close()

	config := &ProviderConfig{
		BaseURL: server.URL,
		APIKey:  "test-key",
		Model:   "test-model",
	}
	client := NewAIClient(config)
	manager := NewSubagentManager(client)
	defer manager.Close()

	// 创建一些成功和一些失败的场景
	// 先执行成功的任务
	tasks := []string{"任务1", "任务2", "任务3"}
	manager.ExecuteParallel(tasks, 3)

	// 聚合结果
	result := manager.AggregateResults()

	if result.Total != len(tasks) {
		t.Errorf("Total = %d, want %d", result.Total, len(tasks))
	}
	if result.SuccessCount != len(tasks) {
		t.Errorf("SuccessCount = %d, want %d", result.SuccessCount, len(tasks))
	}
	if result.FailedCount != 0 {
		t.Errorf("FailedCount = %d, want 0", result.FailedCount)
	}
	if result.TimeoutCount != 0 {
		t.Errorf("TimeoutCount = %d, want 0", result.TimeoutCount)
	}
	if result.HasErrors() {
		t.Error("HasErrors 应该返回 false")
	}
	if result.ErrorRate() != 0 {
		t.Errorf("ErrorRate = %v, want 0", result.ErrorRate())
	}
	if len(result.Details) != len(tasks) {
		t.Errorf("Details 数量 = %d, want %d", len(result.Details), len(tasks))
	}
	if len(result.Completed) != len(tasks) {
		t.Errorf("Completed 数量 = %d, want %d", len(result.Completed), len(tasks))
	}
}

// TestSubagentAggregateResultsWithErrors 测试包含错误的聚合结果
func TestSubagentAggregateResultsWithErrors(t *testing.T) {
	// 使用错误服务器
	server := createErrorMockServer(http.StatusBadRequest)
	defer server.Close()

	config := &ProviderConfig{
		BaseURL: server.URL,
		APIKey:  "test-key",
		Model:   "test-model",
	}
	client := NewAIClient(config)
	manager := NewSubagentManager(client)
	defer manager.Close()

	tasks := []string{"任务1", "任务2"}
	manager.ExecuteParallel(tasks, 2)

	result := manager.AggregateResults()

	if result.Total != 2 {
		t.Errorf("Total = %d, want 2", result.Total)
	}
	if result.SuccessCount != 0 {
		t.Errorf("SuccessCount = %d, want 0", result.SuccessCount)
	}
	if result.FailedCount != 2 {
		t.Errorf("FailedCount = %d, want 2", result.FailedCount)
	}
	if !result.HasErrors() {
		t.Error("HasErrors 应该返回 true")
	}
	if result.ErrorRate() != 1.0 {
		t.Errorf("ErrorRate = %v, want 1.0", result.ErrorRate())
	}
}

// TestSubagentRealTimeReporting 测试实时汇报机制
func TestSubagentRealTimeReporting(t *testing.T) {
	server := createMockServer("汇报结果", 50*time.Millisecond)
	defer server.Close()

	config := &ProviderConfig{
		BaseURL: server.URL,
		APIKey:  "test-key",
		Model:   "test-model",
	}
	client := NewAIClient(config)
	manager := NewSubagentManager(client)
	defer manager.Close()

	reportChan := manager.GetReportChannel()

	subagent := manager.CreateSubagent("汇报测试任务")

	// 收集汇报
	var reports []SubagentReport
	done := make(chan bool)

	go func() {
		for report := range reportChan {
			reports = append(reports, report)
			if report.SubagentID == subagent.ID && report.Status == StatusCompleted {
				done <- true
				return
			}
		}
	}()

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	manager.ExecuteSubagent(ctx, subagent)

	// 等待完成汇报或超时
	select {
	case <-done:
		// 成功收到完成汇报
	case <-time.After(3 * time.Second):
		t.Error("未在预期时间内收到完成汇报")
	}

	// 验证收到了汇报
	if len(reports) == 0 {
		t.Error("未收到任何汇报")
	}

	// 验证汇报包含预期的 Subagent ID
	found := false
	for _, r := range reports {
		if r.SubagentID == subagent.ID {
			found = true
			break
		}
	}
	if !found {
		t.Error("未收到目标 Subagent 的汇报")
	}
}

// TestSubagentDynamicDecision 测试主 Agent 动态决策
func TestSubagentDynamicDecision(t *testing.T) {
	server := createMockServer("决策结果", 0)
	defer server.Close()

	config := &ProviderConfig{
		BaseURL: server.URL,
		APIKey:  "test-key",
		Model:   "test-model",
	}
	client := NewAIClient(config)
	manager := NewSubagentManager(client)
	defer manager.Close()

	initialTasks := []string{"初始任务1", "初始任务2"}

	// 决策函数：如果初始任务都成功，创建后续任务
	decision := func(result *SubagentAggregateResult) []string {
		if result.SuccessCount == len(initialTasks) {
			return []string{"后续任务1", "后续任务2"}
		}
		return nil
	}

	finalResult := manager.ExecuteWithDynamicDecision(initialTasks, 2, decision)

	// 验证初始任务成功
	if finalResult.SuccessCount != 4 {
		t.Errorf("最终成功任务数 = %d, want 4", finalResult.SuccessCount)
	}
	if finalResult.Total != 4 {
		t.Errorf("最终总任务数 = %d, want 4", finalResult.Total)
	}
}

// TestSubagentContextCancellation 测试上下文取消
func TestSubagentContextCancellation(t *testing.T) {
	server := createMockServer("结果", 500*time.Millisecond)
	defer server.Close()

	config := &ProviderConfig{
		BaseURL: server.URL,
		APIKey:  "test-key",
		Model:   "test-model",
	}
	client := NewAIClient(config)
	manager := NewSubagentManager(client)
	defer manager.Close()

	ctx, cancel := context.WithCancel(context.Background())

	tasks := []string{"取消任务1", "取消任务2"}

	// 启动并行执行
	done := make(chan []*Subagent)
	go func() {
		done <- manager.ExecuteParallelWithContext(ctx, tasks, 2)
	}()

	// 立即取消上下文
	cancel()

	var subagents []*Subagent
	select {
	case subagents = <-done:
		// 收到结果
	case <-time.After(3 * time.Second):
		t.Fatal("等待执行完成超时")
	}

	// 验证任务被取消
	for _, sa := range subagents {
		if sa.Status != StatusFailed {
			t.Errorf("Subagent %s 状态 = %v, want %v", sa.ID, sa.Status, StatusFailed)
		}
		if sa.Error == nil || !strings.Contains(sa.Error.Error(), "context canceled") {
			t.Errorf("Subagent %s 错误信息不包含取消信息: %v", sa.ID, sa.Error)
		}
	}
}

// TestSubagentManagerConfiguration 测试管理器配置
func TestSubagentManagerConfiguration(t *testing.T) {
	config := &ProviderConfig{
		BaseURL: "https://test.com",
		APIKey:  "test-key",
		Model:   "test-model",
	}
	client := NewAIClient(config)
	manager := NewSubagentManager(client)
	defer manager.Close()

	// 测试默认最大并发数
	if manager.maxConcurrent != 5 {
		t.Errorf("默认 maxConcurrent = %d, want 5", manager.maxConcurrent)
	}

	// 测试设置最大并发数
	manager.SetMaxConcurrent(3)
	if manager.maxConcurrent != 3 {
		t.Errorf("设置后 maxConcurrent = %d, want 3", manager.maxConcurrent)
	}

	// 测试设置无效值不应改变
	manager.SetMaxConcurrent(0)
	if manager.maxConcurrent != 3 {
		t.Errorf("设置无效值后 maxConcurrent = %d, want 3", manager.maxConcurrent)
	}

	// 测试设置父消息
	messages := []Message{
		{Role: RoleSystem, Content: "系统提示"},
		{Role: RoleUser, Content: "用户消息"},
	}
	manager.SetParentMessages(messages)
	if len(manager.parentMessages) != 2 {
		t.Errorf("parentMessages 长度 = %d, want 2", len(manager.parentMessages))
	}
}

// TestSubagentThreadSafety 测试线程安全方法
func TestSubagentThreadSafety(t *testing.T) {
	config := &ProviderConfig{
		BaseURL: "https://test.com",
		APIKey:  "test-key",
		Model:   "test-model",
	}
	client := NewAIClient(config)
	manager := NewSubagentManager(client)
	defer manager.Close()

	subagent := manager.CreateSubagent("线程安全测试")

	// 手动设置状态进行测试
	subagent.mu.Lock()
	subagent.Status = StatusCompleted
	subagent.Result = "测试结果"
	subagent.mu.Unlock()

	// 测试线程安全方法
	if subagent.GetStatus() != StatusCompleted {
		t.Error("GetStatus 返回错误")
	}
	if subagent.GetResult() != "测试结果" {
		t.Error("GetResult 返回错误")
	}
	if subagent.GetError() != nil {
		t.Error("GetError 应返回 nil")
	}
	if !subagent.IsDone() {
		t.Error("IsDone 应返回 true")
	}
}

// TestSubagentStatusTransitions 测试状态流转
func TestSubagentStatusTransitions(t *testing.T) {
	server := createMockServer("结果", 0)
	defer server.Close()

	config := &ProviderConfig{
		BaseURL: server.URL,
		APIKey:  "test-key",
		Model:   "test-model",
	}
	client := NewAIClient(config)
	manager := NewSubagentManager(client)
	defer manager.Close()

	subagent := manager.CreateSubagent("状态测试")

	// 初始状态应为 Pending
	if subagent.Status != StatusPending {
		t.Errorf("初始 Status = %v, want %v", subagent.Status, StatusPending)
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	manager.ExecuteSubagent(ctx, subagent)

	// 执行后应为 Completed
	if subagent.Status != StatusCompleted {
		t.Errorf("执行后 Status = %v, want %v", subagent.Status, StatusCompleted)
	}

	// 验证 IsDone 返回 true
	if !subagent.IsDone() {
		t.Error("IsDone 应返回 true")
	}
}

// TestSubagentEmptyResult 测试空结果处理
func TestSubagentEmptyResult(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		resp := ChatCompletionResponse{
			ID:      "test-id",
			Object:  "chat.completion",
			Created: 1234567890,
			Model:   "test-model",
			Choices: []CompletionChoice{}, // 空选择
		}

		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		json.NewEncoder(w).Encode(resp)
	}))
	defer server.Close()

	config := &ProviderConfig{
		BaseURL: server.URL,
		APIKey:  "test-key",
		Model:   "test-model",
	}
	client := NewAIClient(config)
	manager := NewSubagentManager(client)
	defer manager.Close()

	subagent := manager.CreateSubagent("空结果测试")

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	manager.ExecuteSubagent(ctx, subagent)

	// 即使结果为空，状态也应为 Completed
	if subagent.Status != StatusCompleted {
		t.Errorf("Status = %v, want %v", subagent.Status, StatusCompleted)
	}
	if subagent.Result != "" {
		t.Errorf("Result = %v, want 空字符串", subagent.Result)
	}
}

// TestSubagentReportChannel 测试汇报通道
func TestSubagentReportChannel(t *testing.T) {
	config := &ProviderConfig{
		BaseURL: "https://test.com",
		APIKey:  "test-key",
		Model:   "test-model",
	}
	client := NewAIClient(config)
	manager := NewSubagentManager(client)
	defer manager.Close()

	reportChan := manager.GetReportChannel()
	if reportChan == nil {
		t.Fatal("GetReportChannel 返回 nil")
	}

	// 创建 Subagent 应该产生汇报
	subagent := manager.CreateSubagent("通道测试")

	select {
	case report := <-reportChan:
		if report.SubagentID != subagent.ID {
			t.Errorf("Report SubagentID = %v, want %v", report.SubagentID, subagent.ID)
		}
		if report.Status != StatusPending {
			t.Errorf("Report Status = %v, want %v", report.Status, StatusPending)
		}
	case <-time.After(2 * time.Second):
		t.Error("未收到创建汇报")
	}
}

// TestSubagentResultErrorRate 测试错误率计算
func TestSubagentResultErrorRate(t *testing.T) {
	// 测试空结果
	emptyResult := &SubagentAggregateResult{Total: 0}
	if emptyResult.ErrorRate() != 0 {
		t.Errorf("空结果错误率 = %v, want 0", emptyResult.ErrorRate())
	}

	// 测试全部成功
	allSuccess := &SubagentAggregateResult{Total: 5, SuccessCount: 5}
	if allSuccess.ErrorRate() != 0 {
		t.Errorf("全成功错误率 = %v, want 0", allSuccess.ErrorRate())
	}

	// 测试一半失败
	halfFailed := &SubagentAggregateResult{Total: 4, SuccessCount: 2, FailedCount: 2}
	if halfFailed.ErrorRate() != 0.5 {
		t.Errorf("半失败错误率 = %v, want 0.5", halfFailed.ErrorRate())
	}
}

// TestSubagentParallelWithContextDeadline 测试上下文截止时间
func TestSubagentParallelWithContextDeadline(t *testing.T) {
	server := createMockServer("结果", 200*time.Millisecond)
	defer server.Close()

	config := &ProviderConfig{
		BaseURL: server.URL,
		APIKey:  "test-key",
		Model:   "test-model",
	}
	client := NewAIClient(config)
	manager := NewSubagentManager(client)
	defer manager.Close()

	// 设置100ms的截止时间
	ctx, cancel := context.WithTimeout(context.Background(), 100*time.Millisecond)
	defer cancel()

	tasks := []string{"截止任务1", "截止任务2"}
	subagents := manager.ExecuteParallelWithContext(ctx, tasks, 2)

	// 所有任务应该因为截止时间而过期
	for _, sa := range subagents {
		if sa.Status != StatusTimeout && sa.Status != StatusFailed {
			t.Errorf("Subagent %s 状态 = %v, 期望超时或失败", sa.ID, sa.Status)
		}
	}
}

// BenchmarkSubagentParallelExecution 并行执行性能基准测试
func BenchmarkSubagentParallelExecution(b *testing.B) {
	server := createMockServer("基准结果", 10*time.Millisecond)
	defer server.Close()

	config := &ProviderConfig{
		BaseURL: server.URL,
		APIKey:  "test-key",
		Model:   "test-model",
	}
	client := NewAIClient(config)

	for i := 0; i < b.N; i++ {
		manager := NewSubagentManager(client)
		tasks := make([]string, 10)
		for j := range tasks {
			tasks[j] = fmt.Sprintf("基准任务%d", j)
		}
		manager.ExecuteParallel(tasks, 5)
		manager.Close()
	}
}

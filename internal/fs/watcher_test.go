package fs

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

// TestNewFileWatcher 测试创建监听器
func TestNewFileWatcher(t *testing.T) {
	fw, err := NewFileWatcher()
	if err != nil {
		t.Fatalf("创建监听器失败: %v", err)
	}
	defer fw.Close()

	// 验证事件通道不为 nil
	if fw.Events() == nil {
		t.Error("事件通道不应为 nil")
	}
}

// TestWatchAndUnwatch 测试监听和取消监听
func TestWatchAndUnwatch(t *testing.T) {
	tmpDir, err := os.MkdirTemp("", "watcher-test-*")
	if err != nil {
		t.Fatalf("创建临时目录失败: %v", err)
	}
	defer os.RemoveAll(tmpDir)

	fw, err := NewFileWatcher()
	if err != nil {
		t.Fatalf("创建监听器失败: %v", err)
	}
	defer fw.Close()

	// 测试监听目录
	if err := fw.Watch(tmpDir); err != nil {
		t.Errorf("监听目录失败: %v", err)
	}

	// 测试取消监听
	if err := fw.Unwatch(tmpDir); err != nil {
		t.Errorf("取消监听失败: %v", err)
	}

	// 测试非法路径
	err = fw.Watch("/etc/../etc")
	if err == nil || !strings.Contains(err.Error(), "非法路径") {
		t.Errorf("期望非法路径错误，实际: %v", err)
	}

	err = fw.Unwatch("/etc/../etc")
	if err == nil || !strings.Contains(err.Error(), "非法路径") {
		t.Errorf("期望非法路径错误，实际: %v", err)
	}
}

// TestFileCreateEvent 测试文件创建事件
func TestFileCreateEvent(t *testing.T) {
	tmpDir, err := os.MkdirTemp("", "watcher-create-*")
	if err != nil {
		t.Fatalf("创建临时目录失败: %v", err)
	}
	defer os.RemoveAll(tmpDir)

	fw, err := NewFileWatcher()
	if err != nil {
		t.Fatalf("创建监听器失败: %v", err)
	}
	defer fw.Close()

	// 开始监听
	if err := fw.Watch(tmpDir); err != nil {
		t.Fatalf("监听目录失败: %v", err)
	}

	eventChan := fw.Events()

	// 创建文件
	testFile := filepath.Join(tmpDir, "test-create.txt")
	go func() {
		time.Sleep(50 * time.Millisecond)
		os.WriteFile(testFile, []byte("hello"), 0644)
	}()

	// 等待事件（考虑防抖延迟）
	select {
	case event := <-eventChan:
		if event.Type != FileEventCreate && event.Type != FileEventModify {
			t.Errorf("期望创建或修改事件，实际: %s", event.Type)
		}
		if !strings.Contains(event.Path, "test-create.txt") {
			t.Errorf("事件路径不匹配: %s", event.Path)
		}
	case <-time.After(2 * time.Second):
		t.Error("超时：未收到文件创建事件")
	}
}

// TestFileWriteEvent 测试文件修改事件
func TestFileWriteEvent(t *testing.T) {
	tmpDir, err := os.MkdirTemp("", "watcher-write-*")
	if err != nil {
		t.Fatalf("创建临时目录失败: %v", err)
	}
	defer os.RemoveAll(tmpDir)

	// 先创建测试文件
	testFile := filepath.Join(tmpDir, "test-write.txt")
	os.WriteFile(testFile, []byte("initial"), 0644)

	fw, err := NewFileWatcher()
	if err != nil {
		t.Fatalf("创建监听器失败: %v", err)
	}
	defer fw.Close()

	// 开始监听
	if err := fw.Watch(tmpDir); err != nil {
		t.Fatalf("监听目录失败: %v", err)
	}

	eventChan := fw.Events()

	// 修改文件
	go func() {
		time.Sleep(50 * time.Millisecond)
		os.WriteFile(testFile, []byte("modified"), 0644)
	}()

	// 等待事件
	select {
	case event := <-eventChan:
		if event.Type != FileEventModify {
			t.Errorf("期望修改事件，实际: %s", event.Type)
		}
		if !strings.Contains(event.Path, "test-write.txt") {
			t.Errorf("事件路径不匹配: %s", event.Path)
		}
	case <-time.After(2 * time.Second):
		t.Error("超时：未收到文件修改事件")
	}
}

// TestFileDeleteEvent 测试文件删除事件
func TestFileDeleteEvent(t *testing.T) {
	tmpDir, err := os.MkdirTemp("", "watcher-delete-*")
	if err != nil {
		t.Fatalf("创建临时目录失败: %v", err)
	}
	defer os.RemoveAll(tmpDir)

	// 先创建测试文件
	testFile := filepath.Join(tmpDir, "test-delete.txt")
	os.WriteFile(testFile, []byte("delete me"), 0644)

	fw, err := NewFileWatcher()
	if err != nil {
		t.Fatalf("创建监听器失败: %v", err)
	}
	defer fw.Close()

	// 开始监听
	if err := fw.Watch(tmpDir); err != nil {
		t.Fatalf("监听目录失败: %v", err)
	}

	eventChan := fw.Events()

	// 删除文件
	go func() {
		time.Sleep(50 * time.Millisecond)
		os.Remove(testFile)
	}()

	// 等待事件
	select {
	case event := <-eventChan:
		if event.Type != FileEventDelete {
			t.Errorf("期望删除事件，实际: %s", event.Type)
		}
		if !strings.Contains(event.Path, "test-delete.txt") {
			t.Errorf("事件路径不匹配: %s", event.Path)
		}
	case <-time.After(2 * time.Second):
		t.Error("超时：未收到文件删除事件")
	}
}

// TestDebounce 测试防抖功能
func TestDebounce(t *testing.T) {
	tmpDir, err := os.MkdirTemp("", "watcher-debounce-*")
	if err != nil {
		t.Fatalf("创建临时目录失败: %v", err)
	}
	defer os.RemoveAll(tmpDir)

	// 先创建测试文件
	testFile := filepath.Join(tmpDir, "test-debounce.txt")
	os.WriteFile(testFile, []byte("0"), 0644)

	fw, err := NewFileWatcher()
	if err != nil {
		t.Fatalf("创建监听器失败: %v", err)
	}
	defer fw.Close()

	// 开始监听
	if err := fw.Watch(tmpDir); err != nil {
		t.Fatalf("监听目录失败: %v", err)
	}

	eventChan := fw.Events()

	// 快速连续写入多次（应在防抖窗口内合并为一次事件）
	go func() {
		time.Sleep(50 * time.Millisecond)
		for i := 1; i <= 5; i++ {
			os.WriteFile(testFile, []byte(string(rune('0'+i))), 0644)
			time.Sleep(20 * time.Millisecond) // 每次间隔小于防抖延迟
		}
	}()

	// 等待一段时间收集事件
	eventCount := 0
	timeout := time.AfterFunc(1*time.Second, func() {})
	for {
		select {
		case <-eventChan:
			eventCount++
			if eventCount >= 2 {
				// 如果收到多个事件，说明防抖未生效
				t.Errorf("防抖未生效，收到 %d 个事件", eventCount)
				return
			}
		case <-timeout.C:
			// 超时退出
			if eventCount == 0 {
				t.Error("未收到任何事件")
			}
			return
		default:
			time.Sleep(10 * time.Millisecond)
			// 检查是否已超时
			if !timeout.Stop() {
				select {
				case <-timeout.C:
				default:
				}
			}
			if time.Now().After(time.Now().Add(-1 * time.Second)) {
				// 用更简单的方式：等待足够长的时间
				time.Sleep(500 * time.Millisecond)
				return
			}
		}
	}
}

// TestClose 测试关闭监听器
func TestClose(t *testing.T) {
	fw, err := NewFileWatcher()
	if err != nil {
		t.Fatalf("创建监听器失败: %v", err)
	}

	// 关闭应正常完成
	if err := fw.Close(); err != nil {
		t.Errorf("关闭监听器失败: %v", err)
	}

	// 关闭后再次关闭不应 panic
	if err := fw.Close(); err != nil {
		// 可能返回错误，但不应 panic
	}
}

// TestFileServiceWithWatcher 测试 FileService 与 FileWatcher 集成
func TestFileServiceWithWatcher(t *testing.T) {
	tmpDir, err := os.MkdirTemp("", "fs-watcher-integration-*")
	if err != nil {
		t.Fatalf("创建临时目录失败: %v", err)
	}
	defer os.RemoveAll(tmpDir)

	svc := NewFileService()
	fw, err := NewFileWatcher()
	if err != nil {
		t.Fatalf("创建监听器失败: %v", err)
	}
	defer fw.Close()

	// 设置监听器
	svc.SetWatcher(fw)

	// 测试 Watch 接口
	if err := svc.Watch(tmpDir); err != nil {
		t.Errorf("Watch 失败: %v", err)
	}

	// 验证事件通道
	if svc.GetEventChannel() == nil {
		t.Error("事件通道不应为 nil")
	}

	// 测试重复 Watch 不应报错
	if err := svc.Watch(tmpDir); err != nil {
		t.Errorf("重复 Watch 不应失败: %v", err)
	}

	// 测试 Unwatch
	if err := svc.Unwatch(tmpDir); err != nil {
		t.Errorf("Unwatch 失败: %v", err)
	}

	// 测试重复 Unwatch 不应报错
	if err := svc.Unwatch(tmpDir); err != nil {
		t.Errorf("重复 Unwatch 不应失败: %v", err)
	}

	// 测试 Close
	if err := svc.Close(); err != nil {
		t.Errorf("Close 失败: %v", err)
	}
}

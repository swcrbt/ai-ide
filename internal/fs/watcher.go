package fs

import (
	"fmt"
	"io/fs"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"github.com/fsnotify/fsnotify"
)

// FileWatcher 使用 fsnotify 监听文件系统变更
type FileWatcher struct {
	watcher    *fsnotify.Watcher     // fsnotify 底层监听器
	eventChan  chan FileEvent        // 对外暴露的事件通道
	debouncers map[string]*time.Timer // 每个路径的防抖定时器
	debounceMu sync.Mutex            // 保护 debouncers
	debounceDelay time.Duration      // 防抖延迟
	closeChan  chan struct{}         // 关闭信号
	closeOnce  sync.Once             // 确保只关闭一次
	wg         sync.WaitGroup        // 等待 goroutine 结束
}

// NewFileWatcher 创建新的文件监听器
func NewFileWatcher() (*FileWatcher, error) {
	fsWatcher, err := fsnotify.NewWatcher()
	if err != nil {
		return nil, fmt.Errorf("创建 fsnotify 监听器失败: %w", err)
	}

	fw := &FileWatcher{
		watcher:       fsWatcher,
		eventChan:     make(chan FileEvent, 100),
		debouncers:    make(map[string]*time.Timer),
		debounceDelay: 100 * time.Millisecond,
		closeChan:     make(chan struct{}),
	}

	// 启动事件处理循环
	fw.wg.Add(1)
	go fw.processEvents()

	return fw, nil
}

// Watch 开始监听指定路径
func (fw *FileWatcher) Watch(path string) error {
	if strings.Contains(path, "..") {
		return fmt.Errorf("非法路径: %s", path)
	}

	// 递归添加所有子目录到监听
	return filepath.WalkDir(path, func(walkPath string, d fs.DirEntry, err error) error {
		if err != nil {
			return nil // 跳过无法访问的路径
		}

		// fsnotify.Watcher.Add 可直接添加文件和目录
		if err := fw.watcher.Add(walkPath); err != nil {
			// 某些路径可能无法监听（如权限不足），跳过但不中断
			return nil
		}

		return nil
	})
}

// Unwatch 停止监听指定路径
func (fw *FileWatcher) Unwatch(path string) error {
	if strings.Contains(path, "..") {
		return fmt.Errorf("非法路径: %s", path)
	}

	return fw.watcher.Remove(path)
}

// Events 返回文件变更事件通道
func (fw *FileWatcher) Events() <-chan FileEvent {
	return fw.eventChan
}

// Close 关闭监听器并释放资源，可安全多次调用
func (fw *FileWatcher) Close() error {
	var closeErr error
	fw.closeOnce.Do(func() {
		close(fw.closeChan)

		// 取消所有防抖定时器
		fw.debounceMu.Lock()
		for _, timer := range fw.debouncers {
			timer.Stop()
		}
		fw.debouncers = make(map[string]*time.Timer)
		fw.debounceMu.Unlock()

		// 等待事件处理 goroutine 结束
		fw.wg.Wait()

		// 关闭通道和 fsnotify watcher
		close(fw.eventChan)
		closeErr = fw.watcher.Close()
	})
	return closeErr
}

// processEvents 处理 fsnotify 原始事件，进行防抖和合并
func (fw *FileWatcher) processEvents() {
	defer fw.wg.Done()

	for {
		select {
		case <-fw.closeChan:
			return

		case event, ok := <-fw.watcher.Events:
			if !ok {
				return
			}
			fw.handleFsnotifyEvent(event)

		case err, ok := <-fw.watcher.Errors:
			if !ok {
				return
			}
			// 忽略错误，避免阻塞
			_ = err
		}
	}
}

// handleFsnotifyEvent 处理单个 fsnotify 事件，应用防抖
func (fw *FileWatcher) handleFsnotifyEvent(event fsnotify.Event) {
	path := event.Name

	// 将 fsnotify 事件转换为我们的 FileEvent
	var fileEvent FileEvent

	// 确定事件类型
	if event.Op&fsnotify.Create == fsnotify.Create {
		fileEvent = FileEvent{Type: FileEventCreate, Path: path}
	} else if event.Op&fsnotify.Write == fsnotify.Write {
		fileEvent = FileEvent{Type: FileEventModify, Path: path}
	} else if event.Op&fsnotify.Remove == fsnotify.Remove {
		fileEvent = FileEvent{Type: FileEventDelete, Path: path}
	} else if event.Op&fsnotify.Rename == fsnotify.Rename {
		fileEvent = FileEvent{Type: FileEventRename, Path: path}
	} else if event.Op&fsnotify.Chmod == fsnotify.Chmod {
		// 权限变更视为修改
		fileEvent = FileEvent{Type: FileEventModify, Path: path}
	} else {
		return // 未知事件类型，忽略
	}

	// 防抖处理：同一路径的同类事件在防抖窗口内只发送最后一次
	fw.debounceMu.Lock()

	// 取消该路径已存在的定时器
	if timer, exists := fw.debouncers[path]; exists {
		timer.Stop()
	}

	// 创建新的防抖定时器
	timer := time.AfterFunc(fw.debounceDelay, func() {
		fw.debounceMu.Lock()
		delete(fw.debouncers, path)
		fw.debounceMu.Unlock()

		// 发送事件到通道（非阻塞）
		select {
		case fw.eventChan <- fileEvent:
		case <-fw.closeChan:
			return
		default:
			// 通道已满，丢弃事件
		}
	})

	fw.debouncers[path] = timer
	fw.debounceMu.Unlock()
}

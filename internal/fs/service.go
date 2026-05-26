package fs

import (
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"sync"
)

// FileService 提供文件系统操作服务
type FileService struct {
	mu         sync.RWMutex          // 保护 watchedPaths
	watchedPaths map[string]struct{} // 已监控的路径集合
	watcher    *FileWatcher          // 文件监听器
}

// NewFileService 创建新的文件服务实例
func NewFileService() *FileService {
	return &FileService{
		watchedPaths: make(map[string]struct{}),
	}
}

// SetWatcher 设置文件监听器（在 app.go 中初始化后调用）
func (s *FileService) SetWatcher(watcher *FileWatcher) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.watcher = watcher
}

// isPathSafe 检查路径是否安全（防止目录遍历攻击）
// 目标路径必须在允许的基础路径之下
func isPathSafe(targetPath, basePath string) bool {
	// 获取绝对路径
	absTarget, err := filepath.Abs(targetPath)
	if err != nil {
		return false
	}
	absBase, err := filepath.Abs(basePath)
	if err != nil {
		return false
	}

	// 清理路径
	absTarget = filepath.Clean(absTarget)
	absBase = filepath.Clean(absBase)

	// 检查目标路径是否在基础路径之下
	// 添加路径分隔符以确保是子目录而不是前缀匹配
	prefix := absBase + string(os.PathSeparator)
	if absTarget == absBase || strings.HasPrefix(absTarget, prefix) {
		return true
	}
	return false
}

// FileSize 返回指定文件的大小（字节），不读取文件内容
func (s *FileService) FileSize(path string) (int64, error) {
	if strings.Contains(path, "..") {
		return 0, fmt.Errorf("非法路径: %s", path)
	}

	info, err := os.Stat(path)
	if err != nil {
		return 0, fmt.Errorf("获取文件信息失败: %w", err)
	}
	if info.IsDir() {
		return 0, fmt.Errorf("路径是目录: %s", path)
	}
	return info.Size(), nil
}

// ReadFile 读取指定路径的文件内容
func (s *FileService) ReadFile(path string) ([]byte, error) {
	// 安全检查：路径不能包含 .. 等目录遍历字符
	if strings.Contains(path, "..") {
		return nil, fmt.Errorf("非法路径: %s", path)
	}

	// 读取文件
	content, err := os.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("读取文件失败: %w", err)
	}
	return content, nil
}

// WriteFile 写入内容到指定路径的文件
func (s *FileService) WriteFile(path string, content []byte) error {
	// 安全检查
	if strings.Contains(path, "..") {
		return fmt.Errorf("非法路径: %s", path)
	}

	// 确保父目录存在
	dir := filepath.Dir(path)
	if err := ensureDirExists(dir, 0755); err != nil {
		return fmt.Errorf("创建目录失败: %w", err)
	}

	// 写入文件
	if err := os.WriteFile(path, content, 0644); err != nil {
		return fmt.Errorf("写入文件失败: %w", err)
	}
	return nil
}

// CreateFile 在指定路径创建文件或目录
func (s *FileService) CreateFile(path string, isDir bool) error {
	// 安全检查
	if strings.Contains(path, "..") {
		return fmt.Errorf("非法路径: %s", path)
	}

	if isDir {
		// 创建目录
		if err := os.MkdirAll(path, 0755); err != nil {
			return fmt.Errorf("创建目录失败: %w", err)
		}
	} else {
		// 确保父目录存在
		dir := filepath.Dir(path)
		if err := ensureDirExists(dir, 0755); err != nil {
			return fmt.Errorf("创建目录失败: %w", err)
		}
		// 创建空文件
		file, err := os.Create(path)
		if err != nil {
			return fmt.Errorf("创建文件失败: %w", err)
		}
		file.Close()
	}
	return nil
}

// DeleteFile 删除指定路径的文件或目录
func (s *FileService) DeleteFile(path string) error {
	// 安全检查
	if strings.Contains(path, "..") {
		return fmt.Errorf("非法路径: %s", path)
	}

	// 删除文件或目录
	if err := os.RemoveAll(path); err != nil {
		return fmt.Errorf("删除失败: %w", err)
	}
	return nil
}

// RenameFile 重命名/移动文件或目录
func (s *FileService) RenameFile(oldPath, newPath string) error {
	// 安全检查
	if strings.Contains(oldPath, "..") || strings.Contains(newPath, "..") {
		return fmt.Errorf("非法路径")
	}

	// 确保新路径的父目录存在
	dir := filepath.Dir(newPath)
	if err := ensureDirExists(dir, 0755); err != nil {
		return fmt.Errorf("创建目标目录失败: %w", err)
	}

	// 重命名
	if err := os.Rename(oldPath, newPath); err != nil {
		return fmt.Errorf("重命名失败: %w", err)
	}
	return nil
}

// GetFileTree 递归遍历指定根目录，返回文件树结构
func (s *FileService) GetFileTree(root string) (*FileNode, error) {
	// 安全检查
	if strings.Contains(root, "..") {
		return nil, fmt.Errorf("非法路径: %s", root)
	}

	// 获取根目录信息
	info, err := os.Stat(root)
	if err != nil {
		return nil, fmt.Errorf("无法访问路径: %w", err)
	}

	if !info.IsDir() {
		return nil, fmt.Errorf("路径不是目录: %s", root)
	}

	// 构建文件树
	node := &FileNode{
		Name:    filepath.Base(root),
		Path:    root,
		IsDir:   true,
		ModTime: info.ModTime(),
	}

	if err := s.buildFileTree(node); err != nil {
		return nil, err
	}

	return node, nil
}

// buildFileTree 递归构建文件树（内部方法）
func (s *FileService) buildFileTree(node *FileNode) error {
	entries, err := os.ReadDir(node.Path)
	if err != nil {
		return fmt.Errorf("读取目录失败 %s: %w", node.Path, err)
	}

	// 排序：目录在前，文件在后，同类型按字母顺序
	sort.Slice(entries, func(i, j int) bool {
		iIsDir := entries[i].IsDir()
		jIsDir := entries[j].IsDir()
		if iIsDir != jIsDir {
			return iIsDir // 目录排在前面
		}
		return entries[i].Name() < entries[j].Name() // 同类型按字母顺序
	})

	for _, entry := range entries {
		info, err := entry.Info()
		if err != nil {
			continue // 跳过无法获取信息的文件
		}

		child := &FileNode{
			Name:    entry.Name(),
			Path:    filepath.Join(node.Path, entry.Name()),
			IsDir:   entry.IsDir(),
			ModTime: info.ModTime(),
			Size:    info.Size(),
		}

		if entry.IsDir() {
			if err := s.buildFileTree(child); err != nil {
				// 忽略无权限的目录，继续遍历其他目录
				continue
			}
		}

		node.Children = append(node.Children, child)
	}

	return nil
}

// Watch 开始监听指定路径的文件变更
func (s *FileService) Watch(path string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	if s.watcher == nil {
		return fmt.Errorf("监听器未初始化")
	}

	if _, exists := s.watchedPaths[path]; exists {
		return nil // 已在监听中
	}

	if err := s.watcher.Watch(path); err != nil {
		return err
	}

	s.watchedPaths[path] = struct{}{}
	return nil
}

// Unwatch 停止监听指定路径
func (s *FileService) Unwatch(path string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	if s.watcher == nil {
		return fmt.Errorf("监听器未初始化")
	}

	if _, exists := s.watchedPaths[path]; !exists {
		return nil // 未在监听中
	}

	if err := s.watcher.Unwatch(path); err != nil {
		return err
	}

	delete(s.watchedPaths, path)
	return nil
}

// GetEventChannel 获取文件变更事件通道（供前端消费）
func (s *FileService) GetEventChannel() <-chan FileEvent {
	s.mu.RLock()
	defer s.mu.RUnlock()

	if s.watcher == nil {
		return nil
	}
	return s.watcher.Events()
}

// Close 关闭文件服务，释放资源
func (s *FileService) Close() error {
	s.mu.Lock()
	defer s.mu.Unlock()

	if s.watcher != nil {
		return s.watcher.Close()
	}
	return nil
}

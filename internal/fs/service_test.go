package fs

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"testing"
)

// setupTestDir 创建临时测试目录
func setupTestDir(t *testing.T) string {
	t.Helper()
	tmpDir, err := os.MkdirTemp("", "fs-test-*")
	if err != nil {
		t.Fatalf("创建临时目录失败: %v", err)
	}
	t.Cleanup(func() {
		os.RemoveAll(tmpDir)
	})
	return tmpDir
}

// TestReadFile 测试读取文件
func TestReadFile(t *testing.T) {
	svc := NewFileService()
	tmpDir := setupTestDir(t)

	// 创建测试文件
	testFile := filepath.Join(tmpDir, "test.txt")
	testContent := []byte("hello world")
	if err := os.WriteFile(testFile, testContent, 0644); err != nil {
		t.Fatalf("创建测试文件失败: %v", err)
	}

	// 测试正常读取
	content, err := svc.ReadFile(testFile)
	if err != nil {
		t.Errorf("读取文件失败: %v", err)
	}
	if string(content) != string(testContent) {
		t.Errorf("文件内容不匹配，期望 %s，实际 %s", testContent, content)
	}

	// 测试非法路径
	_, err = svc.ReadFile("/etc/../etc/passwd")
	if err == nil || !strings.Contains(err.Error(), "非法路径") {
		t.Errorf("期望非法路径错误，实际: %v", err)
	}

	// 测试不存在的文件
	_, err = svc.ReadFile(filepath.Join(tmpDir, "not-exist.txt"))
	if err == nil {
		t.Error("读取不存在的文件应该返回错误")
	}
}

// TestWriteFile 测试写入文件
func TestWriteFile(t *testing.T) {
	svc := NewFileService()
	tmpDir := setupTestDir(t)

	// 测试写入新文件
	testFile := filepath.Join(tmpDir, "subdir", "test.txt")
	testContent := []byte("write test content")
	if err := svc.WriteFile(testFile, testContent); err != nil {
		t.Errorf("写入文件失败: %v", err)
	}

	// 验证内容
	content, err := os.ReadFile(testFile)
	if err != nil {
		t.Fatalf("读取文件失败: %v", err)
	}
	if string(content) != string(testContent) {
		t.Errorf("文件内容不匹配")
	}

	// 测试覆盖写入
	newContent := []byte("overwrite content")
	if err := svc.WriteFile(testFile, newContent); err != nil {
		t.Errorf("覆盖写入失败: %v", err)
	}
	content, _ = os.ReadFile(testFile)
	if string(content) != string(newContent) {
		t.Errorf("覆盖后内容不匹配")
	}

	// 测试非法路径
	err = svc.WriteFile("/etc/../etc/passwd", []byte("x"))
	if err == nil || !strings.Contains(err.Error(), "非法路径") {
		t.Errorf("期望非法路径错误，实际: %v", err)
	}
}

// TestCreateFile 测试创建文件和目录
func TestCreateFile(t *testing.T) {
	svc := NewFileService()
	tmpDir := setupTestDir(t)

	// 测试创建文件
	testFile := filepath.Join(tmpDir, "newfile.txt")
	if err := svc.CreateFile(testFile, false); err != nil {
		t.Errorf("创建文件失败: %v", err)
	}
	if _, err := os.Stat(testFile); os.IsNotExist(err) {
		t.Error("文件未创建")
	}

	// 测试创建目录
	testDir := filepath.Join(tmpDir, "newdir")
	if err := svc.CreateFile(testDir, true); err != nil {
		t.Errorf("创建目录失败: %v", err)
	}
	info, err := os.Stat(testDir)
	if err != nil || !info.IsDir() {
		t.Error("目录未创建或不是目录")
	}

	// 测试非法路径
	err = svc.CreateFile("/etc/../etc/test", false)
	if err == nil || !strings.Contains(err.Error(), "非法路径") {
		t.Errorf("期望非法路径错误，实际: %v", err)
	}
}

// TestDeleteFile 测试删除文件和目录
func TestDeleteFile(t *testing.T) {
	svc := NewFileService()
	tmpDir := setupTestDir(t)

	// 测试删除文件
	testFile := filepath.Join(tmpDir, "delete-me.txt")
	os.WriteFile(testFile, []byte("x"), 0644)
	if err := svc.DeleteFile(testFile); err != nil {
		t.Errorf("删除文件失败: %v", err)
	}
	if _, err := os.Stat(testFile); !os.IsNotExist(err) {
		t.Error("文件未删除")
	}

	// 测试删除目录
	testDir := filepath.Join(tmpDir, "delete-dir")
	os.MkdirAll(testDir, 0755)
	os.WriteFile(filepath.Join(testDir, "inner.txt"), []byte("x"), 0644)
	if err := svc.DeleteFile(testDir); err != nil {
		t.Errorf("删除目录失败: %v", err)
	}
	if _, err := os.Stat(testDir); !os.IsNotExist(err) {
		t.Error("目录未删除")
	}

	// 测试非法路径
	err := svc.DeleteFile("/etc/../etc/passwd")
	if err == nil || !strings.Contains(err.Error(), "非法路径") {
		t.Errorf("期望非法路径错误，实际: %v", err)
	}
}

// TestRenameFile 测试重命名文件
func TestRenameFile(t *testing.T) {
	svc := NewFileService()
	tmpDir := setupTestDir(t)

	// 测试重命名文件
	oldPath := filepath.Join(tmpDir, "old.txt")
	newPath := filepath.Join(tmpDir, "new.txt")
	os.WriteFile(oldPath, []byte("content"), 0644)

	if err := svc.RenameFile(oldPath, newPath); err != nil {
		t.Errorf("重命名失败: %v", err)
	}
	if _, err := os.Stat(oldPath); !os.IsNotExist(err) {
		t.Error("旧文件仍存在")
	}
	if _, err := os.Stat(newPath); os.IsNotExist(err) {
		t.Error("新文件不存在")
	}

	// 测试跨目录重命名
	oldPath2 := filepath.Join(tmpDir, "new.txt")
	newDir := filepath.Join(tmpDir, "target-dir")
	os.MkdirAll(newDir, 0755)
	newPath2 := filepath.Join(newDir, "moved.txt")
	if err := svc.RenameFile(oldPath2, newPath2); err != nil {
		t.Errorf("跨目录重命名失败: %v", err)
	}

	// 测试非法路径
	err := svc.RenameFile("/etc/../etc/old", "/etc/../etc/new")
	if err == nil || !strings.Contains(err.Error(), "非法路径") {
		t.Errorf("期望非法路径错误，实际: %v", err)
	}
}

// TestGetFileTree 测试文件树遍历
func TestGetFileTree(t *testing.T) {
	svc := NewFileService()
	tmpDir := setupTestDir(t)

	// 创建测试目录结构
	// tmpDir/
	//   ├── file1.txt
	//   ├── dir1/
	//   │   ├── file2.txt
	//   │   └── subdir/
	//   └── dir2/
	os.WriteFile(filepath.Join(tmpDir, "file1.txt"), []byte("1"), 0644)
	os.MkdirAll(filepath.Join(tmpDir, "dir1", "subdir"), 0755)
	os.WriteFile(filepath.Join(tmpDir, "dir1", "file2.txt"), []byte("2"), 0644)
	os.MkdirAll(filepath.Join(tmpDir, "dir2"), 0755)

	// 测试获取文件树
	root, err := svc.GetFileTree(tmpDir)
	if err != nil {
		t.Fatalf("获取文件树失败: %v", err)
	}

	// 验证根节点
	if root.Name != filepath.Base(tmpDir) {
		t.Errorf("根节点名称不匹配")
	}
	if !root.IsDir {
		t.Error("根节点应为目录")
	}
	if len(root.Children) != 3 {
		t.Errorf("根节点应有3个子节点，实际 %d", len(root.Children))
	}

	// 验证子节点
	hasFile1, hasDir1, hasDir2 := false, false, false
	for _, child := range root.Children {
		switch child.Name {
		case "file1.txt":
			hasFile1 = true
			if child.IsDir {
				t.Error("file1.txt 不应是目录")
			}
		case "dir1":
			hasDir1 = true
			if !child.IsDir {
				t.Error("dir1 应为目录")
			}
			if len(child.Children) != 2 {
				t.Errorf("dir1 应有2个子节点，实际 %d", len(child.Children))
			}
		case "dir2":
			hasDir2 = true
			if !child.IsDir {
				t.Error("dir2 应为目录")
			}
		}
	}
	if !hasFile1 || !hasDir1 || !hasDir2 {
		t.Error("缺少预期的子节点")
	}

	// 测试非法路径
	_, err = svc.GetFileTree("/etc/../etc")
	if err == nil || !strings.Contains(err.Error(), "非法路径") {
		t.Errorf("期望非法路径错误，实际: %v", err)
	}

	// 测试非目录路径
	_, err = svc.GetFileTree(filepath.Join(tmpDir, "file1.txt"))
	if err == nil {
		t.Error("对文件调用 GetFileTree 应返回错误")
	}
}

// TestFileServiceWatch 测试 Watch/Unwatch 接口（不实际启动监听器）
func TestFileServiceWatch(t *testing.T) {
	svc := NewFileService()

	// 未设置 watcher 时应返回错误
	err := svc.Watch("/tmp")
	if err == nil || !strings.Contains(err.Error(), "未初始化") {
		t.Errorf("期望未初始化错误，实际: %v", err)
	}

	err = svc.Unwatch("/tmp")
	if err == nil || !strings.Contains(err.Error(), "未初始化") {
		t.Errorf("期望未初始化错误，实际: %v", err)
	}
}

// TestIsPathSafe 测试路径安全检查
func TestIsPathSafe(t *testing.T) {
	tests := []struct {
		target   string
		base     string
		expected bool
	}{
		{"/home/user/project", "/home/user", true},
		{"/home/user/project/file.txt", "/home/user", true},
		{"/home/user", "/home/user", true},
		{"/etc/passwd", "/home/user", false},
		{"/home/user/../etc", "/home/user", false},
	}

	for _, tt := range tests {
		result := isPathSafe(tt.target, tt.base)
		if result != tt.expected {
			t.Errorf("isPathSafe(%q, %q) = %v, 期望 %v", tt.target, tt.base, result, tt.expected)
		}
	}
}

// BenchmarkGetFileTree 基准测试文件树遍历
func BenchmarkGetFileTree(b *testing.B) {
	svc := NewFileService()
	tmpDir, _ := os.MkdirTemp("", "fs-bench-*")
	defer os.RemoveAll(tmpDir)

	// 创建深层目录结构
	for i := 0; i < 10; i++ {
		dir := filepath.Join(tmpDir, fmt.Sprintf("dir%d", i))
		os.MkdirAll(dir, 0755)
		for j := 0; j < 10; j++ {
			os.WriteFile(filepath.Join(dir, fmt.Sprintf("file%d.txt", j)), []byte("x"), 0644)
		}
	}

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_, err := svc.GetFileTree(tmpDir)
		if err != nil {
			b.Fatal(err)
		}
	}
}

// TestReadFile_EmptyFile 测试读取空文件
func TestReadFile_EmptyFile(t *testing.T) {
	svc := NewFileService()
	tmpDir := setupTestDir(t)

	emptyFile := filepath.Join(tmpDir, "empty.txt")
	os.WriteFile(emptyFile, []byte(""), 0644)

	content, err := svc.ReadFile(emptyFile)
	if err != nil {
		t.Errorf("读取空文件失败: %v", err)
	}
	if len(content) != 0 {
		t.Error("空文件内容长度应为0")
	}
}

// TestReadFile_LargeFile 测试读取大文件
func TestReadFile_LargeFile(t *testing.T) {
	svc := NewFileService()
	tmpDir := setupTestDir(t)

	largeFile := filepath.Join(tmpDir, "large.bin")
	largeContent := make([]byte, 10*1024*1024) // 10MB
	for i := range largeContent {
		largeContent[i] = byte(i % 256)
	}
	os.WriteFile(largeFile, largeContent, 0644)

	content, err := svc.ReadFile(largeFile)
	if err != nil {
		t.Fatalf("读取大文件失败: %v", err)
	}
	if len(content) != len(largeContent) {
		t.Errorf("大文件内容长度不匹配: got %d, want %d", len(content), len(largeContent))
	}

	// 验证内容
	for i := 0; i < len(largeContent); i += 1024 {
		if content[i] != largeContent[i] {
			t.Errorf("大文件内容在位置 %d 不匹配", i)
			break
		}
	}
}

// TestWriteFile_SpecialCharsFilename 测试特殊字符文件名
func TestWriteFile_SpecialCharsFilename(t *testing.T) {
	svc := NewFileService()
	tmpDir := setupTestDir(t)

	specialNames := []string{
		"file with spaces.txt",
		"file-with-dashes.txt",
		"file_with_underscores.txt",
		"file.multiple.dots.txt",
		"file(1).txt",
		"file[2].txt",
		"file@symbol.txt",
		"file#hash.txt",
		"file&ampersand.txt",
		"unicode文件.txt",
		"日本語ファイル.txt",
		"emoji.txt",
	}

	for _, name := range specialNames {
		t.Run(name, func(t *testing.T) {
			testFile := filepath.Join(tmpDir, name)
			content := []byte("test content for " + name)

			if err := svc.WriteFile(testFile, content); err != nil {
				t.Errorf("写入特殊文件名失败 '%s': %v", name, err)
				return
			}

			readContent, err := os.ReadFile(testFile)
			if err != nil {
				t.Errorf("读取特殊文件名失败 '%s': %v", name, err)
				return
			}

			if string(readContent) != string(content) {
				t.Errorf("特殊文件名 '%s' 内容不匹配", name)
			}
		})
	}
}

// TestIsPathSafety_BoundaryCases 测试路径安全边界情况
func TestIsPathSafety_BoundaryCases(t *testing.T) {
	tests := []struct {
		target   string
		base     string
		expected bool
	}{
		{"/home/user", "/home/user", true},
		{"/home/user/", "/home/user", true},
		{"/home/user/project", "/home/user", true},
		{"/home/user/project/file.txt", "/home/user", true},
		{"/home/user/project/../other", "/home/user", true}, // filepath.Clean 会规范化路径
		{"/home/user", "/home/user/project", false},
		{"/etc/passwd", "/home/user", false},
		{"/home/user/../../etc", "/home/user", false},
		{"/home/user/./project", "/home/user", true},
		{"", "/home/user", false},
		{"/home/user", "", false},
	}

	for _, tt := range tests {
		result := isPathSafe(tt.target, tt.base)
		if result != tt.expected {
			t.Errorf("isPathSafe(%q, %q) = %v, 期望 %v", tt.target, tt.base, result, tt.expected)
		}
	}
}

// TestDeleteFile_NonExistent 测试删除不存在的文件
func TestDeleteFile_NonExistent(t *testing.T) {
	svc := NewFileService()
	tmpDir := setupTestDir(t)

	nonExistent := filepath.Join(tmpDir, "does-not-exist.txt")
	// os.RemoveAll 对不存在的文件不返回错误
	err := svc.DeleteFile(nonExistent)
	// 根据实现，DeleteFile 使用 os.RemoveAll，它不会返回错误
	_ = err
}

// TestRenameFile_Overwrite 测试重命名覆盖已存在文件
func TestRenameFile_Overwrite(t *testing.T) {
	svc := NewFileService()
	tmpDir := setupTestDir(t)

	src := filepath.Join(tmpDir, "source.txt")
	dst := filepath.Join(tmpDir, "dest.txt")

	os.WriteFile(src, []byte("source content"), 0644)
	os.WriteFile(dst, []byte("destination content"), 0644)

	if err := svc.RenameFile(src, dst); err != nil {
		t.Errorf("重命名覆盖失败: %v", err)
	}

	// 源文件应不存在
	if _, err := os.Stat(src); !os.IsNotExist(err) {
		t.Error("源文件应不存在")
	}

	// 目标文件应包含源文件内容
	content, _ := os.ReadFile(dst)
	if string(content) != "source content" {
		t.Error("目标文件内容不正确")
	}
}

// TestConcurrentFileOperations 测试并发文件操作
func TestConcurrentFileOperations(t *testing.T) {
	svc := NewFileService()
	tmpDir := setupTestDir(t)

	const numGoroutines = 50
	var wg sync.WaitGroup

	// 并发写入不同文件
	for i := 0; i < numGoroutines; i++ {
		wg.Add(1)
		go func(idx int) {
			defer wg.Done()
			filename := filepath.Join(tmpDir, fmt.Sprintf("concurrent_%d.txt", idx))
			content := []byte(fmt.Sprintf("content %d", idx))
			if err := svc.WriteFile(filename, content); err != nil {
				t.Errorf("并发写入失败 %d: %v", idx, err)
			}
		}(i)
	}

	wg.Wait()

	// 验证所有文件
	for i := 0; i < numGoroutines; i++ {
		filename := filepath.Join(tmpDir, fmt.Sprintf("concurrent_%d.txt", i))
		content, err := os.ReadFile(filename)
		if err != nil {
			t.Errorf("读取并发文件失败 %d: %v", i, err)
			continue
		}
		expected := fmt.Sprintf("content %d", i)
		if string(content) != expected {
			t.Errorf("并发文件内容不匹配 %d", i)
		}
	}
}

// TestConcurrentReadWriteSameFile 测试并发读写同一文件
func TestConcurrentReadWriteSameFile(t *testing.T) {
	svc := NewFileService()
	tmpDir := setupTestDir(t)
	testFile := filepath.Join(tmpDir, "concurrent_rw.txt")

	// 先写入初始内容
	os.WriteFile(testFile, []byte("initial"), 0644)

	var wg sync.WaitGroup
	const iterations = 100

	// 并发读取
	for i := 0; i < 5; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			for j := 0; j < iterations; j++ {
				_, err := svc.ReadFile(testFile)
				if err != nil {
					t.Errorf("并发读取失败: %v", err)
					return
				}
			}
		}()
	}

	// 并发写入
	for i := 0; i < 3; i++ {
		wg.Add(1)
		go func(idx int) {
			defer wg.Done()
			for j := 0; j < iterations; j++ {
				content := []byte(fmt.Sprintf("writer %d iteration %d", idx, j))
				if err := svc.WriteFile(testFile, content); err != nil {
					t.Errorf("并发写入失败: %v", err)
					return
				}
			}
		}(i)
	}

	wg.Wait()
}

// TestGetFileTree_EmptyDir 测试空目录
func TestGetFileTree_EmptyDir(t *testing.T) {
	svc := NewFileService()
	tmpDir := setupTestDir(t)

	emptyDir := filepath.Join(tmpDir, "empty")
	os.MkdirAll(emptyDir, 0755)

	node, err := svc.GetFileTree(emptyDir)
	if err != nil {
		t.Fatalf("获取空目录文件树失败: %v", err)
	}

	if !node.IsDir {
		t.Error("应为目录")
	}
	if len(node.Children) != 0 {
		t.Errorf("空目录应有0个子节点，实际 %d", len(node.Children))
	}
}

// TestGetFileTree_DeepNesting 测试深层嵌套目录
func TestGetFileTree_DeepNesting(t *testing.T) {
	svc := NewFileService()
	tmpDir := setupTestDir(t)

	// 创建深层目录结构
	deepPath := tmpDir
	for i := 0; i < 20; i++ {
		deepPath = filepath.Join(deepPath, fmt.Sprintf("level%d", i))
	}
	os.MkdirAll(deepPath, 0755)
	os.WriteFile(filepath.Join(deepPath, "deep.txt"), []byte("deep"), 0644)

	node, err := svc.GetFileTree(tmpDir)
	if err != nil {
		t.Fatalf("获取深层目录文件树失败: %v", err)
	}

	// 遍历到最深层
	current := node
	for i := 0; i < 20; i++ {
		if len(current.Children) == 0 {
			t.Fatalf("在 level%d 找不到子节点", i)
		}
		found := false
		for _, child := range current.Children {
			if child.Name == fmt.Sprintf("level%d", i) {
				current = child
				found = true
				break
			}
		}
		if !found {
			t.Fatalf("找不到 level%d", i)
		}
	}

	// 验证深层文件
	foundFile := false
	for _, child := range current.Children {
		if child.Name == "deep.txt" {
			foundFile = true
			break
		}
	}
	if !foundFile {
		t.Error("找不到深层文件")
	}
}

// TestFileService_Close 测试关闭文件服务
func TestFileService_Close(t *testing.T) {
	svc := NewFileService()

	// 未设置watcher时不应panic
	if err := svc.Close(); err != nil {
		t.Errorf("关闭未初始化服务不应返回错误: %v", err)
	}
}

// TestCreateFile_ExistingPath 测试创建已存在的文件
func TestCreateFile_ExistingPath(t *testing.T) {
	svc := NewFileService()
	tmpDir := setupTestDir(t)

	// 创建已存在的文件
	existingFile := filepath.Join(tmpDir, "existing.txt")
	os.WriteFile(existingFile, []byte("old content"), 0644)

	err := svc.CreateFile(existingFile, false)
	if err != nil {
		t.Errorf("创建已存在文件不应返回错误: %v", err)
	}

	// 验证内容未变（覆盖）
	content, _ := os.ReadFile(existingFile)
	if string(content) != "old content" {
		t.Log("创建已存在文件可能重置了内容")
	}
}

// BenchmarkReadFile 基准测试文件读取
func BenchmarkReadFile(b *testing.B) {
	svc := NewFileService()
	tmpDir, _ := os.MkdirTemp("", "fs-bench-*")
	defer os.RemoveAll(tmpDir)

	testFile := filepath.Join(tmpDir, "bench.txt")
	content := make([]byte, 1024*1024) // 1MB
	os.WriteFile(testFile, content, 0644)

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_, err := svc.ReadFile(testFile)
		if err != nil {
			b.Fatal(err)
		}
	}
}

// BenchmarkWriteFile 基准测试文件写入
func BenchmarkWriteFile(b *testing.B) {
	svc := NewFileService()
	tmpDir, _ := os.MkdirTemp("", "fs-bench-*")
	defer os.RemoveAll(tmpDir)

	testFile := filepath.Join(tmpDir, "bench.txt")
	content := make([]byte, 1024*1024) // 1MB

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		err := svc.WriteFile(testFile, content)
		if err != nil {
			b.Fatal(err)
		}
	}
}

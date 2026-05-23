package e2e

import (
	"bytes"
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/swcrbt/ai-ide/internal/fs"
)

func TestFileService_GetFileTree(t *testing.T) {
	t.Parallel()

	tempDir := setupTestDir(t)
	defer cleanupTestDir(t, tempDir)

	createTestFile(t, filepath.Join(tempDir, "file1.txt"), "content1")
	createTestFile(t, filepath.Join(tempDir, "subdir", "file2.txt"), "content2")
	createTestDir(t, filepath.Join(tempDir, "emptydir"))

	service := fs.NewFileService()
	root, err := service.GetFileTree(tempDir)
	if err != nil {
		t.Fatalf("GetFileTree 失败: %v", err)
	}

	if root.Name != filepath.Base(tempDir) {
		t.Errorf("根节点名称错误: got %q, want %q", root.Name, filepath.Base(tempDir))
	}
	if !root.IsDir {
		t.Error("根节点应为目录")
	}
	if len(root.Children) != 3 {
		t.Errorf("子节点数量错误: got %d, want 3", len(root.Children))
	}

	names := make(map[string]bool)
	for _, child := range root.Children {
		names[child.Name] = true
		if child.Name == "subdir" {
			if len(child.Children) != 1 || child.Children[0].Name != "file2.txt" {
				t.Error("subdir 子节点结构错误")
			}
		}
	}
	if !names["file1.txt"] || !names["subdir"] || !names["emptydir"] {
		t.Error("子节点名称不匹配")
	}
}

func TestFileService_ReadFile(t *testing.T) {
	t.Parallel()

	tempDir := setupTestDir(t)
	defer cleanupTestDir(t, tempDir)

	want := "hello, world"
	path := filepath.Join(tempDir, "test.txt")
	createTestFile(t, path, want)

	service := fs.NewFileService()
	got, err := service.ReadFile(path)
	if err != nil {
		t.Fatalf("ReadFile 失败: %v", err)
	}
	if string(got) != want {
		t.Errorf("内容不匹配: got %q, want %q", string(got), want)
	}
}

func TestFileService_WriteFile(t *testing.T) {
	t.Parallel()

	tempDir := setupTestDir(t)
	defer cleanupTestDir(t, tempDir)

	path := filepath.Join(tempDir, "write.txt")
	want := []byte("written content")

	service := fs.NewFileService()
	if err := service.WriteFile(path, want); err != nil {
		t.Fatalf("WriteFile 失败: %v", err)
	}

	got, err := os.ReadFile(path)
	if err != nil {
		t.Fatalf("读取文件失败: %v", err)
	}
	if !bytes.Equal(got, want) {
		t.Errorf("内容不匹配: got %q, want %q", got, want)
	}
}

func TestFileService_CreateFile(t *testing.T) {
	t.Parallel()

	tempDir := setupTestDir(t)
	defer cleanupTestDir(t, tempDir)

	path := filepath.Join(tempDir, "newfile.txt")

	service := fs.NewFileService()
	if err := service.CreateFile(path, false); err != nil {
		t.Fatalf("CreateFile 失败: %v", err)
	}

	if !fileExists(path) {
		t.Error("文件未创建")
	}

	info, err := os.Stat(path)
	if err != nil {
		t.Fatalf("Stat 失败: %v", err)
	}
	if info.IsDir() {
		t.Error("创建的是文件，不应为目录")
	}
}

func TestFileService_DeleteFile(t *testing.T) {
	t.Parallel()

	tempDir := setupTestDir(t)
	defer cleanupTestDir(t, tempDir)

	path := filepath.Join(tempDir, "todelete.txt")
	createTestFile(t, path, "delete me")

	if !fileExists(path) {
		t.Fatal("测试前置条件失败：文件未创建")
	}

	service := fs.NewFileService()
	if err := service.DeleteFile(path); err != nil {
		t.Fatalf("DeleteFile 失败: %v", err)
	}

	if fileExists(path) {
		t.Error("文件应已被删除")
	}
}

func TestFileService_RenameFile(t *testing.T) {
	t.Parallel()

	tempDir := setupTestDir(t)
	defer cleanupTestDir(t, tempDir)

	oldPath := filepath.Join(tempDir, "old.txt")
	newPath := filepath.Join(tempDir, "new.txt")
	createTestFile(t, oldPath, "rename me")

	service := fs.NewFileService()
	if err := service.RenameFile(oldPath, newPath); err != nil {
		t.Fatalf("RenameFile 失败: %v", err)
	}

	if fileExists(oldPath) {
		t.Error("旧文件应不存在")
	}
	if !fileExists(newPath) {
		t.Error("新文件应存在")
	}

	content, err := os.ReadFile(newPath)
	if err != nil {
		t.Fatalf("读取新文件失败: %v", err)
	}
	if string(content) != "rename me" {
		t.Errorf("内容不匹配: got %q", string(content))
	}
}

func TestFileService_CreateDirectory(t *testing.T) {
	t.Parallel()

	tempDir := setupTestDir(t)
	defer cleanupTestDir(t, tempDir)

	path := filepath.Join(tempDir, "newdir")

	service := fs.NewFileService()
	if err := service.CreateFile(path, true); err != nil {
		t.Fatalf("CreateFile(isDir=true) 失败: %v", err)
	}

	if !fileExists(path) {
		t.Error("目录未创建")
	}

	info, err := os.Stat(path)
	if err != nil {
		t.Fatalf("Stat 失败: %v", err)
	}
	if !info.IsDir() {
		t.Error("创建的应为目录")
	}
}

func TestFileService_DeleteDirectory(t *testing.T) {
	t.Parallel()

	tempDir := setupTestDir(t)
	defer cleanupTestDir(t, tempDir)

	path := filepath.Join(tempDir, "todelete")
	createTestDir(t, path)
	createTestFile(t, filepath.Join(path, "inner.txt"), "inside")

	if !fileExists(path) {
		t.Fatal("测试前置条件失败：目录未创建")
	}

	service := fs.NewFileService()
	if err := service.DeleteFile(path); err != nil {
		t.Fatalf("DeleteFile 失败: %v", err)
	}

	if fileExists(path) {
		t.Error("目录应已被删除")
	}
}

func TestFileService_WatchDirectory(t *testing.T) {
	tempDir := setupTestDir(t)
	defer cleanupTestDir(t, tempDir)

	watcher, err := fs.NewFileWatcher()
	if err != nil {
		t.Fatalf("创建 FileWatcher 失败: %v", err)
	}
	defer watcher.Close()

	service := fs.NewFileService()
	service.SetWatcher(watcher)

	if err := service.Watch(tempDir); err != nil {
		t.Fatalf("Watch 失败: %v", err)
	}

	time.Sleep(200 * time.Millisecond)

	newFile := filepath.Join(tempDir, "watched.txt")
	createTestFile(t, newFile, "watch me")

	select {
	case event := <-service.GetEventChannel():
		if event.Type != fs.FileEventCreate {
			t.Errorf("事件类型错误: got %q, want %q", event.Type, fs.FileEventCreate)
		}
		if filepath.Base(event.Path) != "watched.txt" {
			t.Errorf("事件路径错误: got %q", event.Path)
		}
	case <-time.After(3 * time.Second):
		t.Fatal("等待文件创建事件超时")
	}
}

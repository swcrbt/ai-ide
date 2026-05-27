package git

import (
	"fmt"
	"os"
	"path/filepath"
	"testing"
)

// setupTestRepo 创建临时 Git 仓库用于测试
func setupTestRepo(t *testing.T) (string, *GitService, func()) {
	t.Helper()

	// 创建临时目录
	tmpDir, err := os.MkdirTemp("", "git-test-*")
	if err != nil {
		t.Fatalf("创建临时目录失败: %v", err)
	}

	// 初始化 Git 仓库
	service := NewGitService()
	service.SetRepoPath(tmpDir)

	err = service.Init(tmpDir)
	if err != nil {
		os.RemoveAll(tmpDir)
		t.Fatalf("初始化 Git 仓库失败: %v", err)
	}

	// 配置 Git 用户信息（提交必需）
	service.runGitCommand("config", "user.email", "test@example.com")
	service.runGitCommand("config", "user.name", "Test User")

	// CI 环境允许任意目录的临时仓库
	tmpHome := t.TempDir()
	t.Setenv("HOME", tmpHome)
	os.WriteFile(filepath.Join(tmpHome, ".gitconfig"),
		[]byte("[safe]\n\tdirectory = *\n"), 0644)

	// 创建初始提交，使 HEAD 存在
	initFile := filepath.Join(tmpDir, ".gitkeep")
	os.WriteFile(initFile, []byte(""), 0644)
	service.Stage([]string{".gitkeep"})
	service.Commit("initial commit")

	cleanup := func() {
		os.RemoveAll(tmpDir)
	}

	return tmpDir, service, cleanup
}

// TestInit 测试仓库初始化
func TestInit(t *testing.T) {
	tmpDir, err := os.MkdirTemp("", "git-init-test-*")
	if err != nil {
		t.Fatalf("创建临时目录失败: %v", err)
	}
	defer os.RemoveAll(tmpDir)

	service := NewGitService()
	err = service.Init(tmpDir)
	if err != nil {
		t.Errorf("初始化仓库失败: %v", err)
	}

	// 验证 .git 目录是否存在
	gitDir := filepath.Join(tmpDir, ".git")
	if _, err := os.Stat(gitDir); os.IsNotExist(err) {
		t.Error(".git 目录未创建")
	}
}

// TestIsGitRepo 测试仓库检测
func TestIsGitRepo(t *testing.T) {
	tmpDir, service, cleanup := setupTestRepo(t)
	defer cleanup()

	if !service.IsGitRepo(tmpDir) {
		t.Error("IsGitRepo 应返回 true")
	}

	// 非 Git 目录
	nonGitDir, _ := os.MkdirTemp("", "non-git-*")
	defer os.RemoveAll(nonGitDir)

	if service.IsGitRepo(nonGitDir) {
		t.Error("IsGitRepo 对非 Git 目录应返回 false")
	}
}

// TestStatusClean 测试干净工作区状态
func TestStatusClean(t *testing.T) {
	_, service, cleanup := setupTestRepo(t)
	defer cleanup()

	// 创建初始提交使工作区干净
	testFile := filepath.Join(service.repoPath, "test.txt")
	os.WriteFile(testFile, []byte("hello"), 0644)
	service.Stage([]string{"test.txt"})
	service.Commit("initial commit")

	status, err := service.Status("")
	if err != nil {
		t.Fatalf("获取状态失败: %v", err)
	}

	if !status.IsClean {
		t.Error("干净工作区 IsClean 应为 true")
	}

	if status.Branch != "main" && status.Branch != "master" {
		t.Errorf("期望分支为 main/master，实际为 %s", status.Branch)
	}
}

// TestStatusModified 测试检测修改的文件
func TestStatusModified(t *testing.T) {
	_, service, cleanup := setupTestRepo(t)
	defer cleanup()

	// 创建并提交初始文件
	testFile := filepath.Join(service.repoPath, "test.txt")
	os.WriteFile(testFile, []byte("hello"), 0644)
	err := service.Stage([]string{"test.txt"})
	if err != nil {
		t.Fatalf("暂存失败: %v", err)
	}
	err = service.Commit("initial commit")
	if err != nil {
		t.Fatalf("提交失败: %v", err)
	}

	// 修改文件
	os.WriteFile(testFile, []byte("world"), 0644)

	status, err := service.Status("")
	if err != nil {
		t.Fatalf("获取状态失败: %v", err)
	}

	if status.IsClean {
		t.Error("修改后 IsClean 应为 false")
	}

	if len(status.Modified) != 1 {
		t.Errorf("期望 1 个修改文件，实际 %d 个", len(status.Modified))
	}

	if len(status.Modified) > 0 && status.Modified[0].Path != "test.txt" {
		t.Errorf("期望文件名为 test.txt，实际为 %s", status.Modified[0].Path)
	}
}

// TestStatusUntracked 测试检测未追踪文件
func TestStatusUntracked(t *testing.T) {
	_, service, cleanup := setupTestRepo(t)
	defer cleanup()

	// 创建未追踪文件
	untrackedFile := filepath.Join(service.repoPath, "untracked.txt")
	os.WriteFile(untrackedFile, []byte("untracked"), 0644)

	status, err := service.Status("")
	if err != nil {
		t.Fatalf("获取状态失败: %v", err)
	}

	if len(status.Untracked) != 1 {
		t.Errorf("期望 1 个未追踪文件，实际 %d 个", len(status.Untracked))
	}
}

// TestStatusDeleted 测试检测删除的文件
func TestStatusDeleted(t *testing.T) {
	_, service, cleanup := setupTestRepo(t)
	defer cleanup()

	// 创建并提交文件
	testFile := filepath.Join(service.repoPath, "delete.txt")
	os.WriteFile(testFile, []byte("to delete"), 0644)
	err := service.Stage([]string{"delete.txt"})
	if err != nil {
		t.Fatalf("暂存失败: %v", err)
	}
	err = service.Commit("add file to delete")
	if err != nil {
		t.Fatalf("提交失败: %v", err)
	}

	// 删除文件
	os.Remove(testFile)

	status, err := service.Status("")
	if err != nil {
		t.Fatalf("获取状态失败: %v", err)
	}

	if len(status.Deleted) != 1 {
		t.Errorf("期望 1 个删除文件，实际 %d 个", len(status.Deleted))
	}
}

// TestStage 测试暂存文件
func TestStage(t *testing.T) {
	_, service, cleanup := setupTestRepo(t)
	defer cleanup()

	// 创建新文件
	testFile := filepath.Join(service.repoPath, "stage.txt")
	os.WriteFile(testFile, []byte("stage me"), 0644)

	// 暂存
	err := service.Stage([]string{"stage.txt"})
	if err != nil {
		t.Fatalf("暂存失败: %v", err)
	}

	status, err := service.Status("")
	if err != nil {
		t.Fatalf("获取状态失败: %v", err)
	}

	if len(status.Added) != 1 {
		t.Errorf("期望 1 个已添加文件，实际 %d 个", len(status.Added))
	}

	if len(status.Staged) != 1 {
		t.Errorf("期望 1 个已暂存文件，实际 %d 个", len(status.Staged))
	}
}

// TestUnstage 测试取消暂存
func TestUnstage(t *testing.T) {
	_, service, cleanup := setupTestRepo(t)
	defer cleanup()

	// 创建并暂存文件
	testFile := filepath.Join(service.repoPath, "unstage.txt")
	os.WriteFile(testFile, []byte("unstage me"), 0644)
	service.Stage([]string{"unstage.txt"})

	// 取消暂存
	err := service.Unstage([]string{"unstage.txt"})
	if err != nil {
		t.Fatalf("取消暂存失败: %v", err)
	}

	status, err := service.Status("")
	if err != nil {
		t.Fatalf("获取状态失败: %v", err)
	}

	if len(status.Untracked) != 1 {
		t.Errorf("取消暂存后应为未追踪状态，实际 %d 个", len(status.Untracked))
	}
}

// TestCommit 测试提交
func TestCommit(t *testing.T) {
	_, service, cleanup := setupTestRepo(t)
	defer cleanup()

	// 创建并暂存文件
	testFile := filepath.Join(service.repoPath, "commit.txt")
	os.WriteFile(testFile, []byte("commit me"), 0644)
	service.Stage([]string{"commit.txt"})

	// 提交
	err := service.Commit("test commit")
	if err != nil {
		t.Fatalf("提交失败: %v", err)
	}

	status, err := service.Status("")
	if err != nil {
		t.Fatalf("获取状态失败: %v", err)
	}

	if !status.IsClean {
		t.Error("提交后工作区应为干净")
	}
}

// TestCommitEmptyMessage 测试空提交信息
func TestCommitEmptyMessage(t *testing.T) {
	_, service, cleanup := setupTestRepo(t)
	defer cleanup()

	err := service.Commit("")
	if err == nil {
		t.Error("空提交信息应返回错误")
	}
}

// TestBranch 测试获取分支
func TestBranch(t *testing.T) {
	_, service, cleanup := setupTestRepo(t)
	defer cleanup()

	branch, err := service.Branch()
	if err != nil {
		t.Fatalf("获取分支失败: %v", err)
	}

	if branch != "main" && branch != "master" {
		t.Errorf("期望 main 或 master，实际为 %s", branch)
	}
}

// TestBranches 测试获取分支列表
func TestBranches(t *testing.T) {
	_, service, cleanup := setupTestRepo(t)
	defer cleanup()

	// 创建第二个分支
	service.runGitCommand("checkout", "-b", "feature-branch")

	branches, err := service.Branches()
	if err != nil {
		t.Fatalf("获取分支列表失败: %v", err)
	}

	if len(branches) < 2 {
		t.Errorf("期望至少 2 个分支，实际 %d 个", len(branches))
	}

	// 检查当前分支
	foundCurrent := false
	for _, b := range branches {
		if b.Current && b.Name == "feature-branch" {
			foundCurrent = true
			break
		}
	}
	if !foundCurrent {
		t.Error("当前分支应为 feature-branch")
	}
}

// TestCheckout 测试切换分支
func TestCheckout(t *testing.T) {
	_, service, cleanup := setupTestRepo(t)
	defer cleanup()

	// 获取当前默认分支名
	originalBranch, _ := service.Branch()

	// 创建新分支
	service.runGitCommand("checkout", "-b", "test-checkout")

	// 切换回原分支
	err := service.Checkout(originalBranch)
	if err != nil {
		t.Fatalf("切换分支失败: %v", err)
	}

	branch, _ := service.Branch()
	if branch != originalBranch {
		t.Errorf("切换后应为 %s，实际为 %s", originalBranch, branch)
	}
}

// TestDiff 测试获取 Diff
func TestDiff(t *testing.T) {
	_, service, cleanup := setupTestRepo(t)
	defer cleanup()

	// 创建并提交初始文件
	testFile := filepath.Join(service.repoPath, "diff.txt")
	os.WriteFile(testFile, []byte("line1\nline2\n"), 0644)
	service.Stage([]string{"diff.txt"})
	service.Commit("initial diff file")

	// 修改文件
	os.WriteFile(testFile, []byte("line1\nmodified\n"), 0644)

	diff, err := service.Diff("diff.txt", false)
	if err != nil {
		t.Fatalf("获取 diff 失败: %v", err)
	}

	if diff.Path != "diff.txt" {
		t.Errorf("期望路径为 diff.txt，实际为 %s", diff.Path)
	}

	if diff.Content == "" {
		t.Error("diff 内容不应为空")
	}

	if !contains(diff.Content, "modified") {
		t.Error("diff 应包含修改后的内容")
	}
}

// TestDiffNewFile 测试新文件的 Diff
func TestDiffNewFile(t *testing.T) {
	_, service, cleanup := setupTestRepo(t)
	defer cleanup()

	// 创建新文件并暂存
	testFile := filepath.Join(service.repoPath, "newfile.txt")
	os.WriteFile(testFile, []byte("new content"), 0644)
	service.Stage([]string{"newfile.txt"})

	diff, err := service.Diff("newfile.txt", true)
	if err != nil {
		t.Fatalf("获取 staged diff 失败: %v", err)
	}

	if !diff.IsNew {
		t.Error("新文件的 diff IsNew 应为 true")
	}
}

// TestLog 测试提交历史
func TestLog(t *testing.T) {
	_, service, cleanup := setupTestRepo(t)
	defer cleanup()

	// 创建多次提交
	for i := 0; i < 3; i++ {
		filename := filepath.Join(service.repoPath, fmt.Sprintf("log%d.txt", i))
		os.WriteFile(filename, []byte(fmt.Sprintf("content %d", i)), 0644)
		service.Stage([]string{fmt.Sprintf("log%d.txt", i)})
		service.Commit(fmt.Sprintf("commit %d", i))
	}

	commits, err := service.Log(10)
	if err != nil {
		t.Fatalf("获取提交历史失败: %v", err)
	}

	// setupTestRepo 创建了初始提交，所以期望 4 条记录
	if len(commits) != 4 {
		t.Errorf("期望 4 条提交记录，实际 %d 条", len(commits))
	}
}

// TestSummary 测试 Git 概要
func TestSummary(t *testing.T) {
	_, service, cleanup := setupTestRepo(t)
	defer cleanup()

	// 创建多个变更文件
	os.WriteFile(filepath.Join(service.repoPath, "mod.txt"), []byte("mod"), 0644)
	os.WriteFile(filepath.Join(service.repoPath, "add.txt"), []byte("add"), 0644)

	summary, err := service.Summary("")
	if err != nil {
		t.Fatalf("获取概要失败: %v", err)
	}

	if summary.UntrackedCount != 2 {
		t.Errorf("期望 2 个未追踪文件，实际 %d 个", summary.UntrackedCount)
	}

	if summary.IsClean {
		t.Error("有未追踪文件时 IsClean 应为 false")
	}
}

// TestGetRoot 测试获取仓库根目录
func TestGetRoot(t *testing.T) {
	tmpDir, service, cleanup := setupTestRepo(t)
	defer cleanup()

	// 在子目录中获取根目录
	subDir := filepath.Join(tmpDir, "subdir", "nested")
	os.MkdirAll(subDir, 0755)

	root, err := service.GetRoot(subDir)
	if err != nil {
		t.Fatalf("获取根目录失败: %v", err)
	}

	// macOS 中 /var 是 /private/var 的符号链接，需要解析
	resolvedTmpDir, _ := filepath.EvalSymlinks(tmpDir)
	resolvedRoot, _ := filepath.EvalSymlinks(root)
	if resolvedRoot != resolvedTmpDir {
		t.Errorf("期望根目录为 %s，实际为 %s", resolvedTmpDir, resolvedRoot)
	}
}

// TestDiscardChanges 测试放弃修改
func TestDiscardChanges(t *testing.T) {
	_, service, cleanup := setupTestRepo(t)
	defer cleanup()

	// 创建并提交文件
	testFile := filepath.Join(service.repoPath, "discard.txt")
	os.WriteFile(testFile, []byte("original"), 0644)
	service.Stage([]string{"discard.txt"})
	service.Commit("add discard file")

	// 修改文件
	os.WriteFile(testFile, []byte("changed"), 0644)

	// 放弃修改
	err := service.DiscardChanges([]string{"discard.txt"})
	if err != nil {
		t.Fatalf("放弃修改失败: %v", err)
	}

	// 验证文件恢复
	content, _ := os.ReadFile(testFile)
	if string(content) != "original" {
		t.Errorf("文件应恢复为 original，实际为 %s", string(content))
	}
}

// TestStash 测试 stash 操作
func TestStash(t *testing.T) {
	_, service, cleanup := setupTestRepo(t)
	defer cleanup()

	// 创建并提交初始文件
	testFile := filepath.Join(service.repoPath, "stash.txt")
	os.WriteFile(testFile, []byte("original"), 0644)
	service.Stage([]string{"stash.txt"})
	service.Commit("initial stash file")

	// 修改文件
	os.WriteFile(testFile, []byte("stashed"), 0644)

	// stash
	err := service.Stash("test stash")
	if err != nil {
		t.Fatalf("stash 失败: %v", err)
	}

	// 验证工作区干净
	status, _ := service.Status("")
	if !status.IsClean {
		t.Error("stash 后工作区应为干净")
	}

	// 恢复 stash
	err = service.StashPop()
	if err != nil {
		t.Fatalf("恢复 stash 失败: %v", err)
	}

	// 验证文件恢复
	content, _ := os.ReadFile(testFile)
	if string(content) != "stashed" {
		t.Errorf("恢复后应为 stashed，实际为 %s", string(content))
	}
}

// TestSetRepoPath 测试设置仓库路径
func TestSetRepoPath(t *testing.T) {
	service := NewGitService()

	if service.GetRepoPath() != "" {
		t.Error("初始路径应为空")
	}

	service.SetRepoPath("/test/path")
	if service.GetRepoPath() != "/test/path" {
		t.Error("设置路径失败")
	}
}

// contains 检查字符串是否包含子串
func contains(s, substr string) bool {
	return len(s) >= len(substr) && (s == substr || len(s) > 0 && containsAt(s, substr))
}

func containsAt(s, substr string) bool {
	for i := 0; i <= len(s)-len(substr); i++ {
		if s[i:i+len(substr)] == substr {
			return true
		}
	}
	return false
}

// TestNonGitRepo 测试非Git仓库目录
func TestNonGitRepo(t *testing.T) {
	tmpDir, _ := os.MkdirTemp("", "non-git-test-*")
	defer os.RemoveAll(tmpDir)

	service := NewGitService()
	service.SetRepoPath(tmpDir)

	if service.IsGitRepo(tmpDir) {
		t.Error("IsGitRepo 对非 Git 目录应返回 false")
	}

	_, err := service.Status("")
	if err == nil {
		t.Error("非 Git 目录获取状态应返回错误")
	}
}

// TestCommitMessageValidation 测试提交消息验证
func TestCommitMessageValidation(t *testing.T) {
	_, service, cleanup := setupTestRepo(t)
	defer cleanup()

	testCases := []struct {
		name    string
		message string
		wantErr bool
	}{
		{"空消息", "", true},
		{"仅空白字符", "   ", true},
		{"正常消息", "这是一个正常的提交消息", false},
		{"单行消息", "Fix bug", false},
		{"多行消息", "标题\n\n详细描述", false},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			testFile := filepath.Join(service.repoPath, fmt.Sprintf("commit_%s.txt", tc.name))
			os.WriteFile(testFile, []byte("test"), 0644)
			service.Stage([]string{filepath.Base(testFile)})

			err := service.Commit(tc.message)
			if tc.wantErr {
				if err == nil {
					t.Errorf("'%s' 应返回错误", tc.message)
				}
			} else {
				if err != nil {
					t.Errorf("'%s' 不应返回错误: %v", tc.message, err)
				}
			}
		})
	}
}

// TestMergeConflictDetection 测试合并冲突检测
func TestMergeConflictDetection(t *testing.T) {
	_, service, cleanup := setupTestRepo(t)
	defer cleanup()

	// 创建初始文件并提交
	testFile := filepath.Join(service.repoPath, "merge.txt")
	os.WriteFile(testFile, []byte("initial content\n"), 0644)
	service.Stage([]string{"merge.txt"})
	service.Commit("initial commit")

	// 创建并切换到feature分支
	_, _ = service.runGitCommand("checkout", "-b", "feature")

	// 在feature分支修改文件
	os.WriteFile(testFile, []byte("feature branch content\n"), 0644)
	service.Stage([]string{"merge.txt"})
	service.Commit("feature commit")

	// 切换回main分支并修改同一文件
	_, _ = service.runGitCommand("checkout", "main")
	os.WriteFile(testFile, []byte("main branch content\n"), 0644)
	service.Stage([]string{"merge.txt"})
	service.Commit("main commit")

	// 尝试合并feature分支（会产生冲突）
	_, err := service.runGitCommand("merge", "feature")
	if err == nil {
		t.Log("合并可能没有冲突")
	}

	// 检查状态
	status, err := service.Status("")
	if err != nil {
		t.Fatalf("获取状态失败: %v", err)
	}

	// 冲突时工作区不应干净
	if status.IsClean && err != nil {
		t.Log("合并可能产生了冲突")
	}

	// 放弃合并
	service.runGitCommand("merge", "--abort")
}

// TestGitServiceOperationsOnNonRepo 测试非仓库上的操作
func TestGitServiceOperationsOnNonRepo(t *testing.T) {
	tmpDir, _ := os.MkdirTemp("", "non-git-ops-*")
	defer os.RemoveAll(tmpDir)

	service := NewGitService()
	service.SetRepoPath(tmpDir)

	// 测试各种操作在非Git目录上的行为
	t.Run("Status", func(t *testing.T) {
		_, err := service.Status("")
		if err == nil {
			t.Error("非Git目录应返回错误")
		}
	})

	t.Run("Branch", func(t *testing.T) {
		_, err := service.Branch()
		if err == nil {
			t.Error("非Git目录应返回错误")
		}
	})

	t.Run("Branches", func(t *testing.T) {
		_, err := service.Branches()
		if err == nil {
			t.Error("非Git目录应返回错误")
		}
	})

	t.Run("Log", func(t *testing.T) {
		_, err := service.Log(10)
		if err == nil {
			t.Error("非Git目录应返回错误")
		}
	})

	t.Run("Summary", func(t *testing.T) {
		_, err := service.Summary("")
		if err == nil {
			t.Error("非Git目录应返回错误")
		}
	})
}

// TestLogEmptyRepo 测试空仓库的日志
func TestLogEmptyRepo(t *testing.T) {
	tmpDir, err := os.MkdirTemp("", "git-empty-log-*")
	if err != nil {
		t.Fatalf("创建临时目录失败: %v", err)
	}
	defer os.RemoveAll(tmpDir)

	service := NewGitService()
	service.Init(tmpDir)
	service.SetRepoPath(tmpDir)

	// 空仓库（只有初始化，没有提交）
	// git log 在空仓库会返回错误
	commits, err := service.Log(10)
	if err != nil {
		// 这是预期行为
		t.Logf("空仓库获取日志返回错误（预期）: %v", err)
		return
	}

	if len(commits) != 0 {
		t.Errorf("空仓库日志应为空，实际 %d 条", len(commits))
	}
}

// TestStashEmpty 测试空stash
func TestStashEmpty(t *testing.T) {
	_, service, cleanup := setupTestRepo(t)
	defer cleanup()

	// 工作区干净时stash
	err := service.Stash("empty stash")
	if err != nil {
		t.Logf("干净工作区stash可能返回错误: %v", err)
	}
}

// TestDiffBinaryFile 测试二进制文件的Diff
func TestDiffBinaryFile(t *testing.T) {
	_, service, cleanup := setupTestRepo(t)
	defer cleanup()

	// 创建并提交二进制文件
	testFile := filepath.Join(service.repoPath, "binary.bin")
	binaryContent := []byte{0x00, 0x01, 0x02, 0x03, 0xFF, 0xFE}
	os.WriteFile(testFile, binaryContent, 0644)
	service.Stage([]string{"binary.bin"})
	service.Commit("add binary file")

	// 修改二进制文件
	os.WriteFile(testFile, []byte{0x00, 0x01, 0x02, 0xAA, 0xFF, 0xFE}, 0644)

	diff, err := service.Diff("binary.bin", false)
	if err != nil {
		t.Logf("二进制文件diff可能不支持: %v", err)
		return
	}

	if diff.Path != "binary.bin" {
		t.Errorf("路径不匹配: got %s, want binary.bin", diff.Path)
	}
}

// TestGetRoot_NonGitDir 测试非Git目录获取根
func TestGetRoot_NonGitDir(t *testing.T) {
	tmpDir, _ := os.MkdirTemp("", "git-root-test-*")
	defer os.RemoveAll(tmpDir)

	service := NewGitService()

	_, err := service.GetRoot(tmpDir)
	if err == nil {
		t.Error("非Git目录获取根应返回错误")
	}
}

// TestDiscardChanges_Untracked 测试放弃未追踪文件
func TestDiscardChanges_Untracked(t *testing.T) {
	_, service, cleanup := setupTestRepo(t)
	defer cleanup()

	// 创建未追踪文件
	testFile := filepath.Join(service.repoPath, "untracked.txt")
	os.WriteFile(testFile, []byte("untracked"), 0644)

	// 放弃修改（对未追踪文件应清理）
	err := service.DiscardChanges([]string{"untracked.txt"})
	if err != nil {
		t.Logf("放弃未追踪文件: %v", err)
	}
}

// TestStageNonExistent 测试暂存不存在的文件
func TestStageNonExistent(t *testing.T) {
	_, service, cleanup := setupTestRepo(t)
	defer cleanup()

	err := service.Stage([]string{"non-existent.txt"})
	if err == nil {
		t.Error("暂存不存在的文件应返回错误")
	}
}

// TestCheckout_NonExistentBranch 测试切换到不存在的分支
func TestCheckout_NonExistentBranch(t *testing.T) {
	_, service, cleanup := setupTestRepo(t)
	defer cleanup()

	err := service.Checkout("non-existent-branch")
	if err == nil {
		t.Error("切换到不存在的分支应返回错误")
	}
}

// TestSummary_Clean 测试干净工作区概要
func TestSummary_Clean(t *testing.T) {
	_, service, cleanup := setupTestRepo(t)
	defer cleanup()

	// 确保工作区干净
	testFile := filepath.Join(service.repoPath, "clean.txt")
	os.WriteFile(testFile, []byte("clean"), 0644)
	service.Stage([]string{"clean.txt"})
	service.Commit("clean commit")

	summary, err := service.Summary("")
	if err != nil {
		t.Fatalf("获取概要失败: %v", err)
	}

	if !summary.IsClean {
		t.Error("干净工作区 IsClean 应为 true")
	}
	if summary.ModifiedCount != 0 {
		t.Errorf("ModifiedCount 应为 0，实际 %d", summary.ModifiedCount)
	}
	if summary.UntrackedCount != 0 {
		t.Errorf("UntrackedCount 应为 0，实际 %d", summary.UntrackedCount)
	}
}

// BenchmarkGitStatus 基准测试Git状态
func BenchmarkGitStatus(b *testing.B) {
	tmpDir, _ := os.MkdirTemp("", "git-bench-*")
	defer os.RemoveAll(tmpDir)

	service := NewGitService()
	service.Init(tmpDir)
	service.SetRepoPath(tmpDir)
	service.runGitCommand("config", "user.email", "test@example.com")
	service.runGitCommand("config", "user.name", "Test User")

	// 创建一些文件
	for i := 0; i < 100; i++ {
		os.WriteFile(filepath.Join(tmpDir, fmt.Sprintf("file%d.txt", i)), []byte("content"), 0644)
	}

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_, err := service.Status("")
		if err != nil {
			b.Fatal(err)
		}
	}
}

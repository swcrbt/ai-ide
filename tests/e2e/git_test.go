package e2e

import (
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/swcrbt/ai-ide/internal/git"
)

func createTempDir(t *testing.T) string {
	t.Helper()
	tmpDir, err := os.MkdirTemp("", "git-e2e-*")
	if err != nil {
		t.Fatalf("创建临时目录失败: %v", err)
	}
	t.Cleanup(func() {
		os.RemoveAll(tmpDir)
	})
	return tmpDir
}

func writeFile(t *testing.T, dir, name, content string) {
	t.Helper()
	path := filepath.Join(dir, name)
	if err := os.WriteFile(path, []byte(content), 0644); err != nil {
		t.Fatalf("写入文件失败 %s: %v", path, err)
	}
}

func setupGitUser(t *testing.T) {
	t.Helper()
	t.Setenv("GIT_AUTHOR_NAME", "Test User")
	t.Setenv("GIT_AUTHOR_EMAIL", "test@example.com")
	t.Setenv("GIT_COMMITTER_NAME", "Test User")
	t.Setenv("GIT_COMMITTER_EMAIL", "test@example.com")

	tmpHome := t.TempDir()
	t.Setenv("HOME", tmpHome)
	os.WriteFile(filepath.Join(tmpHome, ".gitconfig"),
		[]byte("[safe]\n\tdirectory = *\n"), 0644)
}

func makeInitialCommit(t *testing.T, svc *git.GitService, dir string) {
	t.Helper()
	setupGitUser(t)
	writeFile(t, dir, "init.txt", "initial")
	if err := svc.Stage([]string{"init.txt"}); err != nil {
		t.Fatalf("初始 Stage 失败: %v", err)
	}
	if err := svc.Commit("Initial commit"); err != nil {
		t.Fatalf("初始 Commit 失败: %v", err)
	}
}

func TestGitService_Init(t *testing.T) {
	tmpDir := createTempDir(t)

	svc := git.NewGitService()
	svc.SetRepoPath(tmpDir)

	err := svc.Init(tmpDir)
	if err != nil {
		t.Fatalf("Init 失败: %v", err)
	}

	gitDir := filepath.Join(tmpDir, ".git")
	if _, err := os.Stat(gitDir); os.IsNotExist(err) {
		t.Errorf(".git 目录不存在，初始化失败")
	}
}

func TestGitService_IsGitRepo(t *testing.T) {
	nonGitDir := createTempDir(t)
	svc := git.NewGitService()
	if svc.IsGitRepo(nonGitDir) {
		t.Errorf("非 Git 目录应返回 false")
	}

	gitDir := createTempDir(t)
	svc.SetRepoPath(gitDir)
	if err := svc.Init(gitDir); err != nil {
		t.Fatalf("Init 失败: %v", err)
	}
	if !svc.IsGitRepo(gitDir) {
		t.Errorf("Git 目录应返回 true")
	}
}

func TestGitService_Status(t *testing.T) {
	tmpDir := createTempDir(t)
	svc := git.NewGitService()
	svc.SetRepoPath(tmpDir)

	if err := svc.Init(tmpDir); err != nil {
		t.Fatalf("Init 失败: %v", err)
	}

	makeInitialCommit(t, svc, tmpDir)
	writeFile(t, tmpDir, "hello.txt", "hello world")

	status, err := svc.Status(tmpDir)
	if err != nil {
		t.Fatalf("Status 失败: %v", err)
	}

	if len(status.Untracked) != 1 {
		t.Errorf("期望 1 个未追踪文件，实际 %d", len(status.Untracked))
	}

	if status.Untracked[0].Path != "hello.txt" {
		t.Errorf("期望文件名 hello.txt，实际 %s", status.Untracked[0].Path)
	}
}

func TestGitService_Stage(t *testing.T) {
	tmpDir := createTempDir(t)
	svc := git.NewGitService()
	svc.SetRepoPath(tmpDir)

	if err := svc.Init(tmpDir); err != nil {
		t.Fatalf("Init 失败: %v", err)
	}

	makeInitialCommit(t, svc, tmpDir)
	writeFile(t, tmpDir, "stage.txt", "stage me")

	statusBefore, err := svc.Status("")
	if err != nil {
		t.Fatalf("获取暂存前状态失败: %v", err)
	}
	if len(statusBefore.Untracked) != 1 {
		t.Errorf("暂存前应存在 1 个未追踪文件，实际 %d", len(statusBefore.Untracked))
	}

	if err := svc.Stage([]string{"stage.txt"}); err != nil {
		t.Fatalf("Stage 失败: %v", err)
	}

	statusAfter, err := svc.Status("")
	if err != nil {
		t.Fatalf("获取暂存后状态失败: %v", err)
	}
	if len(statusAfter.Staged) != 1 {
		t.Errorf("暂存后应有 1 个已暂存文件，实际 %d", len(statusAfter.Staged))
	}
	if statusAfter.Staged[0].Path != "stage.txt" {
		t.Errorf("期望已暂存文件为 stage.txt，实际 %s", statusAfter.Staged[0].Path)
	}
	if len(statusAfter.Untracked) != 0 {
		t.Errorf("暂存后未追踪文件应为 0，实际 %d", len(statusAfter.Untracked))
	}
}

func TestGitService_Commit(t *testing.T) {
	tmpDir := createTempDir(t)
	setupGitUser(t)

	svc := git.NewGitService()
	svc.SetRepoPath(tmpDir)

	if err := svc.Init(tmpDir); err != nil {
		t.Fatalf("Init 失败: %v", err)
	}

	writeFile(t, tmpDir, "commit.txt", "commit me")

	if err := svc.Stage([]string{"commit.txt"}); err != nil {
		t.Fatalf("Stage 失败: %v", err)
	}

	if err := svc.Commit("Initial commit"); err != nil {
		t.Fatalf("Commit 失败: %v", err)
	}

	commits, err := svc.Log(1)
	if err != nil {
		t.Fatalf("Log 失败: %v", err)
	}
	if len(commits) != 1 {
		t.Errorf("期望 1 条提交记录，实际 %d", len(commits))
	}
	if commits[0].Message != "Initial commit" {
		t.Errorf("期望提交信息 'Initial commit'，实际 '%s'", commits[0].Message)
	}
}

func TestGitService_Branch(t *testing.T) {
	tmpDir := createTempDir(t)
	svc := git.NewGitService()
	svc.SetRepoPath(tmpDir)

	if err := svc.Init(tmpDir); err != nil {
		t.Fatalf("Init 失败: %v", err)
	}

	makeInitialCommit(t, svc, tmpDir)
	branch, err := svc.Branch()
	if err != nil {
		t.Fatalf("Branch 失败: %v", err)
	}

	if branch != "main" && branch != "master" {
		t.Errorf("期望分支名为 main 或 master，实际为 %s", branch)
	}
}

func TestGitService_Branches(t *testing.T) {
	tmpDir := createTempDir(t)
	svc := git.NewGitService()
	svc.SetRepoPath(tmpDir)

	if err := svc.Init(tmpDir); err != nil {
		t.Fatalf("Init 失败: %v", err)
	}

	makeInitialCommit(t, svc, tmpDir)
	branches, err := svc.Branches()
	if err != nil {
		t.Fatalf("Branches 失败: %v", err)
	}

	if len(branches) == 0 {
		t.Errorf("期望至少存在 1 个分支")
	}

	foundCurrent := false
	for _, b := range branches {
		if b.Current {
			foundCurrent = true
			break
		}
	}
	if !foundCurrent {
		t.Errorf("期望存在被标记为当前的分支")
	}
}

func TestGitService_Log(t *testing.T) {
	tmpDir := createTempDir(t)
	setupGitUser(t)

	svc := git.NewGitService()
	svc.SetRepoPath(tmpDir)

	if err := svc.Init(tmpDir); err != nil {
		t.Fatalf("Init 失败: %v", err)
	}

	writeFile(t, tmpDir, "log.txt", "log me")
	if err := svc.Stage([]string{"log.txt"}); err != nil {
		t.Fatalf("Stage 失败: %v", err)
	}
	if err := svc.Commit("Test commit for log"); err != nil {
		t.Fatalf("Commit 失败: %v", err)
	}

	commits, err := svc.Log(10)
	if err != nil {
		t.Fatalf("Log 失败: %v", err)
	}
	if len(commits) != 1 {
		t.Errorf("期望 1 条提交记录，实际 %d", len(commits))
	}
	if commits[0].Message != "Test commit for log" {
		t.Errorf("期望提交信息 'Test commit for log'，实际 '%s'", commits[0].Message)
	}
	if commits[0].Author != "Test User" {
		t.Errorf("期望作者 'Test User'，实际 '%s'", commits[0].Author)
	}
	if commits[0].Email != "test@example.com" {
		t.Errorf("期望邮箱 'test@example.com'，实际 '%s'", commits[0].Email)
	}
	if commits[0].Hash == "" {
		t.Errorf("提交哈希不应为空")
	}
	if commits[0].ShortHash == "" {
		t.Errorf("短哈希不应为空")
	}
}

func TestGitService_Diff(t *testing.T) {
	tmpDir := createTempDir(t)
	setupGitUser(t)

	svc := git.NewGitService()
	svc.SetRepoPath(tmpDir)

	if err := svc.Init(tmpDir); err != nil {
		t.Fatalf("Init 失败: %v", err)
	}

	writeFile(t, tmpDir, "diff.txt", "original content")
	if err := svc.Stage([]string{"diff.txt"}); err != nil {
		t.Fatalf("Stage 失败: %v", err)
	}
	if err := svc.Commit("Add diff.txt"); err != nil {
		t.Fatalf("Commit 失败: %v", err)
	}

	writeFile(t, tmpDir, "diff.txt", "modified content")

	diff, err := svc.Diff("diff.txt", false)
	if err != nil {
		t.Fatalf("Diff 失败: %v", err)
	}
	if diff.Path != "diff.txt" {
		t.Errorf("期望路径 diff.txt，实际 %s", diff.Path)
	}
	if diff.Content == "" {
		t.Errorf("Diff 内容不应为空")
	}
	if !strings.Contains(diff.Content, "modified content") {
		t.Errorf("Diff 内容应包含 'modified content'")
	}

	if err := svc.Stage([]string{"diff.txt"}); err != nil {
		t.Fatalf("Stage 失败: %v", err)
	}

	stagedDiff, err := svc.Diff("diff.txt", true)
	if err != nil {
		t.Fatalf("Staged Diff 失败: %v", err)
	}
	if stagedDiff.Content == "" {
		t.Errorf("Staged diff 内容不应为空")
	}
}

func TestGitService_Summary(t *testing.T) {
	tmpDir := createTempDir(t)
	svc := git.NewGitService()
	svc.SetRepoPath(tmpDir)

	if err := svc.Init(tmpDir); err != nil {
		t.Fatalf("Init 失败: %v", err)
	}

	makeInitialCommit(t, svc, tmpDir)
	summary, err := svc.Summary(tmpDir)
	if err != nil {
		t.Fatalf("Summary 失败: %v", err)
	}
	if !summary.IsClean {
		t.Errorf("初始状态应为干净")
	}
	if summary.TotalChanges != 0 {
		t.Errorf("初始总变更数应为 0，实际 %d", summary.TotalChanges)
	}

	writeFile(t, tmpDir, "summary1.txt", "content1")
	writeFile(t, tmpDir, "summary2.txt", "content2")

	summary, err = svc.Summary(tmpDir)
	if err != nil {
		t.Fatalf("创建文件后 Summary 失败: %v", err)
	}
	if summary.IsClean {
		t.Errorf("创建文件后状态不应为干净")
	}
	if summary.UntrackedCount != 2 {
		t.Errorf("期望 2 个未追踪文件，实际 %d", summary.UntrackedCount)
	}
	if summary.TotalChanges != 2 {
		t.Errorf("期望总变更数为 2，实际 %d", summary.TotalChanges)
	}
}



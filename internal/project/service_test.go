package project

import (
	"database/sql"
	"path/filepath"
	"testing"

	"github.com/swcrbt/ai-ide/internal/config"
	"github.com/swcrbt/ai-ide/internal/git"
)

// setupTestDB 创建隔离的测试数据库，不污染生产环境
func setupTestDB(t *testing.T) (*sql.DB, func()) {
	t.Helper()
	tmpDir := t.TempDir()
	dbPath := filepath.Join(tmpDir, "test.db")

	db, err := sql.Open("sqlite", dbPath)
	if err != nil {
		t.Fatalf("打开测试数据库失败: %v", err)
	}

	// 创建表结构（与生产一致）
	for _, table := range []string{
		`CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP)`,
		`CREATE TABLE IF NOT EXISTS projects (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, path TEXT NOT NULL UNIQUE, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP)`,
		`CREATE TABLE IF NOT EXISTS chat_sessions (id TEXT PRIMARY KEY, title TEXT NOT NULL DEFAULT '新对话', provider TEXT NOT NULL, model TEXT NOT NULL, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP)`,
		`CREATE TABLE IF NOT EXISTS conversations (id INTEGER PRIMARY KEY AUTOINCREMENT, session_id TEXT NOT NULL, role TEXT NOT NULL, content TEXT NOT NULL, provider TEXT NOT NULL, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (session_id) REFERENCES chat_sessions(id) ON DELETE CASCADE)`,
	} {
		if _, err := db.Exec(table); err != nil {
			t.Fatalf("创建表失败: %v", err)
		}
	}

	// 临时替换全局 DB
	oldDB := config.DB
	config.DB = db
	cleanup := func() {
		config.DB = oldDB
		db.Close()
	}

	return db, cleanup
}

func TestAddProject_WithGitRepo(t *testing.T) {
	_, cleanup := setupTestDB(t)
	defer cleanup()

	tmpDir := t.TempDir()
	gitService := git.NewGitService()
	if err := gitService.Init(tmpDir); err != nil {
		t.Fatalf("初始化 Git 失败: %v", err)
	}

	service := NewProjectService(gitService)

	result, err := service.AddProject(tmpDir)
	if err != nil {
		t.Fatalf("添加项目失败: %v", err)
	}
	if result.NeedsInit {
		t.Error("已有 Git 仓库的项目不应需要初始化")
	}
	if result.Project == nil {
		t.Fatal("项目不应为空")
	}
	if result.Project.Name != filepath.Base(tmpDir) {
		t.Errorf("项目名称不匹配: got %s, want %s", result.Project.Name, filepath.Base(tmpDir))
	}
}

func TestAddProject_WithoutGitRepo(t *testing.T) {
	_, cleanup := setupTestDB(t)
	defer cleanup()

	tmpDir := t.TempDir()
	gitService := git.NewGitService()
	service := NewProjectService(gitService)

	result, err := service.AddProject(tmpDir)
	if err != nil {
		t.Fatalf("添加项目失败: %v", err)
	}
	if !result.NeedsInit {
		t.Error("无 Git 仓库的项目应需要初始化")
	}
	if result.Project != nil {
		t.Error("未初始化的项目应返回 nil")
	}
}

func TestInitGitAndSave(t *testing.T) {
	_, cleanup := setupTestDB(t)
	defer cleanup()

	tmpDir := t.TempDir()
	gitService := git.NewGitService()
	service := NewProjectService(gitService)

	project, err := service.InitGitAndSave(tmpDir)
	if err != nil {
		t.Fatalf("初始化并保存项目失败: %v", err)
	}
	if project == nil {
		t.Fatal("项目不应为空")
	}

	// 验证 Git 已初始化
	if !gitService.IsGitRepo(tmpDir) {
		t.Error("Git 应已初始化")
	}
}

func TestAddProject_Duplicate(t *testing.T) {
	_, cleanup := setupTestDB(t)
	defer cleanup()

	tmpDir := t.TempDir()
	gitService := git.NewGitService()
	gitService.Init(tmpDir)

	service := NewProjectService(gitService)

	// 第一次添加
	result1, _ := service.AddProject(tmpDir)

	// 第二次添加（重复）
	result2, err := service.AddProject(tmpDir)
	if err != nil {
		t.Fatalf("添加重复项目不应报错: %v", err)
	}
	if result2.NeedsInit {
		t.Error("重复项目不应需要初始化")
	}
	if result2.Project.ID != result1.Project.ID {
		t.Error("重复添加应返回同一项目")
	}
}

func TestAddProject_InvalidPath(t *testing.T) {
	_, cleanup := setupTestDB(t)
	defer cleanup()

	gitService := git.NewGitService()
	service := NewProjectService(gitService)

	_, err := service.AddProject("/nonexistent/path")
	if err == nil {
		t.Error("无效路径应返回错误")
	}
}

func TestListProjects(t *testing.T) {
	_, cleanup := setupTestDB(t)
	defer cleanup()

	tmpDir1 := t.TempDir()
	tmpDir2 := t.TempDir()
	gitService := git.NewGitService()
	gitService.Init(tmpDir1)
	gitService.Init(tmpDir2)

	service := NewProjectService(gitService)
	service.AddProject(tmpDir1)
	service.AddProject(tmpDir2)

	projects, err := service.ListProjects()
	if err != nil {
		t.Fatalf("获取项目列表失败: %v", err)
	}
	if len(projects) != 2 {
		t.Errorf("项目数量不匹配: got %d, want 2", len(projects))
	}
}

func TestRemoveProject(t *testing.T) {
	_, cleanup := setupTestDB(t)
	defer cleanup()

	tmpDir := t.TempDir()
	gitService := git.NewGitService()
	gitService.Init(tmpDir)

	service := NewProjectService(gitService)
	result, _ := service.AddProject(tmpDir)

	err := service.RemoveProject(result.Project.ID)
	if err != nil {
		t.Fatalf("删除项目失败: %v", err)
	}

	// 验证已删除
	_, err = service.GetProject(result.Project.ID)
	if err == nil {
		t.Error("删除后应无法获取项目")
	}
}

func TestSetCurrentProject(t *testing.T) {
	_, cleanup := setupTestDB(t)
	defer cleanup()

	tmpDir := t.TempDir()
	gitService := git.NewGitService()
	gitService.Init(tmpDir)

	service := NewProjectService(gitService)
	service.AddProject(tmpDir)

	err := service.SetCurrentProject(tmpDir)
	if err != nil {
		t.Fatalf("设置当前项目失败: %v", err)
	}

	if gitService.GetRepoPath() == "" {
		t.Error("GitService 的 repoPath 应已设置")
	}
}

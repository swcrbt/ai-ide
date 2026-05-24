package project

import (
	"os"
	"path/filepath"
	"testing"

	"github.com/swcrbt/ai-ide/internal/config"
	"github.com/swcrbt/ai-ide/internal/git"
)

func TestMain(m *testing.M) {
	// 初始化测试数据库
	if err := config.InitDatabase(); err != nil {
		panic(err)
	}
	defer config.CloseDatabase()

	// 清理测试数据
	config.DB.Exec("DELETE FROM projects")

	os.Exit(m.Run())
}

func TestAddProject_WithGitRepo(t *testing.T) {
	// 创建临时目录并初始化 Git
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
	gitService := git.NewGitService()
	service := NewProjectService(gitService)

	_, err := service.AddProject("/nonexistent/path")
	if err == nil {
		t.Error("无效路径应返回错误")
	}
}

func TestListProjects(t *testing.T) {
	// 清理
	config.DB.Exec("DELETE FROM projects")

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

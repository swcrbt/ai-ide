package project

import (
	"fmt"
	"os"
	"path/filepath"
	"time"

	"github.com/swcrbt/ai-ide/internal/config"
	"github.com/swcrbt/ai-ide/internal/git"
)

// Project 项目信息
type Project struct {
	ID        int64     `json:"id"`
	Name      string    `json:"name"`
	Path      string    `json:"path"`
	CreatedAt time.Time `json:"createdAt"`
	UpdatedAt time.Time `json:"updatedAt"`
}

// ProjectService 项目管理服务
type ProjectService struct {
	gitService *git.GitService
}

// NewProjectService 创建 ProjectService 实例
func NewProjectService(gitService *git.GitService) *ProjectService {
	return &ProjectService{
		gitService: gitService,
	}
}

// ListProjects 获取所有项目列表
func (s *ProjectService) ListProjects() ([]Project, error) {
	rows, err := config.DB.Query(
		"SELECT id, name, path, created_at, updated_at FROM projects ORDER BY updated_at DESC",
	)
	if err != nil {
		return nil, fmt.Errorf("查询项目列表失败: %w", err)
	}
	defer rows.Close()

	var projects []Project
	for rows.Next() {
		var p Project
		if err := rows.Scan(&p.ID, &p.Name, &p.Path, &p.CreatedAt, &p.UpdatedAt); err != nil {
			continue
		}
		projects = append(projects, p)
	}

	return projects, nil
}

// AddProject 添加新项目
// 返回: (project, needsInit, error)
// needsInit 为 true 表示需要初始化 Git
func (s *ProjectService) AddProject(path string) (*Project, bool, error) {
	// 1. 验证路径存在且为目录
	info, err := os.Stat(path)
	if err != nil {
		return nil, false, fmt.Errorf("路径不存在: %s", path)
	}
	if !info.IsDir() {
		return nil, false, fmt.Errorf("路径不是目录: %s", path)
	}

	// 2. 获取绝对路径
	absPath, err := filepath.Abs(path)
	if err != nil {
		return nil, false, fmt.Errorf("获取绝对路径失败: %w", err)
	}

	// 3. 检查是否已存在
	var existingID int64
	err = config.DB.QueryRow("SELECT id FROM projects WHERE path = ?", absPath).Scan(&existingID)
	if err == nil {
		// 已存在，返回已有项目
		project, err := s.GetProject(existingID)
		return project, false, err
	}

	// 4. 检查是否为 Git 仓库
	isGitRepo := s.gitService.IsGitRepo(absPath)
	if !isGitRepo {
		return nil, true, nil
	}

	// 5. 是 Git 仓库，保存到数据库
	name := filepath.Base(absPath)
	result, err := config.DB.Exec(
		"INSERT INTO projects (name, path, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)",
		name, absPath,
	)
	if err != nil {
		return nil, false, fmt.Errorf("保存项目失败: %w", err)
	}

	id, _ := result.LastInsertId()
	project, err := s.GetProject(id)
	return project, false, err
}

// InitGitAndSave 初始化 Git 并保存项目
func (s *ProjectService) InitGitAndSave(path string) (*Project, error) {
	// 1. 初始化 Git
	if err := s.gitService.Init(path); err != nil {
		return nil, fmt.Errorf("初始化 Git 仓库失败: %w", err)
	}

	// 2. 获取绝对路径
	absPath, err := filepath.Abs(path)
	if err != nil {
		return nil, fmt.Errorf("获取绝对路径失败: %w", err)
	}

	// 3. 保存到数据库
	name := filepath.Base(absPath)
	result, err := config.DB.Exec(
		"INSERT INTO projects (name, path, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)",
		name, absPath,
	)
	if err != nil {
		return nil, fmt.Errorf("保存项目失败: %w", err)
	}

	id, _ := result.LastInsertId()
	return s.GetProject(id)
}

// GetProject 获取单个项目
func (s *ProjectService) GetProject(id int64) (*Project, error) {
	var p Project
	err := config.DB.QueryRow(
		"SELECT id, name, path, created_at, updated_at FROM projects WHERE id = ?",
		id,
	).Scan(&p.ID, &p.Name, &p.Path, &p.CreatedAt, &p.UpdatedAt)
	if err != nil {
		return nil, fmt.Errorf("获取项目失败: %w", err)
	}
	return &p, nil
}

// RemoveProject 删除项目
func (s *ProjectService) RemoveProject(id int64) error {
	_, err := config.DB.Exec("DELETE FROM projects WHERE id = ?", id)
	if err != nil {
		return fmt.Errorf("删除项目失败: %w", err)
	}
	return nil
}

// SetCurrentProject 设置当前项目（更新 GitService 的 repoPath）
func (s *ProjectService) SetCurrentProject(path string) error {
	// 验证路径存在
	if _, err := os.Stat(path); err != nil {
		return fmt.Errorf("路径不存在: %w", err)
	}

	// 获取 Git 根目录（如果是 Git 仓库）
	if s.gitService.IsGitRepo(path) {
		root, err := s.gitService.GetRoot(path)
		if err == nil {
			s.gitService.SetRepoPath(root)
			return nil
		}
	}

	// 不是 Git 仓库，直接设置路径
	s.gitService.SetRepoPath(path)
	return nil
}

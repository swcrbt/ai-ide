package main

import (
	"context"
	"fmt"

	"github.com/swcrbt/ai-ide/internal/ai"
	"github.com/swcrbt/ai-ide/internal/config"
	"github.com/swcrbt/ai-ide/internal/fs"
	"github.com/swcrbt/ai-ide/internal/git"
	"github.com/swcrbt/ai-ide/internal/project"
	"github.com/swcrbt/ai-ide/internal/terminal"
	wailsRuntime "github.com/wailsapp/wails/v2/pkg/runtime"
)

// App struct
type App struct {
	ctx             context.Context
	FileService     *fs.FileService
	GitService      *git.GitService
	TerminalService *terminal.TerminalService
	ChatManager     *ai.ChatHistoryManager
	ProjectService  *project.ProjectService
}

// NewApp creates a new App application struct
func NewApp() *App {
	gitService := git.NewGitService()
	return &App{
		FileService:     fs.NewFileService(),
		GitService:      gitService,
		TerminalService: terminal.NewTerminalService(),
		ChatManager:     ai.NewChatHistoryManager(ai.NewProviderManager()),
		ProjectService:  project.NewProjectService(gitService),
	}
}

// startup is called when the app starts. The context is saved
// so we can call the runtime methods
func (a *App) startup(ctx context.Context) {
	a.ctx = ctx

	// 初始化 SQLite 数据库
	if err := config.InitDatabase(); err != nil {
		fmt.Println("数据库初始化失败:", err)
	}

	// 初始化文件系统监听器
	watcher, err := fs.NewFileWatcher()
	if err != nil {
		fmt.Println("文件监听器初始化失败:", err)
	} else {
		a.FileService.SetWatcher(watcher)
	}

	// 初始化终端服务
	if a.TerminalService != nil {
		a.TerminalService.Startup(ctx)
	}

	// 加载 AI 聊天历史
	if a.ChatManager != nil {
		_ = a.ChatManager.LoadAllSessionsFromDB()
	}
}

// Greet returns a greeting for the given name
func (a *App) Greet(name string) string {
	return fmt.Sprintf("Hello %s, It's show time!", name)
}

// GetSettings 获取应用配置（前端通过 Wails 调用）
func (a *App) GetSettings() (config.Settings, error) {
	settings, err := config.GetSettings()
	if err != nil {
		return config.Settings{}, fmt.Errorf("获取配置失败: %w", err)
	}

	return settings, nil
}

// SaveSettings 保存应用配置（前端通过 Wails 调用）
func (a *App) SaveSettings(settings config.Settings) error {
	if err := config.SaveSettings(settings); err != nil {
		return fmt.Errorf("保存配置失败: %w", err)
	}

	return nil
}

// ResetSettings 重置配置为默认值
func (a *App) ResetSettings() error {
	if err := config.ResetSettings(); err != nil {
		return fmt.Errorf("重置配置失败: %w", err)
	}
	return nil
}

// CreateBranch 创建并切换到新分支
func (a *App) CreateBranch(branch string) error {
	if err := a.GitService.CreateBranch(branch); err != nil {
		return fmt.Errorf("创建分支失败: %w", err)
	}
	return nil
}

// BranchExists 检查分支是否存在
func (a *App) BranchExists(branch string) (bool, error) {
	exists, err := a.GitService.BranchExists(branch)
	if err != nil {
		return false, fmt.Errorf("检查分支失败: %w", err)
	}
	return exists, nil
}

// GenerateTitle 根据任务内容生成合适的标题
func (a *App) GenerateTitle(content string) string {
	if a.ChatManager == nil {
		return ai.GenerateTitleLocal(content)
	}
	return a.ChatManager.GenerateTitle(a.ctx, content)
}

// CreateChatSession 创建新的 AI 聊天会话
func (a *App) CreateChatSession() (string, error) {
	if a.ChatManager == nil {
		return "", fmt.Errorf("聊天管理器未初始化")
	}
	session, err := a.ChatManager.CreateSession()
	if err != nil {
		return "", fmt.Errorf("创建会话失败: %w", err)
	}
	return session.GetID(), nil
}

// SendChatMessage 发送消息到 AI，通过 Wails Events 流式返回结果
// 事件名: ai:chunk:<sessionID>, ai:done:<sessionID>, ai:error:<sessionID>
func (a *App) SendChatMessage(sessionID string, content string) error {
	if a.ChatManager == nil {
		return fmt.Errorf("聊天管理器未初始化")
	}
	session, ok := a.ChatManager.GetSession(sessionID)
	if !ok {
		return fmt.Errorf("会话不存在: %s", sessionID)
	}

	stream, err := session.SendMessage(a.ctx, content)
	if err != nil {
		return fmt.Errorf("发送消息失败: %w", err)
	}

	go func() {
		for chunk := range stream {
			if chunk.Error != nil {
				wailsRuntime.EventsEmit(a.ctx, "ai:error:"+sessionID, chunk.Error.Error())
				return
			}
			if chunk.Done {
				wailsRuntime.EventsEmit(a.ctx, "ai:done:"+sessionID, "")
				return
			}
			wailsRuntime.EventsEmit(a.ctx, "ai:chunk:"+sessionID, chunk.Content)
		}
	}()

	return nil
}

// ClearChatMessages 清空会话消息历史
func (a *App) ClearChatMessages(sessionID string) error {
	if a.ChatManager == nil {
		return fmt.Errorf("聊天管理器未初始化")
	}
	session, ok := a.ChatManager.GetSession(sessionID)
	if !ok {
		return fmt.Errorf("会话不存在: %s", sessionID)
	}
	session.ClearHistory()
	return nil
}

// ListProjects 获取项目列表
func (a *App) ListProjects() ([]project.Project, error) {
	return a.ProjectService.ListProjects()
}

// AddProject 添加新项目
func (a *App) AddProject(path string) (*project.AddProjectResult, error) {
	return a.ProjectService.AddProject(path)
}

// InitGitAndSave 初始化 Git 并保存项目
func (a *App) InitGitAndSave(path string) (*project.Project, error) {
	return a.ProjectService.InitGitAndSave(path)
}

// RemoveProject 删除项目
func (a *App) RemoveProject(id int64) error {
	return a.ProjectService.RemoveProject(id)
}

// SetCurrentProject 设置当前项目
func (a *App) SetCurrentProject(path string) error {
	return a.ProjectService.SetCurrentProject(path)
}

// OpenDirectoryDialog 打开目录选择对话框
func (a *App) OpenDirectoryDialog(options wailsRuntime.OpenDialogOptions) (string, error) {
	return wailsRuntime.OpenDirectoryDialog(a.ctx, options)
}

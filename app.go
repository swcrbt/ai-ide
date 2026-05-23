package main

import (
	"context"
	"fmt"

	"github.com/swcrbt/ai-ide/internal/config"
	"github.com/swcrbt/ai-ide/internal/fs"
	"github.com/swcrbt/ai-ide/internal/git"
	"github.com/swcrbt/ai-ide/internal/terminal"
)

// App struct
type App struct {
	ctx             context.Context
	FileService     *fs.FileService
	GitService      *git.GitService
	TerminalService *terminal.TerminalService
}

// NewApp creates a new App application struct
func NewApp() *App {
	return &App{
		FileService:     fs.NewFileService(),
		GitService:      git.NewGitService(),
		TerminalService: terminal.NewTerminalService(),
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

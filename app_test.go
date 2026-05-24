package main

import (
	"testing"

	"github.com/swcrbt/ai-ide/internal/config"
)

// TestNewApp 测试创建App实例
func TestNewApp(t *testing.T) {
	app := NewApp()
	if app == nil {
		t.Fatal("NewApp 返回 nil")
	}

	if app.FileService == nil {
		t.Error("FileService 不应为 nil")
	}

	if app.GitService == nil {
		t.Error("GitService 不应为 nil")
	}

	if app.TerminalService == nil {
		t.Error("TerminalService 不应为 nil")
	}
}

// TestApp_Greet 测试问候方法
func TestApp_Greet(t *testing.T) {
	app := NewApp()

	result := app.Greet("World")
	expected := "Hello World, It's show time!"
	if result != expected {
		t.Errorf("Greet() = %q, want %q", result, expected)
	}

	result = app.Greet("")
	expected = "Hello , It's show time!"
	if result != expected {
		t.Errorf("Greet(空字符串) = %q, want %q", result, expected)
	}
}

// TestApp_SaveSettings 测试保存配置
func TestApp_SaveSettings(t *testing.T) {
	app := NewApp()

	// 初始化数据库
	if err := config.InitDatabase(); err != nil {
		t.Skipf("数据库初始化失败: %v", err)
	}

	settings := config.Settings{
		Theme:    "dark",
		Language: "zh",
		AutoSave: false,
	}

	err := app.SaveSettings(settings)
	if err != nil {
		t.Errorf("SaveSettings() 返回错误: %v", err)
	}
}

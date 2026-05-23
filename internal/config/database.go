package config

import (
	"database/sql"
	"fmt"
	"os"
	"path/filepath"

	_ "github.com/mattn/go-sqlite3"
)

// DB 全局数据库连接实例
var DB *sql.DB

// InitDatabase 初始化 SQLite 数据库连接
func InitDatabase() error {
	// 获取用户配置目录
	configDir, err := os.UserConfigDir()
	if err != nil {
		return fmt.Errorf("获取配置目录失败: %w", err)
	}

	// 创建应用数据目录
	appDir := filepath.Join(configDir, "ai-ide")
	if err := os.MkdirAll(appDir, 0755); err != nil {
		return fmt.Errorf("创建应用目录失败: %w", err)
	}

	// 数据库文件路径
	dbPath := filepath.Join(appDir, "ai-ide.db")

	// 打开数据库连接
	db, err := sql.Open("sqlite3", dbPath)
	if err != nil {
		return fmt.Errorf("打开数据库失败: %w", err)
	}

	// 验证连接
	if err := db.Ping(); err != nil {
		return fmt.Errorf("连接数据库失败: %w", err)
	}

	DB = db

	// 执行数据库迁移
	if err := migrate(); err != nil {
		return fmt.Errorf("数据库迁移失败: %w", err)
	}

	return nil
}

// migrate 执行数据库表结构迁移
func migrate() error {
	// 创建设置表
	settingsTable := `
	CREATE TABLE IF NOT EXISTS settings (
		key TEXT PRIMARY KEY,
		value TEXT NOT NULL,
		updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
	);`

	if _, err := DB.Exec(settingsTable); err != nil {
		return fmt.Errorf("创建 settings 表失败: %w", err)
	}

	// 创建项目表
	projectsTable := `
	CREATE TABLE IF NOT EXISTS projects (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		name TEXT NOT NULL,
		path TEXT NOT NULL UNIQUE,
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
		updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
	);`

	if _, err := DB.Exec(projectsTable); err != nil {
		return fmt.Errorf("创建 projects 表失败: %w", err)
	}

	// 创建会话表
	chatSessionsTable := `
	CREATE TABLE IF NOT EXISTS chat_sessions (
		id TEXT PRIMARY KEY,
		title TEXT NOT NULL DEFAULT '新对话',
		provider TEXT NOT NULL,
		model TEXT NOT NULL,
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
		updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
	);`

	if _, err := DB.Exec(chatSessionsTable); err != nil {
		return fmt.Errorf("创建 chat_sessions 表失败: %w", err)
	}

	// 创建对话历史表
	conversationsTable := `
	CREATE TABLE IF NOT EXISTS conversations (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		session_id TEXT NOT NULL,
		role TEXT NOT NULL,
		content TEXT NOT NULL,
		provider TEXT NOT NULL,
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
		FOREIGN KEY (session_id) REFERENCES chat_sessions(id) ON DELETE CASCADE
	);`

	if _, err := DB.Exec(conversationsTable); err != nil {
		return fmt.Errorf("创建 conversations 表失败: %w", err)
	}

	// 创建会话索引
	if _, err := DB.Exec(`CREATE INDEX IF NOT EXISTS idx_conversations_session_id ON conversations(session_id)`); err != nil {
		return fmt.Errorf("创建 conversations 索引失败: %w", err)
	}

	return nil
}

// CloseDatabase 关闭数据库连接
func CloseDatabase() error {
	if DB != nil {
		return DB.Close()
	}
	return nil
}

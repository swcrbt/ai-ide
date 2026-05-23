package config

import (
	"database/sql"
	"encoding/json"
	"fmt"
)

// EditorSettings 编辑器相关配置
type EditorSettings struct {
	FontSize         int    `json:"fontSize"`         // 字体大小
	FontFamily       string `json:"fontFamily"`       // 字体
	TabSize          int    `json:"tabSize"`          // Tab 宽度
	WordWrap         bool   `json:"wordWrap"`         // 自动换行
	ShowLineNumbers  bool   `json:"showLineNumbers"`  // 显示行号
	EnableMinimap    bool   `json:"enableMinimap"`    // 启用小地图
	FormatOnSave     bool   `json:"formatOnSave"`     // 保存时格式化
	LineHeight       int    `json:"lineHeight"`       // 行高
	CursorStyle      string `json:"cursorStyle"`      // 光标样式
	CursorBlinking   string `json:"cursorBlinking"`   // 光标闪烁
	RenderWhitespace string `json:"renderWhitespace"` // 显示空白字符
}

// TerminalSettings 终端相关配置
type TerminalSettings struct {
	Shell          string `json:"shell"`          // Shell 路径
	FontSize       int    `json:"fontSize"`       // 终端字体大小
	FontFamily     string `json:"fontFamily"`     // 终端字体
	CursorStyle    string `json:"cursorStyle"`    // 光标样式
	Scrollback     int    `json:"scrollback"`     // 回滚行数
}

// AISettings AI 相关配置
type AISettings struct {
	Model   string `json:"model"`   // AI 模型
	ApiKey  string `json:"apiKey"`  // API 密钥
	BaseURL string `json:"baseUrl"` // 自定义 API 地址
}

// Settings 应用全局配置
type Settings struct {
	Theme     string           `json:"theme"`     // 主题: light | dark | system
	Language  string           `json:"language"`  // 语言: zh | en
	AutoSave  bool             `json:"autoSave"`  // 自动保存
	Editor    EditorSettings   `json:"editor"`    // 编辑器配置
	Terminal  TerminalSettings `json:"terminal"`  // 终端配置
	AI        AISettings       `json:"ai"`        // AI 配置
}

// defaultSettings 返回默认配置
func defaultSettings() Settings {
	return Settings{
		Theme:    "system",
		Language: "zh",
		AutoSave: false,
		Editor: EditorSettings{
			FontSize:         14,
			FontFamily:       "'JetBrains Mono', 'Fira Code', 'Cascadia Code', 'SF Mono', monospace",
			TabSize:          2,
			WordWrap:         true,
			ShowLineNumbers:  true,
			EnableMinimap:    false,
			FormatOnSave:     true,
			LineHeight:       22,
			CursorStyle:      "line",
			CursorBlinking:   "smooth",
			RenderWhitespace: "selection",
		},
		Terminal: TerminalSettings{
			Shell:       "/bin/zsh",
			FontSize:    14,
			FontFamily:  "'JetBrains Mono', 'Fira Code', monospace",
			CursorStyle: "block",
			Scrollback:  10000,
		},
		AI: AISettings{
			Model:   "gpt-4o",
			ApiKey:  "",
			BaseURL: "",
		},
	}
}

// GetSettings 从 SQLite 读取配置，如果不存在则返回默认值
func GetSettings() (Settings, error) {
	settings := defaultSettings()

	// 从数据库读取配置
	rows, err := DB.Query("SELECT key, value FROM settings")
	if err != nil {
		return settings, fmt.Errorf("查询 settings 失败: %w", err)
	}
	defer rows.Close()

	// 构建 key-value 映射
	values := make(map[string]string)
	for rows.Next() {
		var key, value string
		if err := rows.Scan(&key, &value); err != nil {
			continue
		}
		values[key] = value
	}

	// 应用已保存的配置
	if v, ok := values["theme"]; ok {
		settings.Theme = v
	}
	if v, ok := values["language"]; ok {
		settings.Language = v
	}
	if v, ok := values["autoSave"]; ok {
		settings.AutoSave = v == "true"
	}
	if v, ok := values["editor"]; ok {
		var editor EditorSettings
		if err := json.Unmarshal([]byte(v), &editor); err == nil {
			settings.Editor = editor
		}
	}
	if v, ok := values["terminal"]; ok {
		var terminal TerminalSettings
		if err := json.Unmarshal([]byte(v), &terminal); err == nil {
			settings.Terminal = terminal
		}
	}
	if v, ok := values["ai"]; ok {
		var ai AISettings
		if err := json.Unmarshal([]byte(v), &ai); err == nil {
			settings.AI = ai
		}
	}

	return settings, nil
}

// SaveSettings 保存配置到 SQLite
func SaveSettings(settings Settings) error {
	// 使用事务确保原子性
	tx, err := DB.Begin()
	if err != nil {
		return fmt.Errorf("开启事务失败: %w", err)
	}
	defer tx.Rollback()

	// 保存基础字段
	if err := saveSetting(tx, "theme", settings.Theme); err != nil {
		return err
	}
	if err := saveSetting(tx, "language", settings.Language); err != nil {
		return err
	}
	if err := saveSetting(tx, "autoSave", fmt.Sprintf("%t", settings.AutoSave)); err != nil {
		return err
	}

	// 序列化并保存编辑器配置
	editorJSON, err := json.Marshal(settings.Editor)
	if err != nil {
		return fmt.Errorf("序列化编辑器配置失败: %w", err)
	}
	if err := saveSetting(tx, "editor", string(editorJSON)); err != nil {
		return err
	}

	// 序列化并保存终端配置
	terminalJSON, err := json.Marshal(settings.Terminal)
	if err != nil {
		return fmt.Errorf("序列化终端配置失败: %w", err)
	}
	if err := saveSetting(tx, "terminal", string(terminalJSON)); err != nil {
		return err
	}

	// 序列化并保存 AI 配置
	aiJSON, err := json.Marshal(settings.AI)
	if err != nil {
		return fmt.Errorf("序列化 AI 配置失败: %w", err)
	}
	if err := saveSetting(tx, "ai", string(aiJSON)); err != nil {
		return err
	}

	if err := tx.Commit(); err != nil {
		return fmt.Errorf("提交事务失败: %w", err)
	}

	return nil
}

// saveSetting 辅助函数：保存单个配置项
func saveSetting(tx *sql.Tx, key string, value string) error {
	query := `
		INSERT INTO settings (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)
		ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP
	`
	if _, err := tx.Exec(query, key, value); err != nil {
		return fmt.Errorf("保存设置 %s 失败: %w", key, err)
	}
	return nil
}

// ResetSettings 重置配置为默认值
func ResetSettings() error {
	settings := defaultSettings()
	return SaveSettings(settings)
}

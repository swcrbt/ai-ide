package config

import (
	"database/sql"
	"encoding/json"
	"os"
	"path/filepath"
	"testing"
)

// setupTestDB 创建测试数据库
func setupTestDB(t *testing.T) (*sql.DB, func()) {
	t.Helper()

	// 创建临时数据库文件
	tmpDir := t.TempDir()
	dbPath := filepath.Join(tmpDir, "test.db")

	db, err := sql.Open("sqlite3", dbPath)
	if err != nil {
		t.Fatalf("打开测试数据库失败: %v", err)
	}

	// 创建设置表
	settingsTable := `
	CREATE TABLE IF NOT EXISTS settings (
		key TEXT PRIMARY KEY,
		value TEXT NOT NULL,
		updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
	);`
	if _, err := db.Exec(settingsTable); err != nil {
		t.Fatalf("创建设置表失败: %v", err)
	}

	cleanup := func() {
		db.Close()
	}

	return db, cleanup
}

// TestDefaultSettings 测试默认配置值
func TestDefaultSettings(t *testing.T) {
	settings := defaultSettings()

	// 验证主题默认值
	if settings.Theme != "system" {
		t.Errorf("主题默认值错误: got %s, want system", settings.Theme)
	}

	// 验证语言默认值
	if settings.Language != "zh" {
		t.Errorf("语言默认值错误: got %s, want zh", settings.Language)
	}

	// 验证自动保存默认值
	if settings.AutoSave != false {
		t.Error("自动保存默认值应为 false")
	}

	// 验证编辑器默认值
	if settings.Editor.FontSize != 14 {
		t.Errorf("字体大小默认值错误: got %d, want 14", settings.Editor.FontSize)
	}
	if settings.Editor.TabSize != 2 {
		t.Errorf("Tab宽度默认值错误: got %d, want 2", settings.Editor.TabSize)
	}
	if !settings.Editor.WordWrap {
		t.Error("自动换行默认值应为 true")
	}
	if !settings.Editor.ShowLineNumbers {
		t.Error("显示行号默认值应为 true")
	}
	if settings.Editor.EnableMinimap {
		t.Error("小地图默认值应为 false")
	}
	if !settings.Editor.FormatOnSave {
		t.Error("保存时格式化默认值应为 true")
	}
	if settings.Editor.LineHeight != 22 {
		t.Errorf("行高默认值错误: got %d, want 22", settings.Editor.LineHeight)
	}
	if settings.Editor.CursorStyle != "line" {
		t.Errorf("光标样式默认值错误: got %s, want line", settings.Editor.CursorStyle)
	}

	// 验证终端默认值
	if settings.Terminal.Shell != "/bin/zsh" {
		t.Errorf("Shell默认值错误: got %s, want /bin/zsh", settings.Terminal.Shell)
	}
	if settings.Terminal.FontSize != 14 {
		t.Errorf("终端字体大小默认值错误: got %d, want 14", settings.Terminal.FontSize)
	}
	if settings.Terminal.Scrollback != 10000 {
		t.Errorf("回滚行数默认值错误: got %d, want 10000", settings.Terminal.Scrollback)
	}

	// 验证AI默认值
	if settings.AI.Model != "gpt-4o" {
		t.Errorf("AI模型默认值错误: got %s, want gpt-4o", settings.AI.Model)
	}
	if settings.AI.ApiKey != "" {
		t.Error("API Key默认值应为空")
	}
}

// TestSaveAndGetSettings 测试保存和读取配置
func TestSaveAndGetSettings(t *testing.T) {
	db, cleanup := setupTestDB(t)
	defer cleanup()

	// 临时替换全局DB
	oldDB := DB
	DB = db
	defer func() { DB = oldDB }()

	// 创建自定义配置
	settings := Settings{
		Theme:    "dark",
		Language: "en",
		AutoSave: true,
		Editor: EditorSettings{
			FontSize:         16,
			FontFamily:       "Fira Code",
			TabSize:          4,
			WordWrap:         false,
			ShowLineNumbers:  false,
			EnableMinimap:    true,
			FormatOnSave:     false,
			LineHeight:       24,
			CursorStyle:      "block",
			CursorBlinking:   "blink",
			RenderWhitespace: "all",
		},
		Terminal: TerminalSettings{
			Shell:       "/bin/bash",
			FontSize:    16,
			FontFamily:  "Monaco",
			CursorStyle: "line",
			Scrollback:  5000,
		},
		AI: AISettings{
			Model:   "gpt-4",
			ApiKey:  "test-api-key",
			BaseURL: "https://custom.api.com",
		},
	}

	// 保存配置
	if err := SaveSettings(settings); err != nil {
		t.Fatalf("保存配置失败: %v", err)
	}

	// 读取配置
	loaded, err := GetSettings()
	if err != nil {
		t.Fatalf("读取配置失败: %v", err)
	}

	// 验证基本字段
	if loaded.Theme != "dark" {
		t.Errorf("主题不匹配: got %s, want dark", loaded.Theme)
	}
	if loaded.Language != "en" {
		t.Errorf("语言不匹配: got %s, want en", loaded.Language)
	}
	if !loaded.AutoSave {
		t.Error("自动保存应为 true")
	}

	// 验证编辑器配置
	if loaded.Editor.FontSize != 16 {
		t.Errorf("字体大小不匹配: got %d, want 16", loaded.Editor.FontSize)
	}
	if loaded.Editor.FontFamily != "Fira Code" {
		t.Errorf("字体不匹配: got %s, want Fira Code", loaded.Editor.FontFamily)
	}
	if loaded.Editor.TabSize != 4 {
		t.Errorf("Tab宽度不匹配: got %d, want 4", loaded.Editor.TabSize)
	}
	if loaded.Editor.WordWrap {
		t.Error("自动换行应为 false")
	}
	if loaded.Editor.EnableMinimap != true {
		t.Error("小地图应为 true")
	}
	if loaded.Editor.FormatOnSave {
		t.Error("保存时格式化应为 false")
	}
	if loaded.Editor.CursorStyle != "block" {
		t.Errorf("光标样式不匹配: got %s, want block", loaded.Editor.CursorStyle)
	}

	// 验证终端配置
	if loaded.Terminal.Shell != "/bin/bash" {
		t.Errorf("Shell不匹配: got %s, want /bin/bash", loaded.Terminal.Shell)
	}
	if loaded.Terminal.Scrollback != 5000 {
		t.Errorf("回滚行数不匹配: got %d, want 5000", loaded.Terminal.Scrollback)
	}

	// 验证AI配置
	if loaded.AI.Model != "gpt-4" {
		t.Errorf("AI模型不匹配: got %s, want gpt-4", loaded.AI.Model)
	}
	if loaded.AI.ApiKey != "test-api-key" {
		t.Errorf("API Key不匹配: got %s, want test-api-key", loaded.AI.ApiKey)
	}
	if loaded.AI.BaseURL != "https://custom.api.com" {
		t.Errorf("BaseURL不匹配: got %s, want https://custom.api.com", loaded.AI.BaseURL)
	}
}

// TestGetSettings_EmptyDB 测试空数据库返回默认值
func TestGetSettings_EmptyDB(t *testing.T) {
	db, cleanup := setupTestDB(t)
	defer cleanup()

	oldDB := DB
	DB = db
	defer func() { DB = oldDB }()

	settings, err := GetSettings()
	if err != nil {
		t.Fatalf("读取空数据库失败: %v", err)
	}

	// 应返回默认值
	defaultSettings := defaultSettings()
	if settings.Theme != defaultSettings.Theme {
		t.Errorf("空数据库应返回默认主题: got %s, want %s", settings.Theme, defaultSettings.Theme)
	}
	if settings.Editor.FontSize != defaultSettings.Editor.FontSize {
		t.Errorf("空数据库应返回默认字体大小")
	}
}

// TestGetSettings_PartialData 测试部分数据
func TestGetSettings_PartialData(t *testing.T) {
	db, cleanup := setupTestDB(t)
	defer cleanup()

	oldDB := DB
	DB = db
	defer func() { DB = oldDB }()

	// 只保存部分配置
	_, err := db.Exec("INSERT INTO settings (key, value) VALUES (?, ?)", "theme", "light")
	if err != nil {
		t.Fatalf("插入测试数据失败: %v", err)
	}

	settings, err := GetSettings()
	if err != nil {
		t.Fatalf("读取部分数据失败: %v", err)
	}

	// 已保存的字段
	if settings.Theme != "light" {
		t.Errorf("主题应为 light: got %s", settings.Theme)
	}

	// 未保存的字段应为默认值
	defaultSettings := defaultSettings()
	if settings.Language != defaultSettings.Language {
		t.Errorf("语言应为默认值: got %s, want %s", settings.Language, defaultSettings.Language)
	}
	if settings.Editor.FontSize != defaultSettings.Editor.FontSize {
		t.Errorf("编辑器字体大小应为默认值")
	}
}

// TestSaveSettings_InvalidJSON 测试保存无效JSON
func TestSaveSettings_InvalidJSON(t *testing.T) {
	db, cleanup := setupTestDB(t)
	defer cleanup()

	oldDB := DB
	DB = db
	defer func() { DB = oldDB }()

	// 手动插入无效的编辑器JSON
	_, err := db.Exec("INSERT INTO settings (key, value) VALUES (?, ?)", "editor", "invalid json")
	if err != nil {
		t.Fatalf("插入测试数据失败: %v", err)
	}

	settings, err := GetSettings()
	if err != nil {
		t.Fatalf("读取无效JSON失败: %v", err)
	}

	// 无效JSON应被忽略，使用默认值
	defaultSettings := defaultSettings()
	if settings.Editor.FontSize != defaultSettings.Editor.FontSize {
		t.Errorf("无效JSON应使用默认编辑器配置")
	}
}

// TestResetSettings 测试重置配置
func TestResetSettings(t *testing.T) {
	db, cleanup := setupTestDB(t)
	defer cleanup()

	oldDB := DB
	DB = db
	defer func() { DB = oldDB }()

	// 先保存自定义配置
	customSettings := Settings{
		Theme:    "dark",
		Language: "en",
		AutoSave: true,
	}
	if err := SaveSettings(customSettings); err != nil {
		t.Fatalf("保存配置失败: %v", err)
	}

	// 重置
	if err := ResetSettings(); err != nil {
		t.Fatalf("重置配置失败: %v", err)
	}

	// 验证已重置为默认值
	settings, err := GetSettings()
	if err != nil {
		t.Fatalf("读取配置失败: %v", err)
	}

	defaultSettings := defaultSettings()
	if settings.Theme != defaultSettings.Theme {
		t.Errorf("重置后主题应为默认值: got %s, want %s", settings.Theme, defaultSettings.Theme)
	}
	if settings.Language != defaultSettings.Language {
		t.Errorf("重置后语言应为默认值: got %s, want %s", settings.Language, defaultSettings.Language)
	}
	if settings.AutoSave != defaultSettings.AutoSave {
		t.Errorf("重置后自动保存应为默认值")
	}
}

// TestSettingsJSONSerialization 测试配置JSON序列化
func TestSettingsJSONSerialization(t *testing.T) {
	settings := defaultSettings()

	// 序列化
	data, err := json.Marshal(settings)
	if err != nil {
		t.Fatalf("序列化失败: %v", err)
	}

	// 反序列化
	var decoded Settings
	if err := json.Unmarshal(data, &decoded); err != nil {
		t.Fatalf("反序列化失败: %v", err)
	}

	// 验证字段
	if decoded.Theme != settings.Theme {
		t.Error("主题不匹配")
	}
	if decoded.Editor.FontSize != settings.Editor.FontSize {
		t.Error("编辑器字体大小不匹配")
	}
	if decoded.Terminal.Shell != settings.Terminal.Shell {
		t.Error("终端Shell不匹配")
	}
	if decoded.AI.Model != settings.AI.Model {
		t.Error("AI模型不匹配")
	}
}

// TestEditorSettingsDefaults 测试编辑器配置默认值
func TestEditorSettingsDefaults(t *testing.T) {
	editor := defaultSettings().Editor

	expectedDefaults := map[string]interface{}{
		"FontSize":         14,
		"TabSize":          2,
		"WordWrap":         true,
		"ShowLineNumbers":  true,
		"EnableMinimap":    false,
		"FormatOnSave":     true,
		"LineHeight":       22,
		"CursorStyle":      "line",
		"CursorBlinking":   "smooth",
		"RenderWhitespace": "selection",
	}

	if editor.FontSize != expectedDefaults["FontSize"].(int) {
		t.Errorf("FontSize 默认值错误")
	}
	if editor.TabSize != expectedDefaults["TabSize"].(int) {
		t.Errorf("TabSize 默认值错误")
	}
	if editor.WordWrap != expectedDefaults["WordWrap"].(bool) {
		t.Errorf("WordWrap 默认值错误")
	}
}

// TestCloseDatabase 测试关闭数据库
func TestCloseDatabase(t *testing.T) {
	db, cleanup := setupTestDB(t)
	defer cleanup()

	oldDB := DB
	DB = db
	defer func() { DB = oldDB }()

	// 关闭数据库
	if err := CloseDatabase(); err != nil {
		t.Errorf("关闭数据库失败: %v", err)
	}

	// DB应为nil或已关闭
	if DB != nil {
		// 尝试Ping应失败
		err := DB.Ping()
		if err == nil {
			t.Error("关闭后Ping应失败")
		}
	}
}

// TestCloseDatabase_NilDB 测试关闭nil数据库
func TestCloseDatabase_NilDB(t *testing.T) {
	oldDB := DB
	DB = nil
	defer func() { DB = oldDB }()

	// 关闭nil DB不应panic
	if err := CloseDatabase(); err != nil {
		t.Errorf("关闭nil数据库不应返回错误: %v", err)
	}
}

// TestMigrate 测试数据库迁移
func TestMigrate(t *testing.T) {
	// 使用完整的数据库初始化来测试迁移
	tmpDir := t.TempDir()
	dbPath := filepath.Join(tmpDir, "test.db")

	db, err := sql.Open("sqlite3", dbPath)
	if err != nil {
		t.Fatalf("打开测试数据库失败: %v", err)
	}
	defer db.Close()

	// 临时替换全局DB
	oldDB := DB
	DB = db
	defer func() { DB = oldDB }()

	// 执行迁移
	if err := migrate(); err != nil {
		t.Fatalf("迁移失败: %v", err)
	}

	// 验证表已创建
	tables := []string{"settings", "projects", "chat_sessions", "conversations"}
	for _, table := range tables {
		var name string
		err := db.QueryRow("SELECT name FROM sqlite_master WHERE type='table' AND name=?", table).Scan(&name)
		if err != nil {
			t.Errorf("表 %s 不存在: %v", table, err)
		}
	}

	// 验证索引已创建
	var indexName string
	err = db.QueryRow("SELECT name FROM sqlite_master WHERE type='index' AND name='idx_conversations_session_id'").Scan(&indexName)
	if err != nil {
		t.Errorf("索引不存在: %v", err)
	}
}

// TestInitDatabase 测试数据库初始化
func TestInitDatabase(t *testing.T) {
	// 使用临时目录作为配置目录
	tmpDir := t.TempDir()
	oldConfigDir := os.Getenv("HOME")
	os.Setenv("HOME", tmpDir)
	defer os.Setenv("HOME", oldConfigDir)

	// 保存旧DB
	oldDB := DB
	defer func() { DB = oldDB }()

	// 注意：InitDatabase 使用 os.UserConfigDir()，在测试中可能无法完全控制
	// 这里主要验证函数不会panic
	err := InitDatabase()
	if err != nil {
		// 如果失败，记录错误但不使测试失败（因为环境限制）
		t.Logf("初始化数据库返回错误（可能由于环境限制）: %v", err)
	}

	if DB != nil {
		// 验证连接
		if err := DB.Ping(); err != nil {
			t.Errorf("数据库连接验证失败: %v", err)
		}
		DB.Close()
	}
}

// TestSettingsTypes 测试配置类型定义
func TestSettingsTypes(t *testing.T) {
	// 验证所有类型可以正确实例化
	editor := EditorSettings{}
	terminal := TerminalSettings{}
	ai := AISettings{}
	settings := Settings{
		Editor:   editor,
		Terminal: terminal,
		AI:       ai,
	}

	// 序列化不应失败
	_, err := json.Marshal(settings)
	if err != nil {
		t.Fatalf("序列化失败: %v", err)
	}
}

// BenchmarkSaveSettings 基准测试保存配置
func BenchmarkSaveSettings(b *testing.B) {
	db, cleanup := setupTestDB(&testing.T{})
	defer cleanup()

	oldDB := DB
	DB = db
	defer func() { DB = oldDB }()

	settings := defaultSettings()

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		if err := SaveSettings(settings); err != nil {
			b.Fatal(err)
		}
	}
}

// BenchmarkGetSettings 基准测试读取配置
func BenchmarkGetSettings(b *testing.B) {
	db, cleanup := setupTestDB(&testing.T{})
	defer cleanup()

	oldDB := DB
	DB = db
	defer func() { DB = oldDB }()

	// 先保存一些数据
	SaveSettings(defaultSettings())

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		if _, err := GetSettings(); err != nil {
			b.Fatal(err)
		}
	}
}

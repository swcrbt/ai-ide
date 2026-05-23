package e2e

import (
	"database/sql"
	"os"
	"path/filepath"
	"testing"

	"github.com/swcrbt/ai-ide/internal/config"
	_ "github.com/mattn/go-sqlite3"
)

func setupTestDB(t *testing.T) (*sql.DB, func()) {
	t.Helper()

	tmpDir := t.TempDir()
	dbPath := filepath.Join(tmpDir, "test.db")

	db, err := sql.Open("sqlite3", dbPath)
	if err != nil {
		t.Fatalf("打开测试数据库失败: %v", err)
	}

	settingsTable := `
	CREATE TABLE IF NOT EXISTS settings (
		key TEXT PRIMARY KEY,
		value TEXT NOT NULL,
		updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
	);`
	if _, err := db.Exec(settingsTable); err != nil {
		t.Fatalf("创建设置表失败: %v", err)
	}

	return db, func() {
		db.Close()
		os.Remove(dbPath)
	}
}

func TestConfigManager_Init(t *testing.T) {
	db, cleanup := setupTestDB(t)
	defer cleanup()

	oldDB := config.DB
	config.DB = db
	defer func() { config.DB = oldDB }()

	if err := config.DB.Ping(); err != nil {
		t.Fatalf("数据库初始化后 Ping 失败: %v", err)
	}

	var count int
	err := config.DB.QueryRow("SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='settings'").Scan(&count)
	if err != nil {
		t.Fatalf("查询表存在性失败: %v", err)
	}
	if count != 1 {
		t.Error("settings 表应已创建")
	}
}

func TestConfigManager_GetSet(t *testing.T) {
	db, cleanup := setupTestDB(t)
	defer cleanup()

	oldDB := config.DB
	config.DB = db
	defer func() { config.DB = oldDB }()

	settings := config.Settings{
		Theme:    "dark",
		Language: "en",
		AutoSave: true,
	}

	if err := config.SaveSettings(settings); err != nil {
		t.Fatalf("保存配置失败: %v", err)
	}

	loaded, err := config.GetSettings()
	if err != nil {
		t.Fatalf("读取配置失败: %v", err)
	}

	if loaded.Theme != "dark" {
		t.Errorf("主题不匹配: got %s, want dark", loaded.Theme)
	}
	if loaded.Language != "en" {
		t.Errorf("语言不匹配: got %s, want en", loaded.Language)
	}
	if !loaded.AutoSave {
		t.Error("自动保存应为 true")
	}
}

func TestConfigManager_GetAll(t *testing.T) {
	db, cleanup := setupTestDB(t)
	defer cleanup()

	oldDB := config.DB
	config.DB = db
	defer func() { config.DB = oldDB }()

	settings := config.Settings{
		Theme:    "light",
		Language: "zh",
		AutoSave: false,
		Editor: config.EditorSettings{
			FontSize:         16,
			FontFamily:       "Fira Code",
			TabSize:          4,
			WordWrap:         false,
			ShowLineNumbers:  true,
			EnableMinimap:    true,
			FormatOnSave:     false,
			LineHeight:       24,
			CursorStyle:      "block",
			CursorBlinking:   "blink",
			RenderWhitespace: "all",
		},
		Terminal: config.TerminalSettings{
			Shell:       "/bin/bash",
			FontSize:    16,
			FontFamily:  "Monaco",
			CursorStyle: "line",
			Scrollback:  5000,
		},
	}

	if err := config.SaveSettings(settings); err != nil {
		t.Fatalf("保存配置失败: %v", err)
	}

	loaded, err := config.GetSettings()
	if err != nil {
		t.Fatalf("读取配置失败: %v", err)
	}

	if loaded.Theme != "light" {
		t.Errorf("主题不匹配: got %s, want light", loaded.Theme)
	}
	if loaded.Language != "zh" {
		t.Errorf("语言不匹配: got %s, want zh", loaded.Language)
	}
	if loaded.AutoSave {
		t.Error("自动保存应为 false")
	}

	if loaded.Editor.FontSize != 16 {
		t.Errorf("编辑器字体大小应为 16, got %d", loaded.Editor.FontSize)
	}
	if loaded.Terminal.Shell != "/bin/bash" {
		t.Errorf("终端 Shell 应为 /bin/bash, got %s", loaded.Terminal.Shell)
	}
}

func TestConfigManager_Delete(t *testing.T) {
	db, cleanup := setupTestDB(t)
	defer cleanup()

	oldDB := config.DB
	config.DB = db
	defer func() { config.DB = oldDB }()

	settings := config.Settings{
		Theme:    "dark",
		Language: "en",
	}

	if err := config.SaveSettings(settings); err != nil {
		t.Fatalf("保存配置失败: %v", err)
	}

	if err := config.ResetSettings(); err != nil {
		t.Fatalf("重置配置失败: %v", err)
	}

	loaded, err := config.GetSettings()
	if err != nil {
		t.Fatalf("读取配置失败: %v", err)
	}

	if loaded.Theme != "system" {
		t.Errorf("重置后主题应为默认值 system, got %s", loaded.Theme)
	}
	if loaded.Language != "zh" {
		t.Errorf("重置后语言应为默认值 zh, got %s", loaded.Language)
	}
}

func TestConfigManager_Update(t *testing.T) {
	db, cleanup := setupTestDB(t)
	defer cleanup()

	oldDB := config.DB
	config.DB = db
	defer func() { config.DB = oldDB }()

	settings := config.Settings{
		Theme:    "dark",
		Language: "en",
	}

	if err := config.SaveSettings(settings); err != nil {
		t.Fatalf("保存初始配置失败: %v", err)
	}

	settings.Theme = "light"
	settings.Language = "zh"
	if err := config.SaveSettings(settings); err != nil {
		t.Fatalf("更新配置失败: %v", err)
	}

	loaded, err := config.GetSettings()
	if err != nil {
		t.Fatalf("读取配置失败: %v", err)
	}

	if loaded.Theme != "light" {
		t.Errorf("更新后主题应为 light, got %s", loaded.Theme)
	}
	if loaded.Language != "zh" {
		t.Errorf("更新后语言应为 zh, got %s", loaded.Language)
	}
}

package tools

import (
	"database/sql"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"time"

	_ "github.com/mattn/go-sqlite3"
)

// WorkflowTool 工作流管理工具
// 支持保存命名的工作流（命令序列）到 SQLite，以及执行已保存的工作流
type WorkflowTool struct {
	db *sql.DB
}

// Workflow 工作流结构
type Workflow struct {
	ID        int
	Name      string
	Commands  []string
	CreatedAt time.Time
	UpdatedAt time.Time
}

// NewWorkflowTool 创建新的工作流工具实例
func NewWorkflowTool() *WorkflowTool {
	tool := &WorkflowTool{}
	// 延迟初始化数据库连接
	return tool
}

// initDB 初始化数据库连接
func (t *WorkflowTool) initDB() error {
	if t.db != nil {
		return nil
	}

	// 获取用户主目录
	homeDir, err := os.UserHomeDir()
	if err != nil {
		homeDir = "."
	}

	// 创建数据目录
	dataDir := filepath.Join(homeDir, ".ai-ide")
	if err := os.MkdirAll(dataDir, 0755); err != nil {
		return fmt.Errorf("创建数据目录失败: %w", err)
	}

	dbPath := filepath.Join(dataDir, "workflows.db")
	db, err := sql.Open("sqlite3", dbPath)
	if err != nil {
		return fmt.Errorf("打开数据库失败: %w", err)
	}

	t.db = db

	// 创建工作流表
	createTableSQL := `
		CREATE TABLE IF NOT EXISTS workflows (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			name TEXT UNIQUE NOT NULL,
			commands TEXT NOT NULL,
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
			updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
		)
	`
	_, err = t.db.Exec(createTableSQL)
	if err != nil {
		return fmt.Errorf("创建表失败: %w", err)
	}

	return nil
}

// Name 返回工具名称
func (t *WorkflowTool) Name() string {
	return "workflow"
}

// Description 返回工具描述
func (t *WorkflowTool) Description() string {
	return "工作流管理工具，保存命名的工作流（命令序列）到 SQLite 数据库，支持执行已保存的工作流，返回执行结果"
}

// Execute 执行工作流操作
// 参数:
//   - action (string): 操作类型，可选值：save/execute/list/delete（必需）
//   - name (string): 工作流名称（save/execute/delete 时必需）
//   - commands ([]interface{}): 命令列表（save 时必需）
//
// save: 保存工作流到数据库
// execute: 执行已保存的工作流
// list: 列出所有已保存的工作流
// delete: 删除指定工作流
func (t *WorkflowTool) Execute(args map[string]interface{}) (string, error) {
	// 初始化数据库
	if err := t.initDB(); err != nil {
		return "", err
	}

	// 提取 action 参数
	action, ok := getStringArg(args, "action")
	if !ok || action == "" {
		return "", fmt.Errorf("缺少必需参数 'action'，可选值：save/execute/list/delete")
	}

	action = strings.ToLower(action)

	switch action {
	case "save":
		return t.executeSave(args)
	case "execute":
		return t.executeWorkflow(args)
	case "list":
		return t.executeList()
	case "delete":
		return t.executeDelete(args)
	default:
		return "", fmt.Errorf("不支持的操作类型 '%s'，可选值：save/execute/list/delete", action)
	}
}

// executeSave 保存工作流
func (t *WorkflowTool) executeSave(args map[string]interface{}) (string, error) {
	name, ok := getStringArg(args, "name")
	if !ok || name == "" {
		return "", fmt.Errorf("save 操作需要 'name' 参数（工作流名称）")
	}

	// 提取命令列表
	commandsRaw, ok := args["commands"]
	if !ok {
		return "", fmt.Errorf("save 操作需要 'commands' 参数（命令列表）")
	}

	var commands []string
	switch v := commandsRaw.(type) {
	case []interface{}:
		for _, cmd := range v {
			if cmdStr, ok := cmd.(string); ok {
				commands = append(commands, cmdStr)
			}
		}
	case []string:
		commands = v
	default:
		return "", fmt.Errorf("'commands' 参数必须是字符串数组")
	}

	if len(commands) == 0 {
		return "", fmt.Errorf("命令列表不能为空")
	}

	// 将命令序列化为 JSON 字符串
	commandsStr := strings.Join(commands, "\n")

	// 插入或更新工作流
	upsertSQL := `
		INSERT INTO workflows (name, commands, updated_at) 
		VALUES (?, ?, CURRENT_TIMESTAMP)
		ON CONFLICT(name) DO UPDATE SET 
			commands = excluded.commands,
			updated_at = CURRENT_TIMESTAMP
	`
	_, err := t.db.Exec(upsertSQL, name, commandsStr)
	if err != nil {
		return "", fmt.Errorf("保存工作流失败: %w", err)
	}

	return fmt.Sprintf("工作流 '%s' 保存成功（共 %d 个命令）", name, len(commands)), nil
}

// executeWorkflow 执行工作流
func (t *WorkflowTool) executeWorkflow(args map[string]interface{}) (string, error) {
	name, ok := getStringArg(args, "name")
	if !ok || name == "" {
		return "", fmt.Errorf("execute 操作需要 'name' 参数（工作流名称）")
	}

	// 查询工作流
	var commandsStr string
	err := t.db.QueryRow("SELECT commands FROM workflows WHERE name = ?", name).Scan(&commandsStr)
	if err != nil {
		if err == sql.ErrNoRows {
			return "", fmt.Errorf("工作流 '%s' 不存在", name)
		}
		return "", fmt.Errorf("查询工作流失败: %w", err)
	}

	// 解析命令列表
	commands := strings.Split(commandsStr, "\n")

	// 执行命令序列
	var results strings.Builder
	results.WriteString(fmt.Sprintf("执行工作流 '%s'（共 %d 个命令）\n", name, len(commands)))
	results.WriteString(strings.Repeat("=", 50) + "\n\n")

	for i, command := range commands {
		command = strings.TrimSpace(command)
		if command == "" {
			continue
		}

		results.WriteString(fmt.Sprintf("[%d/%d] $ %s\n", i+1, len(commands), command))

		// 使用 rtk 工具执行命令
		rtk := NewRTKTool()
		output, err := rtk.Execute(map[string]interface{}{
			"command":  command,
			"maxLines": 50,
		})

		if err != nil {
			results.WriteString(fmt.Sprintf("错误: %v\n", err))
		} else {
			results.WriteString(output + "\n")
		}
		results.WriteString("\n")
	}

	results.WriteString(strings.Repeat("=", 50) + "\n")
	results.WriteString("工作流执行完成\n")

	return results.String(), nil
}

// executeList 列出所有工作流
func (t *WorkflowTool) executeList() (string, error) {
	rows, err := t.db.Query("SELECT name, commands, created_at, updated_at FROM workflows ORDER BY updated_at DESC")
	if err != nil {
		return "", fmt.Errorf("查询工作流列表失败: %w", err)
	}
	defer rows.Close()

	var builder strings.Builder
	builder.WriteString("已保存的工作流列表\n")
	builder.WriteString(strings.Repeat("=", 50) + "\n\n")

	count := 0
	for rows.Next() {
		var name, commandsStr string
		var createdAt, updatedAt time.Time

		if err := rows.Scan(&name, &commandsStr, &createdAt, &updatedAt); err != nil {
			continue
		}

		commands := strings.Split(commandsStr, "\n")
		validCommands := 0
		for _, cmd := range commands {
			if strings.TrimSpace(cmd) != "" {
				validCommands++
			}
		}

		builder.WriteString(fmt.Sprintf("名称: %s\n", name))
		builder.WriteString(fmt.Sprintf("命令数: %d\n", validCommands))
		builder.WriteString(fmt.Sprintf("创建时间: %s\n", createdAt.Format("2006-01-02 15:04:05")))
		builder.WriteString(fmt.Sprintf("更新时间: %s\n", updatedAt.Format("2006-01-02 15:04:05")))
		builder.WriteString("\n")
		count++
	}

	if count == 0 {
		builder.WriteString("暂无已保存的工作流\n")
	} else {
		builder.WriteString(fmt.Sprintf("共 %d 个工作流\n", count))
	}

	return builder.String(), nil
}

// executeDelete 删除工作流
func (t *WorkflowTool) executeDelete(args map[string]interface{}) (string, error) {
	name, ok := getStringArg(args, "name")
	if !ok || name == "" {
		return "", fmt.Errorf("delete 操作需要 'name' 参数（工作流名称）")
	}

	result, err := t.db.Exec("DELETE FROM workflows WHERE name = ?", name)
	if err != nil {
		return "", fmt.Errorf("删除工作流失败: %w", err)
	}

	rowsAffected, _ := result.RowsAffected()
	if rowsAffected == 0 {
		return "", fmt.Errorf("工作流 '%s' 不存在", name)
	}

	return fmt.Sprintf("工作流 '%s' 删除成功", name), nil
}

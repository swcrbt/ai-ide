package tools

import (
	"fmt"
	"strings"
)

// CommandSuggestTool 命令建议工具
// 根据自然语言描述生成终端命令建议
type CommandSuggestTool struct{}

// NewCommandSuggestTool 创建新的命令建议工具实例
func NewCommandSuggestTool() *CommandSuggestTool {
	return &CommandSuggestTool{}
}

// Name 返回工具名称
func (t *CommandSuggestTool) Name() string {
	return "command_suggest"
}

// Description 返回工具描述
func (t *CommandSuggestTool) Description() string {
	return "命令建议工具，根据自然语言描述生成终端命令建议，返回建议的命令和解释"
}

// Execute 生成命令建议
// 参数:
//   - description (string): 自然语言描述，说明要执行的操作（必需）
//
// 返回：建议的命令 + 解释
func (t *CommandSuggestTool) Execute(args map[string]interface{}) (string, error) {
	// 提取描述参数
	description, ok := getStringArg(args, "description")
	if !ok || description == "" {
		return "", fmt.Errorf("缺少必需参数 'description'，请提供自然语言描述")
	}

	// 根据描述匹配命令建议
	suggestions := t.generateSuggestions(description)

	if len(suggestions) == 0 {
		return t.formatNoSuggestion(description), nil
	}

	return t.formatSuggestions(description, suggestions), nil
}

// CommandSuggestion 命令建议结构
type CommandSuggestion struct {
	Command     string
	Explanation string
	Platform    string // 适用平台：all/linux/macos/windows
}

// generateSuggestions 根据描述生成命令建议
func (t *CommandSuggestTool) generateSuggestions(description string) []CommandSuggestion {
	desc := strings.ToLower(description)
	var suggestions []CommandSuggestion

	// 文件操作相关
	if containsAny(desc, []string{"find file", "查找文件", "搜索文件", "find", "查找"}) {
		suggestions = append(suggestions, CommandSuggestion{
			Command:     "find . -name '*.go' -type f",
			Explanation: "在当前目录递归查找所有 .go 文件",
			Platform:    "all",
		})
		suggestions = append(suggestions, CommandSuggestion{
			Command:     "find /path -name 'filename' 2>/dev/null",
			Explanation: "在指定路径查找文件，忽略权限错误",
			Platform:    "linux",
		})
	}

	if containsAny(desc, []string{"list", "ls", "查看目录", "列出文件", "显示文件", "列出", "目录"}) {
		suggestions = append(suggestions, CommandSuggestion{
			Command:     "ls -la",
			Explanation: "列出当前目录所有文件（包括隐藏文件）及详细信息",
			Platform:    "all",
		})
		suggestions = append(suggestions, CommandSuggestion{
			Command:     "ls -lt | head -20",
			Explanation: "按修改时间排序，显示最近修改的 20 个文件",
			Platform:    "all",
		})
	}

	if containsAny(desc, []string{"copy", "复制", "拷贝"}) {
		suggestions = append(suggestions, CommandSuggestion{
			Command:     "cp -r source/ destination/",
			Explanation: "递归复制目录及其内容",
			Platform:    "all",
		})
	}

	if containsAny(desc, []string{"move", "rename", "移动", "重命名"}) {
		suggestions = append(suggestions, CommandSuggestion{
			Command:     "mv oldname newname",
			Explanation: "重命名文件或移动文件到目标位置",
			Platform:    "all",
		})
	}

	if containsAny(desc, []string{"delete", "remove", "删除", "移除", "rm"}) {
		suggestions = append(suggestions, CommandSuggestion{
			Command:     "rm filename",
			Explanation: "删除文件（⚠️ 谨慎使用，不可恢复）",
			Platform:    "all",
		})
		suggestions = append(suggestions, CommandSuggestion{
			Command:     "rm -rf dirname/",
			Explanation: "递归强制删除目录（⚠️ 极其危险，请确认路径正确）",
			Platform:    "all",
		})
	}

	// 系统信息相关
	if containsAny(desc, []string{"disk", "space", "磁盘", "空间", "存储"}) {
		suggestions = append(suggestions, CommandSuggestion{
			Command:     "df -h",
			Explanation: "查看磁盘空间使用情况（人类可读格式）",
			Platform:    "all",
		})
		suggestions = append(suggestions, CommandSuggestion{
			Command:     "du -sh * | sort -rh | head -20",
			Explanation: "查看当前目录下各文件/目录大小，按大小排序",
			Platform:    "linux",
		})
	}

	if containsAny(desc, []string{"memory", "ram", "内存"}) {
		suggestions = append(suggestions, CommandSuggestion{
			Command:     "free -h",
			Explanation: "查看内存使用情况（人类可读格式）",
			Platform:    "linux",
		})
		suggestions = append(suggestions, CommandSuggestion{
			Command:     "vm_stat",
			Explanation: "查看 macOS 虚拟内存统计信息",
			Platform:    "macos",
		})
	}

	if containsAny(desc, []string{"process", "cpu", "进程", "cpu 占用"}) {
		suggestions = append(suggestions, CommandSuggestion{
			Command:     "top -o cpu",
			Explanation: "查看按 CPU 使用率排序的进程列表",
			Platform:    "macos",
		})
		suggestions = append(suggestions, CommandSuggestion{
			Command:     "ps aux --sort=-%cpu | head -20",
			Explanation: "查看按 CPU 使用率排序的进程（Linux）",
			Platform:    "linux",
		})
	}

	// Git 相关
	if containsAny(desc, []string{"git", "版本控制", "提交", "commit", "分支", "branch"}) {
		if containsAny(desc, []string{"status", "状态"}) {
			suggestions = append(suggestions, CommandSuggestion{
				Command:     "git status",
				Explanation: "查看当前工作区状态",
				Platform:    "all",
			})
		}
		if containsAny(desc, []string{"log", "历史", "记录"}) {
			suggestions = append(suggestions, CommandSuggestion{
				Command:     "git log --oneline -20",
				Explanation: "查看最近 20 条提交的简要信息",
				Platform:    "all",
			})
		}
		if containsAny(desc, []string{"branch", "分支"}) {
			suggestions = append(suggestions, CommandSuggestion{
				Command:     "git branch -a",
				Explanation: "列出所有本地和远程分支",
				Platform:    "all",
			})
		}
		suggestions = append(suggestions, CommandSuggestion{
			Command:     "git add . && git commit -m \"提交信息\"",
			Explanation: "添加所有更改并提交（请替换提交信息）",
			Platform:    "all",
		})
	}

	// 网络相关
	if containsAny(desc, []string{"network", "ping", "网络", "连接", "端口"}) {
		suggestions = append(suggestions, CommandSuggestion{
			Command:     "ping -c 4 example.com",
			Explanation: "测试到指定主机的网络连通性（发送 4 个包）",
			Platform:    "all",
		})
		suggestions = append(suggestions, CommandSuggestion{
			Command:     "netstat -tlnp",
			Explanation: "查看监听中的 TCP 端口和对应进程（Linux）",
			Platform:    "linux",
		})
		suggestions = append(suggestions, CommandSuggestion{
			Command:     "lsof -i :8080",
			Explanation: "查看占用 8080 端口的进程",
			Platform:    "macos",
		})
	}

	// 文本处理相关
	if containsAny(desc, []string{"search", "grep", "搜索文本", "查找内容"}) {
		suggestions = append(suggestions, CommandSuggestion{
			Command:     "grep -r 'pattern' .",
			Explanation: "在当前目录递归搜索包含指定模式的文件",
			Platform:    "all",
		})
		suggestions = append(suggestions, CommandSuggestion{
			Command:     "grep -rn 'pattern' --include='*.go' .",
			Explanation: "递归搜索 .go 文件中包含指定模式的内容，显示行号",
			Platform:    "all",
		})
	}

	if containsAny(desc, []string{"replace", "替换", "sed"}) {
		suggestions = append(suggestions, CommandSuggestion{
			Command:     "sed -i 's/old/new/g' file.txt",
			Explanation: "将文件中的 'old' 替换为 'new'（原地修改）",
			Platform:    "linux",
		})
	}

	// 压缩解压
	if containsAny(desc, []string{"compress", "zip", "archive", "压缩", "打包"}) {
		suggestions = append(suggestions, CommandSuggestion{
			Command:     "tar -czvf archive.tar.gz directory/",
			Explanation: "将目录打包并 gzip 压缩",
			Platform:    "all",
		})
	}

	if containsAny(desc, []string{"extract", "unzip", "解压", "解包"}) {
		suggestions = append(suggestions, CommandSuggestion{
			Command:     "tar -xzvf archive.tar.gz",
			Explanation: "解压 gzip 压缩的 tar 包",
			Platform:    "all",
		})
		suggestions = append(suggestions, CommandSuggestion{
			Command:     "unzip archive.zip -d destination/",
			Explanation: "解压 zip 文件到指定目录",
			Platform:    "all",
		})
	}

	// 如果没有匹配到特定命令，提供一些通用建议
	if len(suggestions) == 0 {
		suggestions = append(suggestions, CommandSuggestion{
			Command:     "echo \"请提供更具体的描述\"",
			Explanation: "未能根据描述匹配到具体命令，建议提供更详细的操作说明",
			Platform:    "all",
		})
	}

	return suggestions
}

// containsAny 检查字符串是否包含任意一个关键词
func containsAny(s string, keywords []string) bool {
	for _, keyword := range keywords {
		if strings.Contains(s, keyword) {
			return true
		}
	}
	return false
}

// formatSuggestions 格式化命令建议输出
func (t *CommandSuggestTool) formatSuggestions(description string, suggestions []CommandSuggestion) string {
	var builder strings.Builder

	builder.WriteString(fmt.Sprintf("根据描述 '%s'，为您推荐以下命令：\n", description))
	builder.WriteString(strings.Repeat("=", 50) + "\n\n")

	for i, sug := range suggestions {
		builder.WriteString(fmt.Sprintf("建议 %d", i+1))
		if sug.Platform != "all" {
			builder.WriteString(fmt.Sprintf(" [%s]", sug.Platform))
		}
		builder.WriteString("\n")
		builder.WriteString(fmt.Sprintf("命令: %s\n", sug.Command))
		builder.WriteString(fmt.Sprintf("说明: %s\n", sug.Explanation))
		builder.WriteString("\n")
	}

	builder.WriteString(strings.Repeat("=", 50) + "\n")
	builder.WriteString("提示: 执行前请确认命令的安全性，特别是涉及删除、修改的操作。\n")

	return builder.String()
}

// formatNoSuggestion 格式化无建议时的输出
func (t *CommandSuggestTool) formatNoSuggestion(description string) string {
	var builder strings.Builder

	builder.WriteString(fmt.Sprintf("未能根据 '%s' 生成具体命令建议。\n\n", description))
	builder.WriteString("您可以尝试以下通用命令:\n")
	builder.WriteString("- man [command]    # 查看命令帮助文档\n")
	builder.WriteString("- [command] --help # 查看命令帮助信息\n")
	builder.WriteString("- apropos [keyword] # 搜索相关命令\n\n")
	builder.WriteString("请提供更具体的操作描述，例如:\n")
	builder.WriteString("- '查找所有大于 100MB 的文件'\n")
	builder.WriteString("- '将视频文件转换为 MP4 格式'\n")
	builder.WriteString("- '查看系统内存使用情况'\n")

	return builder.String()
}

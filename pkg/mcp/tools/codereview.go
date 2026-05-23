package tools

import (
	"fmt"
	"regexp"
	"strings"
)

// CodeReviewTool 代码审查工具
// 对代码进行简单的质量分析，包括行数、复杂度检查和常见错误模式检测
type CodeReviewTool struct{}

// NewCodeReviewTool 创建新的代码审查工具实例
func NewCodeReviewTool() *CodeReviewTool {
	return &CodeReviewTool{}
}

// Name 返回工具名称
func (t *CodeReviewTool) Name() string {
	return "code_review"
}

// Description 返回工具描述
func (t *CodeReviewTool) Description() string {
	return "代码审查工具，对代码进行质量分析，包括行数统计、复杂度检查、常见错误模式检测，返回评分和问题列表"
}

// Execute 执行代码审查
// 参数:
//   - code (string): 要审查的代码内容（必需）
//   - language (string): 代码语言，如 go/javascript/python（可选，自动检测）
//
// 返回：评分 + 问题列表 + 建议
func (t *CodeReviewTool) Execute(args map[string]interface{}) (string, error) {
	// 提取代码参数
	code, ok := getStringArg(args, "code")
	if !ok || code == "" {
		return "", fmt.Errorf("缺少必需参数 'code'，请提供要审查的代码")
	}

	// 提取或检测语言
	language, _ := getStringArg(args, "language")
	if language == "" {
		language = t.detectLanguage(code)
	}

	// 执行代码分析
	result := t.analyzeCode(code, language)
	return result, nil
}

// CodeIssue 代码问题结构
type CodeIssue struct {
	Line     int
	Severity string // critical/warning/info
	Message  string
	Rule     string
}

// detectLanguage 根据代码内容检测编程语言
func (t *CodeReviewTool) detectLanguage(code string) string {
	// 根据常见语法特征检测语言
	if strings.Contains(code, "package ") && strings.Contains(code, "func ") {
		return "go"
	}
	if strings.Contains(code, "function ") || strings.Contains(code, "const ") && strings.Contains(code, "let ") {
		return "javascript"
	}
	if strings.Contains(code, "def ") && strings.Contains(code, ":") {
		return "python"
	}
	if strings.Contains(code, "import ") && strings.Contains(code, ";") {
		if strings.Contains(code, "public class ") || strings.Contains(code, "private ") {
			return "java"
		}
		return "javascript"
	}
	if strings.Contains(code, "<?php") {
		return "php"
	}
	if strings.Contains(code, "#include") {
		return "cpp"
	}
	return "unknown"
}

// analyzeCode 分析代码并返回审查结果
func (t *CodeReviewTool) analyzeCode(code, language string) string {
	lines := strings.Split(code, "\n")
	totalLines := len(lines)
	codeLines := 0
	commentLines := 0
	blankLines := 0

	var issues []CodeIssue

	// 统计行数和检测问题
	for i, line := range lines {
		trimmed := strings.TrimSpace(line)
		lineNum := i + 1

		if trimmed == "" {
			blankLines++
			continue
		}

		// 检测注释行
		if t.isCommentLine(trimmed, language) {
			commentLines++
			continue
		}

		codeLines++

		// 检测行长度问题
		if len(line) > 120 {
			issues = append(issues, CodeIssue{
				Line:     lineNum,
				Severity: "warning",
				Message:  fmt.Sprintf("行长度超过 120 字符（当前 %d 字符），建议拆分为多行", len(line)),
				Rule:     "LINE_TOO_LONG",
			})
		}

		// 根据语言检测特定问题
		langIssues := t.checkLanguageSpecificIssues(trimmed, lineNum, language)
		issues = append(issues, langIssues...)

		// 通用问题检测
		generalIssues := t.checkGeneralIssues(trimmed, lineNum)
		issues = append(issues, generalIssues...)
	}

	// 计算复杂度指标
	complexity := t.calculateComplexity(code, language)

	// 计算评分
	score := t.calculateScore(totalLines, codeLines, commentLines, blankLines, complexity, len(issues))

	// 格式化输出
	return t.formatReviewResult(code, language, totalLines, codeLines, commentLines, blankLines, complexity, score, issues)
}

// isCommentLine 判断是否为注释行
func (t *CodeReviewTool) isCommentLine(line, language string) bool {
	switch language {
	case "go", "javascript", "java", "cpp", "c":
		return strings.HasPrefix(line, "//") || strings.HasPrefix(line, "/*") || strings.HasPrefix(line, "*")
	case "python":
		return strings.HasPrefix(line, "#") || strings.HasPrefix(line, `"""`) || strings.HasPrefix(line, "'''")
	case "php":
		return strings.HasPrefix(line, "//") || strings.HasPrefix(line, "#") || strings.HasPrefix(line, "/*") || strings.HasPrefix(line, "*")
	default:
		return strings.HasPrefix(line, "//") || strings.HasPrefix(line, "#")
	}
}

// checkLanguageSpecificIssues 检查语言特定的问题
func (t *CodeReviewTool) checkLanguageSpecificIssues(line string, lineNum int, language string) []CodeIssue {
	var issues []CodeIssue

	switch language {
	case "go":
		issues = append(issues, t.checkGoIssues(line, lineNum)...)
	case "javascript":
		issues = append(issues, t.checkJavaScriptIssues(line, lineNum)...)
	case "python":
		issues = append(issues, t.checkPythonIssues(line, lineNum)...)
	}

	return issues
}

// checkGoIssues 检查 Go 代码问题
func (t *CodeReviewTool) checkGoIssues(line string, lineNum int) []CodeIssue {
	var issues []CodeIssue

	// 检查 error 未处理
	if strings.Contains(line, ".") && !strings.Contains(line, "=") && !strings.Contains(line, "_") {
		// 简单的启发式检测：函数调用返回值未使用
		funcCallPattern := regexp.MustCompile(`\w+\([^)]*\)$`)
		if funcCallPattern.MatchString(line) && !strings.Contains(line, "if ") && !strings.Contains(line, "for ") {
			// 放宽条件，仅对明显的错误处理做提示
		}
	}

	// 检查 defer 中可能的错误
	if strings.Contains(line, "defer") && strings.Contains(line, "Close()") {
		if !strings.Contains(line, "err") {
			issues = append(issues, CodeIssue{
				Line:     lineNum,
				Severity: "info",
				Message:  "defer 关闭资源时建议检查错误返回值",
				Rule:     "DEFER_ERROR_CHECK",
			})
		}
	}

	// 检查空的 interface{}
	if strings.Contains(line, "interface{}") {
		issues = append(issues, CodeIssue{
			Line:     lineNum,
			Severity: "warning",
			Message:  "使用 interface{} 会丧失类型安全，建议定义具体类型或使用泛型",
			Rule:     "EMPTY_INTERFACE",
		})
	}

	// 检查全局变量
	if strings.HasPrefix(line, "var ") && strings.Contains(line, "=") {
		// 检查是否为包级变量
		if !strings.HasPrefix(line, "var (") {
			issues = append(issues, CodeIssue{
				Line:     lineNum,
				Severity: "info",
				Message:  "全局变量可能导致并发问题，建议使用局部变量或封装到结构体中",
				Rule:     "GLOBAL_VAR",
			})
		}
	}

	return issues
}

// checkJavaScriptIssues 检查 JavaScript 代码问题
func (t *CodeReviewTool) checkJavaScriptIssues(line string, lineNum int) []CodeIssue {
	var issues []CodeIssue

	// 检查 == 使用
	if strings.Contains(line, "==") && !strings.Contains(line, "===") && !strings.Contains(line, "!=") {
		issues = append(issues, CodeIssue{
			Line:     lineNum,
			Severity: "warning",
			Message:  "建议使用 === 替代 == 进行严格相等比较",
			Rule:     "STRICT_EQUALITY",
		})
	}

	// 检查 var 使用
	if strings.HasPrefix(line, "var ") {
		issues = append(issues, CodeIssue{
			Line:     lineNum,
			Severity: "warning",
			Message:  "建议使用 let 或 const 替代 var，避免变量提升问题",
			Rule:     "VAR_USAGE",
		})
	}

	// 检查 console.log
	if strings.Contains(line, "console.log") {
		issues = append(issues, CodeIssue{
			Line:     lineNum,
			Severity: "info",
			Message:  "生产代码中应移除 console.log 调试语句",
			Rule:     "CONSOLE_LOG",
		})
	}

	// 检查 eval
	if strings.Contains(line, "eval(") {
		issues = append(issues, CodeIssue{
			Line:     lineNum,
			Severity: "critical",
			Message:  "eval() 存在安全风险，应避免使用",
			Rule:     "EVAL_USAGE",
		})
	}

	return issues
}

// checkPythonIssues 检查 Python 代码问题
func (t *CodeReviewTool) checkPythonIssues(line string, lineNum int) []CodeIssue {
	var issues []CodeIssue

	// 检查 except 未指定异常类型
	if strings.HasPrefix(line, "except:") && !strings.Contains(line, "except Exception") {
		issues = append(issues, CodeIssue{
			Line:     lineNum,
			Severity: "warning",
			Message:  "建议捕获具体的异常类型，避免捕获所有异常（包括 KeyboardInterrupt）",
			Rule:     "BARE_EXCEPT",
		})
	}

	// 检查 print 语句
	if strings.HasPrefix(line, "print(") {
		issues = append(issues, CodeIssue{
			Line:     lineNum,
			Severity: "info",
			Message:  "生产代码中建议使用日志库替代 print",
			Rule:     "PRINT_USAGE",
		})
	}

	// 检查 mutable default arguments
	if strings.Contains(line, "def ") && strings.Contains(line, "=[]") || strings.Contains(line, "={}") {
		issues = append(issues, CodeIssue{
			Line:     lineNum,
			Severity: "critical",
			Message:  "避免使用可变对象（列表、字典）作为默认参数值",
			Rule:     "MUTABLE_DEFAULT",
		})
	}

	return issues
}

// checkGeneralIssues 检查通用问题
func (t *CodeReviewTool) checkGeneralIssues(line string, lineNum int) []CodeIssue {
	var issues []CodeIssue

	// 检查 TODO/FIXME
	upperLine := strings.ToUpper(line)
	if strings.Contains(upperLine, "TODO") || strings.Contains(upperLine, "FIXME") || strings.Contains(upperLine, "HACK") {
		issues = append(issues, CodeIssue{
			Line:     lineNum,
			Severity: "info",
			Message:  "代码中包含 TODO/FIXME/HACK 标记，建议尽快处理",
			Rule:     "TODO_MARKER",
		})
	}

	// 检查硬编码密码/密钥
	sensitivePatterns := []string{"password", "passwd", "secret", "api_key", "apikey", "token"}
	lowerLine := strings.ToLower(line)
	for _, pattern := range sensitivePatterns {
		if strings.Contains(lowerLine, pattern) && strings.Contains(line, "=") {
			// 检查是否是硬编码值（简单的字符串赋值）
			if regexp.MustCompile(`["'][^"']+["']`).MatchString(line) {
				issues = append(issues, CodeIssue{
					Line:     lineNum,
					Severity: "critical",
					Message:  fmt.Sprintf("可能存在硬编码的敏感信息（%s），建议使用环境变量或配置管理", pattern),
					Rule:     "HARDCODED_SECRET",
				})
				break
			}
		}
	}

	// 检查过深的嵌套（通过缩进检测）
	indentCount := 0
	for _, ch := range line {
		if ch == ' ' || ch == '\t' {
			indentCount++
		} else {
			break
		}
	}
	if indentCount > 16 {
		issues = append(issues, CodeIssue{
			Line:     lineNum,
			Severity: "warning",
			Message:  "缩进层级过深（超过 4 层），建议重构代码以降低嵌套深度",
			Rule:     "DEEP_NESTING",
		})
	}

	return issues
}

// calculateComplexity 计算代码复杂度
func (t *CodeReviewTool) calculateComplexity(code, language string) int {
	complexity := 1 // 基础复杂度

	// 统计条件分支
	conditionKeywords := []string{"if", "else if", "switch", "case", "for", "while", "catch"}
	for _, keyword := range conditionKeywords {
		// 简单的统计（不准确，仅作参考）
		complexity += strings.Count(code, keyword+" ")
	}

	// 统计逻辑运算符
	complexity += strings.Count(code, " && ")
	complexity += strings.Count(code, " || ")

	// 限制最大复杂度值
	if complexity > 50 {
		complexity = 50
	}

	return complexity
}

// calculateScore 计算代码评分（0-100）
func (t *CodeReviewTool) calculateScore(totalLines, codeLines, commentLines, blankLines, complexity, issueCount int) int {
	score := 100

	// 根据注释比例扣分/加分
	if codeLines > 0 {
		commentRatio := float64(commentLines) / float64(codeLines)
		if commentRatio < 0.05 {
			score -= 5 // 注释过少
		} else if commentRatio > 0.3 {
			score += 5 // 注释充足
		}
	}

	// 根据复杂度扣分
	if complexity > 20 {
		score -= 15
	} else if complexity > 10 {
		score -= 8
	} else if complexity > 5 {
		score -= 3
	}

	// 根据问题数量扣分
	score -= issueCount * 3

	// 确保评分在 0-100 之间
	if score < 0 {
		score = 0
	}
	if score > 100 {
		score = 100
	}

	return score
}

// formatReviewResult 格式化审查结果
func (t *CodeReviewTool) formatReviewResult(code, language string, totalLines, codeLines, commentLines, blankLines, complexity, score int, issues []CodeIssue) string {
	var builder strings.Builder

	// 标题
	builder.WriteString("代码审查报告\n")
	builder.WriteString(strings.Repeat("=", 50) + "\n\n")

	// 基本信息
	builder.WriteString("【基本信息】\n")
	builder.WriteString(fmt.Sprintf("语言: %s\n", language))
	builder.WriteString(fmt.Sprintf("总行数: %d\n", totalLines))
	builder.WriteString(fmt.Sprintf("代码行: %d\n", codeLines))
	builder.WriteString(fmt.Sprintf("注释行: %d\n", commentLines))
	builder.WriteString(fmt.Sprintf("空行: %d\n", blankLines))
	builder.WriteString(fmt.Sprintf("圈复杂度: %d\n", complexity))
	builder.WriteString("\n")

	// 评分
	builder.WriteString("【评分】\n")
	builder.WriteString(fmt.Sprintf("综合评分: %d/100\n", score))
	if score >= 90 {
		builder.WriteString("评级: 优秀\n")
	} else if score >= 70 {
		builder.WriteString("评级: 良好\n")
	} else if score >= 50 {
		builder.WriteString("评级: 一般\n")
	} else {
		builder.WriteString("评级: 需改进\n")
	}
	builder.WriteString("\n")

	// 问题列表
	builder.WriteString(fmt.Sprintf("【问题列表】共 %d 个问题\n", len(issues)))
	if len(issues) == 0 {
		builder.WriteString("未发现明显问题，代码质量良好！\n")
	} else {
		// 按严重程度分组
		criticalCount := 0
		warningCount := 0
		infoCount := 0

		for _, issue := range issues {
			switch issue.Severity {
			case "critical":
				criticalCount++
			case "warning":
				warningCount++
			case "info":
				infoCount++
			}
		}

		builder.WriteString(fmt.Sprintf("严重: %d | 警告: %d | 信息: %d\n\n", criticalCount, warningCount, infoCount))

		for i, issue := range issues {
			severityIcon := "ℹ️"
			if issue.Severity == "critical" {
				severityIcon = "🚨"
			} else if issue.Severity == "warning" {
				severityIcon = "⚠️"
			}

			builder.WriteString(fmt.Sprintf("%d. %s 第 %d 行 [%s]\n", i+1, severityIcon, issue.Line, issue.Rule))
			builder.WriteString(fmt.Sprintf("   %s\n\n", issue.Message))
		}
	}

	// 改进建议
	builder.WriteString("【改进建议】\n")
	suggestions := t.generateSuggestions(score, complexity, commentLines, codeLines, issues)
	for i, sug := range suggestions {
		builder.WriteString(fmt.Sprintf("%d. %s\n", i+1, sug))
	}

	builder.WriteString("\n" + strings.Repeat("=", 50) + "\n")
	builder.WriteString("提示: 此为自动化代码审查，建议结合人工审查以获得更全面的评估。\n")

	return builder.String()
}

// generateSuggestions 生成改进建议
func (t *CodeReviewTool) generateSuggestions(score, complexity, commentLines, codeLines int, issues []CodeIssue) []string {
	var suggestions []string

	if score < 50 {
		suggestions = append(suggestions, "代码存在较多问题，建议优先修复严重和警告级别的问题")
	}

	if complexity > 15 {
		suggestions = append(suggestions, "代码复杂度较高，建议拆分为更小的函数")
	}

	if codeLines > 0 {
		commentRatio := float64(commentLines) / float64(codeLines)
		if commentRatio < 0.05 {
			suggestions = append(suggestions, "注释比例过低，建议为关键逻辑添加注释")
		}
	}

	if len(issues) > 10 {
		suggestions = append(suggestions, "问题数量较多，建议分阶段逐步修复")
	}

	if len(suggestions) == 0 {
		suggestions = append(suggestions, "代码整体质量良好，继续保持！")
	}

	return suggestions
}

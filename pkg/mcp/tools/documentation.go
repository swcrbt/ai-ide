package tools

import (
	"fmt"
	"regexp"
	"strings"
)

// DocumentationTool 文档生成工具
// 生成函数文档（提取函数签名、参数、返回值）或 README 大纲
type DocumentationTool struct{}

// NewDocumentationTool 创建新的文档生成工具实例
func NewDocumentationTool() *DocumentationTool {
	return &DocumentationTool{}
}

// Name 返回工具名称
func (t *DocumentationTool) Name() string {
	return "documentation"
}

// Description 返回工具描述
func (t *DocumentationTool) Description() string {
	return "文档生成工具，生成函数文档（提取函数签名、参数、返回值）或 README 大纲，返回生成的文档内容"
}

// Execute 生成文档
// 参数:
//   - code (string): 代码内容（生成函数文档时必需）
//   - type (string): 文档类型，可选值：function/README，默认为 function
//
// function: 分析代码中的函数，生成函数文档
// README: 根据项目信息生成 README 大纲
//
// 返回：生成的文档
func (t *DocumentationTool) Execute(args map[string]interface{}) (string, error) {
	// 提取文档类型
	docType, _ := getStringArg(args, "type")
	if docType == "" {
		docType = "function"
	}
	docType = strings.ToLower(docType)

	switch docType {
	case "function":
		code, ok := getStringArg(args, "code")
		if !ok || code == "" {
			return "", fmt.Errorf("生成函数文档需要 'code' 参数")
		}
		return t.generateFunctionDocs(code)
	case "readme":
		return t.generateReadmeOutline(args)
	default:
		return "", fmt.Errorf("不支持的文档类型 '%s'，可选值：function/README", docType)
	}
}

// FunctionDoc 函数文档结构
type FunctionDoc struct {
	Name       string
	Signature  string
	Parameters []Parameter
	Returns    []string
	Language   string
}

// Parameter 参数结构
type Parameter struct {
	Name string
	Type string
}

// generateFunctionDocs 生成函数文档
func (t *DocumentationTool) generateFunctionDocs(code string) (string, error) {
	// 检测语言
	language := t.detectLanguage(code)

	// 提取函数信息
	functions := t.extractFunctions(code, language)

	if len(functions) == 0 {
		return "未能从代码中提取到函数信息，请检查代码格式。", nil
	}

	// 生成文档
	var builder strings.Builder
	builder.WriteString("# 函数文档\n\n")
	builder.WriteString(fmt.Sprintf("语言: %s\n\n", language))
	builder.WriteString(fmt.Sprintf("共 %d 个函数\n\n", len(functions)))
	builder.WriteString("---\n\n")

	for i, fn := range functions {
		builder.WriteString(fmt.Sprintf("## %d. %s\n\n", i+1, fn.Name))
		builder.WriteString(fmt.Sprintf("**签名**\n```%s\n%s\n```\n\n", language, fn.Signature))

		// 参数
		if len(fn.Parameters) > 0 {
			builder.WriteString("**参数**\n\n")
			for _, param := range fn.Parameters {
				builder.WriteString(fmt.Sprintf("- `%s`: %s\n", param.Name, param.Type))
			}
			builder.WriteString("\n")
		}

		// 返回值
		if len(fn.Returns) > 0 {
			builder.WriteString("**返回值**\n\n")
			for _, ret := range fn.Returns {
				builder.WriteString(fmt.Sprintf("- %s\n", ret))
			}
			builder.WriteString("\n")
		}

		builder.WriteString("---\n\n")
	}

	return builder.String(), nil
}

// extractFunctions 从代码中提取函数信息
func (t *DocumentationTool) extractFunctions(code, language string) []FunctionDoc {
	var functions []FunctionDoc

	switch language {
	case "go":
		functions = t.extractGoFunctions(code)
	case "javascript", "typescript":
		functions = t.extractJSFunctions(code)
	case "python":
		functions = t.extractPythonFunctions(code)
	default:
		// 尝试通用提取
		functions = t.extractGenericFunctions(code)
	}

	return functions
}

// extractGoFunctions 提取 Go 函数
func (t *DocumentationTool) extractGoFunctions(code string) []FunctionDoc {
	var functions []FunctionDoc

	// 匹配函数定义: func Name(params) returns { ... }
	funcPattern := regexp.MustCompile(`func\s+(?:\([^)]*\)\s+)?(\w+)\s*\(([^)]*)\)\s*([^\{]*)`)
	matches := funcPattern.FindAllStringSubmatch(code, -1)

	for _, match := range matches {
		if len(match) < 3 {
			continue
		}

		funcName := match[1]
		paramsStr := match[2]
		returnsStr := strings.TrimSpace(match[3])

		// 解析参数
		params := t.parseGoParameters(paramsStr)

		// 解析返回值
		returns := t.parseGoReturns(returnsStr)

		functions = append(functions, FunctionDoc{
			Name:       funcName,
			Signature:  fmt.Sprintf("func %s(%s) %s", funcName, paramsStr, returnsStr),
			Parameters: params,
			Returns:    returns,
			Language:   "go",
		})
	}

	return functions
}

// parseGoParameters 解析 Go 参数
func (t *DocumentationTool) parseGoParameters(paramsStr string) []Parameter {
	var params []Parameter
	if strings.TrimSpace(paramsStr) == "" {
		return params
	}

	// 简单解析：name type, name type
	parts := strings.Split(paramsStr, ",")
	for _, part := range parts {
		part = strings.TrimSpace(part)
		if part == "" {
			continue
		}

		tokens := strings.Fields(part)
		if len(tokens) >= 2 {
			params = append(params, Parameter{
				Name: tokens[0],
				Type: strings.Join(tokens[1:], " "),
			})
		} else if len(tokens) == 1 {
			params = append(params, Parameter{
				Name: tokens[0],
				Type: "unknown",
			})
		}
	}

	return params
}

// parseGoReturns 解析 Go 返回值
func (t *DocumentationTool) parseGoReturns(returnsStr string) []string {
	var returns []string
	returnsStr = strings.TrimSpace(returnsStr)

	if returnsStr == "" {
		return returns
	}

	// 处理命名返回值: (name type, name type)
	if strings.HasPrefix(returnsStr, "(") && strings.HasSuffix(returnsStr, ")") {
		returnsStr = returnsStr[1 : len(returnsStr)-1]
		parts := strings.Split(returnsStr, ",")
		for _, part := range parts {
			part = strings.TrimSpace(part)
			if part != "" {
				returns = append(returns, part)
			}
		}
	} else {
		// 非命名返回值
		returns = append(returns, returnsStr)
	}

	return returns
}

// extractJSFunctions 提取 JavaScript/TypeScript 函数
func (t *DocumentationTool) extractJSFunctions(code string) []FunctionDoc {
	var functions []FunctionDoc

	// 匹配函数定义: function name(params) | const name = (params) => | name(params) {
	patterns := []*regexp.Regexp{
		regexp.MustCompile(`function\s+(\w+)\s*\(([^)]*)\)`),
		regexp.MustCompile(`(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s+)?\(([^)]*)\)\s*=>`),
		regexp.MustCompile(`(?:const|let|var)\s+(\w+)\s*=\s*function\s*\(([^)]*)\)`),
	}

	for _, pattern := range patterns {
		matches := pattern.FindAllStringSubmatch(code, -1)
		for _, match := range matches {
			if len(match) < 3 {
				continue
			}

			funcName := match[1]
			paramsStr := match[2]

			params := t.parseJSParameters(paramsStr)

			functions = append(functions, FunctionDoc{
				Name:       funcName,
				Signature:  fmt.Sprintf("function %s(%s)", funcName, paramsStr),
				Parameters: params,
				Returns:    []string{"根据实现返回"},
				Language:   "javascript",
			})
		}
	}

	return functions
}

// parseJSParameters 解析 JavaScript 参数
func (t *DocumentationTool) parseJSParameters(paramsStr string) []Parameter {
	var params []Parameter
	if strings.TrimSpace(paramsStr) == "" {
		return params
	}

	parts := strings.Split(paramsStr, ",")
	for _, part := range parts {
		part = strings.TrimSpace(part)
		if part == "" {
			continue
		}

		// 解构赋值或默认参数
		if strings.Contains(part, "=") {
			part = strings.Split(part, "=")[0]
			part = strings.TrimSpace(part)
		}

		// TypeScript 类型注解
		if strings.Contains(part, ":") {
			tokens := strings.SplitN(part, ":", 2)
			params = append(params, Parameter{
				Name: strings.TrimSpace(tokens[0]),
				Type: strings.TrimSpace(tokens[1]),
			})
		} else {
			params = append(params, Parameter{
				Name: part,
				Type: "any",
			})
		}
	}

	return params
}

// extractPythonFunctions 提取 Python 函数
func (t *DocumentationTool) extractPythonFunctions(code string) []FunctionDoc {
	var functions []FunctionDoc

	// 匹配函数定义: def name(params):
	funcPattern := regexp.MustCompile(`def\s+(\w+)\s*\(([^)]*)\)`)
	matches := funcPattern.FindAllStringSubmatch(code, -1)

	for _, match := range matches {
		if len(match) < 3 {
			continue
		}

		funcName := match[1]
		paramsStr := match[2]

		params := t.parsePythonParameters(paramsStr)

		functions = append(functions, FunctionDoc{
			Name:       funcName,
			Signature:  fmt.Sprintf("def %s(%s):", funcName, paramsStr),
			Parameters: params,
			Returns:    []string{"根据实现返回"},
			Language:   "python",
		})
	}

	return functions
}

// parsePythonParameters 解析 Python 参数
func (t *DocumentationTool) parsePythonParameters(paramsStr string) []Parameter {
	var params []Parameter
	if strings.TrimSpace(paramsStr) == "" {
		return params
	}

	parts := strings.Split(paramsStr, ",")
	for _, part := range parts {
		part = strings.TrimSpace(part)
		if part == "" || part == "self" || part == "cls" {
			continue
		}

		// 移除默认值
		if strings.Contains(part, "=") {
			part = strings.Split(part, "=")[0]
			part = strings.TrimSpace(part)
		}

		// 类型注解
		if strings.Contains(part, ":") {
			tokens := strings.SplitN(part, ":", 2)
			params = append(params, Parameter{
				Name: strings.TrimSpace(tokens[0]),
				Type: strings.TrimSpace(tokens[1]),
			})
		} else {
			params = append(params, Parameter{
				Name: part,
				Type: "Any",
			})
		}
	}

	return params
}

// extractGenericFunctions 通用函数提取
func (t *DocumentationTool) extractGenericFunctions(code string) []FunctionDoc {
	// 尝试各种模式
	functions := t.extractGoFunctions(code)
	if len(functions) > 0 {
		return functions
	}

	functions = t.extractJSFunctions(code)
	if len(functions) > 0 {
		return functions
	}

	functions = t.extractPythonFunctions(code)
	return functions
}

// detectLanguage 检测代码语言
func (t *DocumentationTool) detectLanguage(code string) string {
	if strings.Contains(code, "package ") && strings.Contains(code, "func ") {
		return "go"
	}
	if strings.Contains(code, "def ") {
		return "python"
	}
	if strings.Contains(code, "function ") || strings.Contains(code, "const ") {
		return "javascript"
	}
	if strings.Contains(code, "import ") && strings.Contains(code, ";") {
		return "javascript"
	}
	return "unknown"
}

// generateReadmeOutline 生成 README 大纲
func (t *DocumentationTool) generateReadmeOutline(args map[string]interface{}) (string, error) {
	// 提取项目信息
	projectName, _ := getStringArg(args, "projectName")
	if projectName == "" {
		projectName = "项目名称"
	}

	description, _ := getStringArg(args, "description")
	if description == "" {
		description = "项目描述"
	}

	language, _ := getStringArg(args, "language")
	if language == "" {
		language = "Go"
	}

	var builder strings.Builder
	builder.WriteString(fmt.Sprintf("# %s\n\n", projectName))
	builder.WriteString(fmt.Sprintf("%s\n\n", description))
	builder.WriteString("---\n\n")

	builder.WriteString("## 目录\n\n")
	builder.WriteString("- [功能特性](#功能特性)\n")
	builder.WriteString("- [安装说明](#安装说明)\n")
	builder.WriteString("- [快速开始](#快速开始)\n")
	builder.WriteString("- [API 文档](#api-文档)\n")
	builder.WriteString("- [项目结构](#项目结构)\n")
	builder.WriteString("- [贡献指南](#贡献指南)\n")
	builder.WriteString("- [许可证](#许可证)\n\n")

	builder.WriteString("## 功能特性\n\n")
	builder.WriteString("- [ ] 特性 1\n")
	builder.WriteString("- [ ] 特性 2\n")
	builder.WriteString("- [ ] 特性 3\n\n")

	builder.WriteString("## 安装说明\n\n")
	builder.WriteString("### 环境要求\n\n")
	builder.WriteString(fmt.Sprintf("- %s 1.21+\n", language))
	builder.WriteString("- 其他依赖...\n\n")

	builder.WriteString("### 安装步骤\n\n")
	builder.WriteString("```bash\n")
	builder.WriteString("# 克隆仓库\n")
	builder.WriteString(fmt.Sprintf("git clone https://github.com/username/%s.git\n", strings.ToLower(strings.ReplaceAll(projectName, " ", "-"))))
	builder.WriteString(fmt.Sprintf("cd %s\n", strings.ToLower(strings.ReplaceAll(projectName, " ", "-"))))
	builder.WriteString("\n")
	builder.WriteString("# 安装依赖\n")
	builder.WriteString("go mod download\n")
	builder.WriteString("\n")
	builder.WriteString("# 运行项目\n")
	builder.WriteString("go run main.go\n")
	builder.WriteString("```\n\n")

	builder.WriteString("## 快速开始\n\n")
	builder.WriteString("```go\n")
	builder.WriteString("package main\n\n")
	builder.WriteString("import (\n")
	builder.WriteString(fmt.Sprintf(`    "%s"`, strings.ToLower(strings.ReplaceAll(projectName, " ", ""))))
	builder.WriteString("\n)\n\n")
	builder.WriteString("func main() {\n")
	builder.WriteString("    // 使用示例\n")
	builder.WriteString("}\n")
	builder.WriteString("```\n\n")

	builder.WriteString("## API 文档\n\n")
	builder.WriteString("详细的 API 文档请参见 [docs/api.md](docs/api.md)\n\n")

	builder.WriteString("## 项目结构\n\n")
	builder.WriteString("```\n")
	builder.WriteString(".\n")
	builder.WriteString("├── cmd/              # 入口文件\n")
	builder.WriteString("├── pkg/              # 公共包\n")
	builder.WriteString("├── internal/         # 内部包\n")
	builder.WriteString("├── docs/             # 文档\n")
	builder.WriteString("├── go.mod            # Go 模块定义\n")
	builder.WriteString("└── README.md         # 项目说明\n")
	builder.WriteString("```\n\n")

	builder.WriteString("## 贡献指南\n\n")
	builder.WriteString("1. Fork 本仓库\n")
	builder.WriteString("2. 创建特性分支 (`git checkout -b feature/amazing-feature`)\n")
	builder.WriteString("3. 提交更改 (`git commit -m 'Add amazing feature'`)\n")
	builder.WriteString("4. 推送分支 (`git push origin feature/amazing-feature`)\n")
	builder.WriteString("5. 创建 Pull Request\n\n")

	builder.WriteString("## 许可证\n\n")
	builder.WriteString("本项目采用 MIT 许可证 - 详见 [LICENSE](LICENSE) 文件\n")

	return builder.String(), nil
}

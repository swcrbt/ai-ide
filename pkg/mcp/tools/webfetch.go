package tools

import (
	"fmt"
	"io"
	"net/http"
	"regexp"
	"strings"
	"time"
)

// WebFetchTool 网页内容获取工具
// 获取网页内容并转换为 Markdown 格式
type WebFetchTool struct {
	// httpClient HTTP 客户端
	httpClient *http.Client
}

// NewWebFetchTool 创建新的 WebFetch 工具实例
func NewWebFetchTool() *WebFetchTool {
	return &WebFetchTool{
		httpClient: &http.Client{
			Timeout: 30 * time.Second,
		},
	}
}

// Name 返回工具名称
func (t *WebFetchTool) Name() string {
	return "webfetch"
}

// Description 返回工具描述
func (t *WebFetchTool) Description() string {
	return "网页内容获取工具，获取指定 URL 的网页内容并转换为 Markdown 格式，支持限制内容长度"
}

// Execute 获取网页内容并转换为 Markdown
// 参数:
//   - url (string): 目标网页 URL（必需）
//   - maxLength (int): 最大内容长度，默认 5000 字符
//
// 返回转换后的 Markdown 内容
func (t *WebFetchTool) Execute(args map[string]interface{}) (string, error) {
	// 提取 URL 参数
	url, ok := getStringArg(args, "url")
	if !ok || url == "" {
		return "", fmt.Errorf("缺少必需参数 'url'")
	}

	// 确保 URL 有协议前缀
	if !strings.HasPrefix(url, "http://") && !strings.HasPrefix(url, "https://") {
		url = "https://" + url
	}

	// 提取最大长度
	maxLength := 5000
	if val, ok := args["maxLength"]; ok {
		switch v := val.(type) {
		case int:
			maxLength = v
		case float64:
			maxLength = int(v)
		case string:
			fmt.Sscanf(v, "%d", &maxLength)
		}
	}

	return t.fetchAndConvert(url, maxLength)
}

// fetchAndConvert 获取网页并转换为 Markdown
func (t *WebFetchTool) fetchAndConvert(url string, maxLength int) (string, error) {
	// 发送 HTTP GET 请求
	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return "", fmt.Errorf("创建请求失败: %w", err)
	}

	// 设置请求头，模拟浏览器
	req.Header.Set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
	req.Header.Set("Accept", "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8")
	req.Header.Set("Accept-Language", "zh-CN,zh;q=0.9,en;q=0.8")

	resp, err := t.httpClient.Do(req)
	if err != nil {
		return "", fmt.Errorf("请求失败: %w", err)
	}
	defer resp.Body.Close()

	// 检查响应状态码
	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("HTTP 错误: status=%d", resp.StatusCode)
	}

	// 读取响应体
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", fmt.Errorf("读取响应失败: %w", err)
	}

	// 转换 HTML 为 Markdown
	markdown := htmlToMarkdown(string(body))

	// 限制内容长度
	markdown = limitLength(markdown, maxLength)

	return markdown, nil
}

// htmlToMarkdown 将 HTML 内容转换为 Markdown
// 这是一个简单的转换实现，支持常见的 HTML 元素
func htmlToMarkdown(html string) string {
	// 移除 script 和 style 标签及其内容
	html = removeTag(html, "script")
	html = removeTag(html, "style")
	html = removeTag(html, "nav")
	html = removeTag(html, "footer")
	html = removeTag(html, "header")

	var md strings.Builder

	// 提取 title
	title := extractTagContent(html, "title")
	if title != "" {
		md.WriteString("# ")
		md.WriteString(stripHTMLTags(title))
		md.WriteString("\n\n")
	}

	// 转换标题
	html = convertHeaders(html, &md)

	// 转换段落和文本
	html = convertParagraphs(html, &md)

	// 转换链接
	html = convertLinks(html, &md)

	// 转换代码块
	html = convertCodeBlocks(html, &md)

	// 转换列表
	html = convertLists(html, &md)

	// 如果以上转换没有产生内容，尝试提取所有文本
	if md.Len() == 0 {
		text := stripHTMLTags(html)
		text = cleanWhitespace(text)
		md.WriteString(text)
	}

	result := md.String()
	result = cleanWhitespace(result)

	return result
}

// removeTag 移除指定 HTML 标签及其内容
func removeTag(html, tag string) string {
	// 匹配 <tag>...</tag>（支持属性）
	pattern := fmt.Sprintf(`(?i)<%s[^>]*>[\s\S]*?</%s>`, tag, tag)
	re := regexp.MustCompile(pattern)
	return re.ReplaceAllString(html, "")
}

// extractTagContent 提取指定标签的内容
func extractTagContent(html, tag string) string {
	pattern := fmt.Sprintf(`(?i)<%s[^>]*>(.*?)</%s>`, tag, tag)
	re := regexp.MustCompile(pattern)
	matches := re.FindStringSubmatch(html)
	if len(matches) >= 2 {
		return matches[1]
	}
	return ""
}

// convertHeaders 转换 HTML 标题为 Markdown
func convertHeaders(html string, md *strings.Builder) string {
	// h1-h6 转换
	for i := 1; i <= 6; i++ {
		tag := fmt.Sprintf("h%d", i)
		prefix := strings.Repeat("#", i) + " "

		pattern := fmt.Sprintf(`(?i)<%s[^>]*>(.*?)</%s>`, tag, tag)
		re := regexp.MustCompile(pattern)

		html = re.ReplaceAllStringFunc(html, func(match string) string {
			content := stripHTMLTags(match)
			content = strings.TrimSpace(content)
			if content != "" {
				md.WriteString(prefix + content + "\n\n")
			}
			return ""
		})
	}

	return html
}

// convertParagraphs 转换 HTML 段落为 Markdown
func convertParagraphs(html string, md *strings.Builder) string {
	// p 标签转换
	re := regexp.MustCompile(`(?i)<p[^>]*>(.*?)</p>`)

	html = re.ReplaceAllStringFunc(html, func(match string) string {
		content := stripHTMLTags(match)
		content = strings.TrimSpace(content)
		if content != "" {
			md.WriteString(content + "\n\n")
		}
		return ""
	})

	// div 标签转换（如果包含文本内容）
	divRe := regexp.MustCompile(`(?i)<div[^>]*>(.*?)</div>`)
	html = divRe.ReplaceAllStringFunc(html, func(match string) string {
		content := stripHTMLTags(match)
		content = strings.TrimSpace(content)
		if content != "" && len(content) > 20 {
			md.WriteString(content + "\n\n")
		}
		return ""
	})

	return html
}

// convertLinks 转换 HTML 链接为 Markdown
func convertLinks(html string, md *strings.Builder) string {
	// a 标签转换
	re := regexp.MustCompile(`(?i)<a\s+[^>]*href=["']([^"']+)["'][^>]*>(.*?)</a>`)

	html = re.ReplaceAllStringFunc(html, func(match string) string {
		matches := re.FindStringSubmatch(match)
		if len(matches) >= 3 {
			href := matches[1]
			text := stripHTMLTags(matches[2])
			text = strings.TrimSpace(text)
			if text != "" && href != "" {
				return fmt.Sprintf("[%s](%s)", text, href)
			}
		}
		return match
	})

	return html
}

// convertCodeBlocks 转换 HTML 代码块为 Markdown
func convertCodeBlocks(html string, md *strings.Builder) string {
	// pre + code 代码块
	preCodeRe := regexp.MustCompile(`(?i)<pre[^>]*>\s*<code[^>]*>(.*?)</code>\s*</pre>`)
	html = preCodeRe.ReplaceAllStringFunc(html, func(match string) string {
		matches := preCodeRe.FindStringSubmatch(match)
		if len(matches) >= 2 {
			code := cleanCodeContent(matches[1])
			return "```\n" + code + "\n```\n\n"
		}
		return match
	})

	// 单独的 code 标签（行内代码）
	codeRe := regexp.MustCompile(`(?i)<code[^>]*>(.*?)</code>`)
	html = codeRe.ReplaceAllStringFunc(html, func(match string) string {
		matches := codeRe.FindStringSubmatch(match)
		if len(matches) >= 2 {
			code := cleanCodeContent(matches[1])
			return "`" + code + "`"
		}
		return match
	})

	// pre 标签（代码块）
	preRe := regexp.MustCompile(`(?i)<pre[^>]*>(.*?)</pre>`)
	html = preRe.ReplaceAllStringFunc(html, func(match string) string {
		matches := preRe.FindStringSubmatch(match)
		if len(matches) >= 2 {
			code := cleanCodeContent(matches[1])
			return "```\n" + code + "\n```\n\n"
		}
		return match
	})

	return html
}

// convertLists 转换 HTML 列表为 Markdown
func convertLists(html string, md *strings.Builder) string {
	// ul + li 无序列表
	ulRe := regexp.MustCompile(`(?i)<ul[^>]*>(.*?)</ul>`)
	html = ulRe.ReplaceAllStringFunc(html, func(match string) string {
		matches := ulRe.FindStringSubmatch(match)
		if len(matches) >= 2 {
			items := extractListItems(matches[1])
			var listStr strings.Builder
			for _, item := range items {
				listStr.WriteString("- " + item + "\n")
			}
			return listStr.String() + "\n"
		}
		return match
	})

	// ol + li 有序列表
	olRe := regexp.MustCompile(`(?i)<ol[^>]*>(.*?)</ol>`)
	html = olRe.ReplaceAllStringFunc(html, func(match string) string {
		matches := olRe.FindStringSubmatch(match)
		if len(matches) >= 2 {
			items := extractListItems(matches[1])
			var listStr strings.Builder
			for i, item := range items {
				listStr.WriteString(fmt.Sprintf("%d. %s\n", i+1, item))
			}
			return listStr.String() + "\n"
		}
		return match
	})

	return html
}

// extractListItems 提取列表项内容
func extractListItems(html string) []string {
	var items []string
	liRe := regexp.MustCompile(`(?i)<li[^>]*>(.*?)</li>`)

	matches := liRe.FindAllStringSubmatch(html, -1)
	for _, match := range matches {
		if len(match) >= 2 {
			item := stripHTMLTags(match[1])
			item = strings.TrimSpace(item)
			if item != "" {
				items = append(items, item)
			}
		}
	}

	return items
}

// stripHTMLTags 移除所有 HTML 标签
func stripHTMLTags(html string) string {
	// 移除 HTML 标签
	re := regexp.MustCompile(`<[^>]+>`)
	text := re.ReplaceAllString(html, "")

	// 解码常见的 HTML 实体
	text = strings.ReplaceAll(text, "&lt;", "<")
	text = strings.ReplaceAll(text, "&gt;", ">")
	text = strings.ReplaceAll(text, "&amp;", "&")
	text = strings.ReplaceAll(text, "&quot;", "\"")
	text = strings.ReplaceAll(text, "&#39;", "'")
	text = strings.ReplaceAll(text, "&nbsp;", " ")
	text = strings.ReplaceAll(text, "&ndash;", "–")
	text = strings.ReplaceAll(text, "&mdash;", "—")
	text = strings.ReplaceAll(text, "&hellip;", "…")

	return text
}

// cleanCodeContent 清理代码内容
func cleanCodeContent(code string) string {
	// 移除 HTML 标签
	code = stripHTMLTags(code)
	// 解码 HTML 实体
	code = strings.ReplaceAll(code, "&lt;", "<")
	code = strings.ReplaceAll(code, "&gt;", ">")
	code = strings.ReplaceAll(code, "&amp;", "&")
	return code
}

// cleanWhitespace 清理多余的空白字符
func cleanWhitespace(text string) string {
	// 移除多余的空行
	re := regexp.MustCompile(`\n{3,}`)
	text = re.ReplaceAllString(text, "\n\n")

	// 移除行首行尾空白
	lines := strings.Split(text, "\n")
	var result strings.Builder
	for _, line := range lines {
		line = strings.TrimSpace(line)
		if line != "" {
			result.WriteString(line + "\n")
		} else {
			result.WriteString("\n")
		}
	}

	return strings.TrimSpace(result.String())
}

// limitLength 限制内容长度
// 如果超过限制，截断并添加提示信息
func limitLength(content string, maxLength int) string {
	if len(content) <= maxLength {
		return content
	}

	// 在完整单词处截断
	truncated := content[:maxLength]
	lastSpace := strings.LastIndex(truncated, " ")
	lastNewline := strings.LastIndex(truncated, "\n")

	cutPoint := maxLength
	if lastNewline > maxLength/2 {
		cutPoint = lastNewline
	} else if lastSpace > maxLength/2 {
		cutPoint = lastSpace
	}

	return content[:cutPoint] + fmt.Sprintf("\n\n... [内容已截断，共 %d 字符，显示前 %d 字符] ...", len(content), cutPoint)
}

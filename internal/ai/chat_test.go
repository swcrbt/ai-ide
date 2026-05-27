package ai

import (
	"context"
	"strings"
	"testing"
)

func TestGenerateTitleLocal(t *testing.T) {
	tests := []struct {
		name     string
		content  string
		expected string
	}{
		{
			name:     "short single line",
			content:  "修复登录页面的样式问题",
			expected: "修复登录页面的样式问题",
		},
		{
			name:     "multi-line content uses first line",
			content:  "添加用户注册功能\n需要包含邮箱验证\n密码强度检查",
			expected: "添加用户注册功能",
		},
		{
			name:     "long content truncated to 30 chars",
			content:  "这是一个非常长的任务内容描述，它超过了三十个字符的限制，应该被截断",
			expected: "这是一个非常长的任务内容描述，它超过了三十个字符的限制，应该...",
		},
		{
			name:     "empty content returns default",
			content:  "",
			expected: "新任务",
		},
		{
			name:     "whitespace-only first line falls through",
			content:  "   \n实际内容在第二行",
			expected: "新任务",
		},
		{
			name:     "content with leading spaces trimmed",
			content:  "   添加缓存功能   ",
			expected: "添加缓存功能",
		},
		{
			name:     "long English content",
			content:  "Implement user authentication with OAuth2 and JWT tokens for secure API access",
			expected: "Implement user authentication ...",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := GenerateTitleLocal(tt.content)
			if result != tt.expected {
				t.Errorf("GenerateTitleLocal(%q) = %q, want %q", tt.content, result, tt.expected)
			}
		})
	}
}

func TestGenerateTitleLocalRuneTruncation(t *testing.T) {
	// Verify truncation operates on runes (not bytes) for CJK characters
	content := strings.Repeat("中", 40) // 40 CJK chars = 120 bytes
	result := GenerateTitleLocal(content)
	runes := []rune(result)
	// 30 CJK chars + "..." suffix = 33 runes total
	if len(runes) != 33 {
		t.Errorf("result has %d runes, expected 33: %q", len(runes), result)
	}
	if !strings.HasSuffix(result, "...") {
		t.Errorf("long content should end with '...', got: %q", result)
	}
}

func TestChatHistoryManagerGenerateTitleNoProvider(t *testing.T) {
	// When no provider is available, GenerateTitle should fall back to local heuristic
	pm := NewProviderManager()
	// All providers disabled by default (no API keys set in test env)
	hm := NewChatHistoryManager(pm)

	content := "重构数据库查询层，优化慢查询"
	result := hm.GenerateTitle(context.Background(), content)
	expected := GenerateTitleLocal(content)
	if result != expected {
		t.Errorf("GenerateTitle with no provider = %q, want local fallback %q", result, expected)
	}
}

func TestChatHistoryManagerGenerateTitleEmptyContent(t *testing.T) {
	pm := NewProviderManager()
	hm := NewChatHistoryManager(pm)

	result := hm.GenerateTitle(context.Background(), "")
	if result != "新任务" {
		t.Errorf("GenerateTitle(empty) = %q, want '新任务'", result)
	}
}
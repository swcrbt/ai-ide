package ai

import (
	"fmt"
	"os"
	"sort"
	"sync"
)

// 国产 Provider 默认优先级（数字越小优先级越高）
// 策略：Kimi → GLM → DeepSeek → Anthropic → OpenAI → Ollama
var defaultDomesticPriority = map[Provider]int{
	ProviderKimi:     1,
	ProviderGLM:      2,
	ProviderDeepSeek: 3,
	ProviderAnthropic: 4,
	ProviderOpenAI:   5,
	ProviderOllama:   6,
}

// 默认 Provider 基础地址
var defaultBaseURLs = map[Provider]string{
	ProviderKimi:     "https://api.moonshot.cn/v1",
	ProviderGLM:      "https://open.bigmodel.cn/api/paas/v4",
	ProviderDeepSeek: "https://api.deepseek.com/v1",
	ProviderAnthropic: "https://api.anthropic.com/v1",
	ProviderOpenAI:   "https://api.openai.com/v1",
	ProviderOllama:   "http://localhost:11434/v1",
}

// 默认模型名称
var defaultModels = map[Provider]string{
	ProviderKimi:     "moonshot-v1-8k",
	ProviderGLM:      "glm-4",
	ProviderDeepSeek: "deepseek-chat",
	ProviderAnthropic: "claude-3-sonnet-20240229",
	ProviderOpenAI:   "gpt-4o-mini",
	ProviderOllama:   "llama3",
}

// 环境变量名映射
var envVarNames = map[Provider]string{
	ProviderKimi:     "KIMI_API_KEY",
	ProviderGLM:      "GLM_API_KEY",
	ProviderDeepSeek: "DEEPSEEK_API_KEY",
	ProviderAnthropic: "ANTHROPIC_API_KEY",
	ProviderOpenAI:   "OPENAI_API_KEY",
	ProviderOllama:   "OLLAMA_API_KEY",
}

// ProviderManager Provider 管理器
type ProviderManager struct {
	mu       sync.RWMutex
	configs  map[Provider]*ProviderConfig
	// domesticFirst 是否启用国产优先策略
	domesticFirst bool
}

// NewProviderManager 创建新的 Provider 管理器
func NewProviderManager() *ProviderManager {
	pm := &ProviderManager{
		configs:       make(map[Provider]*ProviderConfig),
		domesticFirst: true,
	}
	pm.loadDefaults()
	return pm
}

// loadDefaults 加载默认配置（从环境变量读取 API Key）
func (pm *ProviderManager) loadDefaults() {
	for provider := ProviderKimi; provider <= ProviderOllama; provider++ {
		config := &ProviderConfig{
			Provider: provider,
			BaseURL:  defaultBaseURLs[provider],
			Model:    defaultModels[provider],
			Enabled:  false,
			Priority: defaultDomesticPriority[provider],
		}

		// 尝试从环境变量读取 API Key
		if envName, ok := envVarNames[provider]; ok {
			if apiKey := os.Getenv(envName); apiKey != "" {
				config.APIKey = apiKey
				config.Enabled = true
			}
		}

		pm.configs[provider] = config
	}
}

// SetConfig 设置指定 Provider 的配置
func (pm *ProviderManager) SetConfig(config ProviderConfig) error {
	pm.mu.Lock()
	defer pm.mu.Unlock()

	if config.Provider < ProviderKimi || config.Provider > ProviderOllama {
		return fmt.Errorf("无效的 Provider 类型: %v", config.Provider)
	}

	// 如果未指定 BaseURL，使用默认值
	if config.BaseURL == "" {
		config.BaseURL = defaultBaseURLs[config.Provider]
	}

	// 如果未指定模型，使用默认值
	if config.Model == "" {
		config.Model = defaultModels[config.Provider]
	}

	// 如果启用了但没有 API Key，尝试从环境变量读取
	if config.Enabled && config.APIKey == "" {
		if envName, ok := envVarNames[config.Provider]; ok {
			config.APIKey = os.Getenv(envName)
		}
	}

	// 如果仍然没有 API Key（Ollama 除外），则标记为未启用
	if config.Enabled && config.APIKey == "" && config.Provider != ProviderOllama {
		config.Enabled = false
	}

	pm.configs[config.Provider] = &config
	return nil
}

// GetConfig 获取指定 Provider 的配置
func (pm *ProviderManager) GetConfig(provider Provider) (*ProviderConfig, bool) {
	pm.mu.RLock()
	defer pm.mu.RUnlock()

	config, ok := pm.configs[provider]
	if !ok {
		return nil, false
	}
	// 返回副本以避免外部修改
	copy := *config
	return &copy, true
}

// GetEnabledProviders 获取所有已启用的 Provider 列表
func (pm *ProviderManager) GetEnabledProviders() []*ProviderConfig {
	pm.mu.RLock()
	defer pm.mu.RUnlock()

	var enabled []*ProviderConfig
	for _, config := range pm.configs {
		if config.Enabled {
			copy := *config
			enabled = append(enabled, &copy)
		}
	}

	return enabled
}

// GetBestProvider 根据策略获取最佳可用 Provider
// 国产优先策略：按优先级排序，返回第一个启用的 Provider
func (pm *ProviderManager) GetBestProvider() (*ProviderConfig, error) {
	pm.mu.RLock()
	defer pm.mu.RUnlock()

	var candidates []*ProviderConfig
	for _, config := range pm.configs {
		if config.Enabled {
			copy := *config
			candidates = append(candidates, &copy)
		}
	}

	if len(candidates) == 0 {
		return nil, fmt.Errorf("没有可用的 Provider，请先配置 API Key")
	}

	// 按优先级排序（数字越小优先级越高）
	sort.Slice(candidates, func(i, j int) bool {
		return candidates[i].Priority < candidates[j].Priority
	})

	return candidates[0], nil
}

// SetDomesticFirst 设置是否启用国产优先策略
func (pm *ProviderManager) SetDomesticFirst(enabled bool) {
	pm.mu.Lock()
	defer pm.mu.Unlock()
	pm.domesticFirst = enabled
}

// IsDomesticFirst 是否启用国产优先策略
func (pm *ProviderManager) IsDomesticFirst() bool {
	pm.mu.RLock()
	defer pm.mu.RUnlock()
	return pm.domesticFirst
}

// GetAllProviders 获取所有 Provider 配置（包括未启用的）
func (pm *ProviderManager) GetAllProviders() []*ProviderConfig {
	pm.mu.RLock()
	defer pm.mu.RUnlock()

	var all []*ProviderConfig
	for _, config := range pm.configs {
		copy := *config
		all = append(all, &copy)
	}

	// 按优先级排序
	sort.Slice(all, func(i, j int) bool {
		return all[i].Priority < all[j].Priority
	})

	return all
}

// ValidateConfig 验证配置是否有效
func (pm *ProviderManager) ValidateConfig(provider Provider) error {
	pm.mu.RLock()
	defer pm.mu.RUnlock()

	config, ok := pm.configs[provider]
	if !ok {
		return fmt.Errorf("Provider %s 未配置", provider.String())
	}

	if !config.Enabled {
		return fmt.Errorf("Provider %s 未启用", provider.String())
	}

	if config.APIKey == "" && provider != ProviderOllama {
		return fmt.Errorf("Provider %s 的 API Key 为空", provider.String())
	}

	if config.BaseURL == "" {
		return fmt.Errorf("Provider %s 的 BaseURL 为空", provider.String())
	}

	if config.Model == "" {
		return fmt.Errorf("Provider %s 的 Model 为空", provider.String())
	}

	return nil
}

// RemoveConfig 移除指定 Provider 的配置
func (pm *ProviderManager) RemoveConfig(provider Provider) {
	pm.mu.Lock()
	defer pm.mu.Unlock()

	if config, ok := pm.configs[provider]; ok {
		config.Enabled = false
		config.APIKey = ""
	}
}

// ResetToDefaults 重置所有配置为默认值
func (pm *ProviderManager) ResetToDefaults() {
	pm.mu.Lock()
	defer pm.mu.Unlock()

	pm.configs = make(map[Provider]*ProviderConfig)
	pm.loadDefaults()
}

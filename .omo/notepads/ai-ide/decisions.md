# AI IDE 决策记录

## 架构决策

### ADR-001: 使用Wails v2而非Tauri
**日期**: 2026-05-23
**决策**: 选择Wails v2作为桌面框架
**理由**:
- Go生态更成熟，并发处理更优
- 与cc-haha的Tauri方案形成差异化
- 单二进制文件部署更简单

### ADR-002: 使用monaco-languageclient连接LSP
**日期**: 2026-05-23
**决策**: 使用monaco-languageclient连接Monaco和Go LSP客户端
**理由**:
- 社区成熟方案
- 减少自研工作量
- 支持完整LSP协议

### ADR-003: AI Provider优先策略
**日期**: 2026-05-23
**决策**: 国产Provider优先（Kimi→GLM→DeepSeek→Anthropic→OpenAI→Ollama）
**理由**:
- 符合用户偏好
- 国内API访问更稳定
- Ollama作为本地fallback


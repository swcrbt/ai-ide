# Superpowers AI 纪律 / AI Discipline

> 本项目强制要求所有 AI 代理严格遵循 superpowers 插件的工作流程。

## 核心原则

1. **技能优先**：遇到任何任务，首先思考应该使用哪个 superpowers 技能
2. **不跳步**：严禁跳过规定的步骤，哪怕任务看起来"很简单"
3. **验证闭环**：每个任务完成后必须经过验证才能标记完成

## 强制技能映射

| 场景 | 必须使用技能 |
|------|------------|
| 实现任何功能或修复 bug | `/superpowers:test-driven-development` |
| 遇到 bug、测试失败或意外行为 | `/superpowers:systematic-debugging` |
| 创意工作、创建功能、添加功能、修改行为 | `/superpowers:brainstorming` |
| 多步骤任务（2+ 步骤） | `/superpowers:writing-plans` |
| 有书面实施计划需要执行 | `/superpowers:executing-plans` |
| 2+ 个独立任务可并行处理 | `/superpowers:dispatching-parallel-agents` |
| 实施计划中包含独立任务 | `/superpowers:subagent-driven-development` |
| 完成工作、实现主要功能、合并前 | `/superpowers:verification-before-completion` |
| 完成开发工作（测试通过、准备合并） | `/superpowers:finishing-a-development-branch` |
| 完成任务、实现主要功能、合并前 | `/superpowers:requesting-code-review` |
| 收到代码审查反馈 | `/superpowers:receiving-code-review` |
| 创建或编辑技能 | `/superpowers:writing-skills` |
| 不确定如何使用 superpowers | `/superpowers:using-superpowers` |

## 禁止行为

- ❌ 不经过 TDD 直接写实现代码
- ❌ 不经过头脑风暴直接开始创意工作
- ❌ 不验证就声称任务完成
- ❌ 遇到 bug 不系统调试就盲目修改
- ❌ 跳过计划步骤直接执行多步骤任务

## 工作流程检查清单

每个任务开始前必须回答：

1. [ ] 这个任务需要哪个 superpowers 技能？
2. [ ] 如果涉及多个独立工作，能否并行处理？
3. [ ] 是否已有书面计划？如果没有，是否需要先写计划？
4. [ ] 完成前需要哪些验证步骤？
5. [ ] 完成后是否需要代码审查？

## 项目特定规则

### 前端开发
- 所有 React 组件必须先写测试再实现
- 状态管理变更必须经过 Zustand store 测试
- UI 变更必须通过 visual-engineering 类别代理处理

### 后端开发
- Go 接口变更必须同步更新 mocks
- 数据库变更必须包含迁移脚本
- API 变更必须更新 OpenAPI 文档

### Git 工作流
- 每个功能分支必须关联一个计划文件（`.sisyphus/plans/*.md`）
- 提交前必须通过 Momus 计划审查
- 合并前必须通过 verification-before-completion 验证

## 违规后果

如果 AI 代理未遵循上述纪律：
1. 立即停止当前工作
2. 回滚未经验证的更改
3. 重新使用正确的 superpowers 技能执行

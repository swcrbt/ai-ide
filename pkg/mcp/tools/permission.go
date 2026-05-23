package tools

import (
	"fmt"
	"strings"
)

// RiskLevel 风险等级类型
type RiskLevel string

const (
	// RiskLow 低风险
	RiskLow RiskLevel = "low"
	// RiskMedium 中风险
	RiskMedium RiskLevel = "medium"
	// RiskHigh 高风险
	RiskHigh RiskLevel = "high"
	// RiskCritical 严重风险
	RiskCritical RiskLevel = "critical"
)

// PermissionGuardTool 权限守卫工具
// 用于评估和拦截危险操作，返回审批请求信息
type PermissionGuardTool struct{}

// NewPermissionGuardTool 创建新的权限守卫工具实例
func NewPermissionGuardTool() *PermissionGuardTool {
	return &PermissionGuardTool{}
}

// Name 返回工具名称
func (t *PermissionGuardTool) Name() string {
	return "permission_guard"
}

// Description 返回工具描述
func (t *PermissionGuardTool) Description() string {
	return "权限守卫工具，评估操作风险等级，对危险操作（如删除文件、执行命令、修改配置等）进行拦截，返回需要用户确认的审批请求信息"
}

// Execute 评估操作风险并返回审批请求
// 参数:
//   - operation (string): 操作类型（必需）
//   - details (string): 操作详情描述
//   - riskLevel (string): 预设风险等级（low/medium/high/critical）
//
// 返回审批请求信息，不直接执行操作
func (t *PermissionGuardTool) Execute(args map[string]interface{}) (string, error) {
	// 提取参数
	operation, ok := getStringArg(args, "operation")
	if !ok || operation == "" {
		return "", fmt.Errorf("缺少必需参数 'operation'")
	}

	details, _ := getStringArg(args, "details")
	if details == "" {
		details = "未提供详细信息"
	}

	riskLevelStr, _ := getStringArg(args, "riskLevel")

	// 评估风险等级
	var riskLevel RiskLevel
	if riskLevelStr != "" {
		riskLevel = RiskLevel(riskLevelStr)
	} else {
		riskLevel = t.assessRisk(operation, details)
	}

	// 生成审批请求
	return t.generateApprovalRequest(operation, details, riskLevel), nil
}

// assessRisk 根据操作类型评估风险等级
func (t *PermissionGuardTool) assessRisk(operation, details string) RiskLevel {
	operationLower := strings.ToLower(operation)
	detailsLower := strings.ToLower(details)

	// 严重风险操作
	criticalOperations := []string{
		"delete", "remove", "rm", "drop",
		"format", "wipe", "destroy",
		"exec", "execute", "run",
		"sudo", "chmod", "chown",
	}

	for _, op := range criticalOperations {
		if strings.Contains(operationLower, op) {
			// 进一步判断是否为系统级危险操作
			if isSystemCriticalOperation(operationLower, detailsLower) {
				return RiskCritical
			}
			return RiskHigh
		}
	}

	// 高风险操作
	highRiskOperations := []string{
		"write", "modify", "update", "edit",
		"create", "mkdir", "touch",
		"install", "uninstall",
		"push", "deploy",
		"migrate", "alter",
	}

	for _, op := range highRiskOperations {
		if strings.Contains(operationLower, op) {
			return RiskHigh
		}
	}

	// 中风险操作
	mediumRiskOperations := []string{
		"copy", "move", "rename",
		"backup", "restore",
		"config", "setting",
		"restart", "stop", "kill",
	}

	for _, op := range mediumRiskOperations {
		if strings.Contains(operationLower, op) {
			return RiskMedium
		}
	}

	// 检查详细信息中的关键词
	if containsCriticalKeywords(detailsLower) {
		return RiskCritical
	}

	if containsHighRiskKeywords(detailsLower) {
		return RiskHigh
	}

	// 默认为低风险
	return RiskLow
}

// isSystemCriticalOperation 判断是否为系统级严重操作
func isSystemCriticalOperation(operation, details string) bool {
	criticalPatterns := []string{
		"rm -rf", "rm -r /", "rm -rf /",
		"format c:", "format /",
		"dd if=", "of=/dev",
		"mkfs", "fdisk",
		"> /dev/null", "> /dev/sda",
		"sudo rm", "sudo dd",
		"del /f /s /q",
		"rmdir /s /q",
	}

	fullStr := operation + " " + details
	for _, pattern := range criticalPatterns {
		if strings.Contains(fullStr, pattern) {
			return true
		}
	}

	return false
}

// containsCriticalKeywords 检查是否包含严重风险关键词
func containsCriticalKeywords(details string) bool {
	keywords := []string{
		"system", "系统",
		"root", "管理员",
		"production", "生产环境",
		"database", "数据库",
		"password", "密码",
		"credential", "凭证",
		"secret", "密钥",
		"token", "令牌",
	}

	for _, keyword := range keywords {
		if strings.Contains(details, keyword) {
			return true
		}
	}

	return false
}

// containsHighRiskKeywords 检查是否包含高风险关键词
func containsHighRiskKeywords(details string) bool {
	keywords := []string{
		"server", "服务器",
		"service", "服务",
		"network", "网络",
		"firewall", "防火墙",
		"permission", "权限",
		"user", "用户",
	}

	for _, keyword := range keywords {
		if strings.Contains(details, keyword) {
			return true
		}
	}

	return false
}

// generateApprovalRequest 生成审批请求信息
func (t *PermissionGuardTool) generateApprovalRequest(operation, details string, riskLevel RiskLevel) string {
	var builder strings.Builder

	// 标题
	builder.WriteString("⚠️ 权限审批请求\n")
	builder.WriteString(strings.Repeat("=", 40) + "\n\n")

	// 操作信息
	builder.WriteString(fmt.Sprintf("操作类型: %s\n", operation))
	builder.WriteString(fmt.Sprintf("操作详情: %s\n", details))
	builder.WriteString(fmt.Sprintf("风险等级: %s\n\n", t.formatRiskLevel(riskLevel)))

	// 风险说明
	builder.WriteString("风险说明:\n")
	builder.WriteString(t.getRiskDescription(riskLevel))
	builder.WriteString("\n\n")

	// 审批要求
	switch riskLevel {
	case RiskCritical:
		builder.WriteString("⚠️ 此操作被标记为【严重风险】\n")
		builder.WriteString("需要管理员级别的审批才能执行。\n")
		builder.WriteString("请仔细确认此操作的必要性和安全性。\n\n")
		builder.WriteString("建议操作:\n")
		builder.WriteString("1. 确认操作来源可信\n")
		builder.WriteString("2. 备份重要数据\n")
		builder.WriteString("3. 在测试环境先行验证\n")
		builder.WriteString("4. 记录操作日志\n")

	case RiskHigh:
		builder.WriteString("⚠️ 此操作被标记为【高风险】\n")
		builder.WriteString("需要用户明确确认才能执行。\n\n")
		builder.WriteString("建议操作:\n")
		builder.WriteString("1. 确认操作不会影响系统稳定性\n")
		builder.WriteString("2. 备份相关数据\n")
		builder.WriteString("3. 了解操作的回滚方式\n")

	case RiskMedium:
		builder.WriteString("⚠️ 此操作被标记为【中风险】\n")
		builder.WriteString("建议在执行前进行确认。\n\n")
		builder.WriteString("建议操作:\n")
		builder.WriteString("1. 确认操作目标正确\n")
		builder.WriteString("2. 了解操作的副作用\n")

	case RiskLow:
		builder.WriteString("ℹ️ 此操作被标记为【低风险】\n")
		builder.WriteString("通常可以安全执行，但仍建议确认操作内容。\n")
	}

	builder.WriteString("\n" + strings.Repeat("=", 40) + "\n")
	builder.WriteString("如需执行此操作，请在确认后重新发起请求。\n")

	return builder.String()
}

// formatRiskLevel 格式化风险等级显示
func (t *PermissionGuardTool) formatRiskLevel(level RiskLevel) string {
	switch level {
	case RiskCritical:
		return "严重风险 (CRITICAL)"
	case RiskHigh:
		return "高风险 (HIGH)"
	case RiskMedium:
		return "中风险 (MEDIUM)"
	case RiskLow:
		return "低风险 (LOW)"
	default:
		return string(level)
	}
}

// getRiskDescription 获取风险等级说明
func (t *PermissionGuardTool) getRiskDescription(level RiskLevel) string {
	switch level {
	case RiskCritical:
		return `此操作可能对系统造成严重损害，包括但不限于:
- 数据丢失或损坏
- 系统功能异常
- 安全漏洞引入
- 服务中断`

	case RiskHigh:
		return `此操作可能带来显著影响，包括但不限于:
- 文件修改或删除
- 配置变更
- 软件安装/卸载
- 数据迁移`

	case RiskMedium:
		return `此操作可能产生一定影响，包括但不限于:
- 文件复制/移动
- 服务重启
- 设置调整
- 备份恢复`

	case RiskLow:
		return `此操作通常安全，影响有限:
- 信息查询
- 只读操作
- 临时文件创建`

	default:
		return "未知风险等级"
	}
}

// IsDangerousOperation 判断操作是否为危险操作
// 外部可以调用此函数快速判断操作是否需要审批
func IsDangerousOperation(operation string) bool {
	tool := &PermissionGuardTool{}
	riskLevel := tool.assessRisk(operation, "")
	return riskLevel == RiskHigh || riskLevel == RiskCritical
}

// GetOperationRiskLevel 获取操作的风险等级
// 外部可以调用此函数获取操作的风险评估
func GetOperationRiskLevel(operation, details string) RiskLevel {
	tool := &PermissionGuardTool{}
	return tool.assessRisk(operation, details)
}

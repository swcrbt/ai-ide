package git

import (
	"fmt"
	"os/exec"
	"path/filepath"
	"strings"
)

// GitService 提供 Git 操作服务
type GitService struct {
	repoPath string // 当前仓库路径
}

// NewGitService 创建新的 Git 服务实例
func NewGitService() *GitService {
	return &GitService{}
}

// SetRepoPath 设置当前仓库路径
func (s *GitService) SetRepoPath(path string) {
	s.repoPath = path
}

// GetRepoPath 获取当前仓库路径
func (s *GitService) GetRepoPath() string {
	return s.repoPath
}

// runGitCommand 执行 git 命令并返回输出
func (s *GitService) runGitCommand(args ...string) (string, error) {
	cmd := exec.Command("git", args...)
	if s.repoPath != "" {
		cmd.Dir = s.repoPath
	}
	out, err := cmd.CombinedOutput()
	if err != nil {
		return string(out), fmt.Errorf("git 命令执行失败 (%s): %w\n输出: %s", strings.Join(args, " "), err, string(out))
	}
	return string(out), nil
}

// IsGitRepo 检查指定路径是否为 Git 仓库
func (s *GitService) IsGitRepo(path string) bool {
	cmd := exec.Command("git", "-C", path, "rev-parse", "--git-dir")
	err := cmd.Run()
	return err == nil
}

// Status 获取 Git 仓库状态
func (s *GitService) Status(path string) (*GitStatus, error) {
	if path != "" {
		s.repoPath = path
	}

	if s.repoPath == "" {
		return nil, fmt.Errorf("未设置仓库路径")
	}

	status := &GitStatus{}

	// 获取当前分支
	branch, err := s.Branch()
	if err != nil {
		return nil, err
	}
	status.Branch = branch

	// 获取与远程的同步状态
	ahead, behind, err := s.getBranchAheadBehind()
	if err == nil {
		status.Ahead = ahead
		status.Behind = behind
	}

	// 获取状态信息（使用短格式）
	out, err := s.runGitCommand("status", "--porcelain=v1", "-u")
	if err != nil {
		return nil, fmt.Errorf("获取 git 状态失败: %w", err)
	}

	lines := strings.Split(strings.TrimSuffix(out, "\n"), "\n")
	for _, line := range lines {
		if line == "" {
			continue
		}
		if len(line) < 3 {
			continue
		}

		// 解析状态码 XY
		x := FileStatus(line[0:1]) // 暂存区状态
		y := FileStatus(line[1:2]) // 工作区状态
		filePath := strings.TrimSpace(line[3:])

		fileStatus := GitFileStatus{
			Path:           filePath,
			IndexStatus:    x,
			WorktreeStatus: y,
			Staged:         x != " " && x != "?",
		}

		// 根据状态分类
		switch {
		case x == "U" || y == "U" || x == "D" && y == "D" || x == "A" && y == "A":
			status.Conflicted = append(status.Conflicted, fileStatus)
		case y == "?":
			status.Untracked = append(status.Untracked, fileStatus)
		case y == "M" || x == "M" && y == "M":
			status.Modified = append(status.Modified, fileStatus)
		case y == "D" || x == "D" && y == "D":
			status.Deleted = append(status.Deleted, fileStatus)
		case y == "R" || x == "R":
			status.Renamed = append(status.Renamed, fileStatus)
		case y == "A" || x == "A":
			status.Added = append(status.Added, fileStatus)
		}

		// 如果在暂存区
		if fileStatus.Staged {
			status.Staged = append(status.Staged, fileStatus)
		}
	}

	status.IsClean = len(status.Modified) == 0 && len(status.Added) == 0 &&
		len(status.Deleted) == 0 && len(status.Untracked) == 0 &&
		len(status.Renamed) == 0 && len(status.Conflicted) == 0

	return status, nil
}

// getBranchAheadBehind 获取当前分支与远程的同步状态
func (s *GitService) getBranchAheadBehind() (int, int, error) {
	out, err := s.runGitCommand("rev-list", "--left-right", "--count", "HEAD...@{upstream}")
	if err != nil {
		return 0, 0, err
	}

	var ahead, behind int
	fmt.Sscanf(strings.TrimSpace(out), "%d\t%d", &behind, &ahead)
	return ahead, behind, nil
}

// Diff 获取文件的 Diff
func (s *GitService) Diff(path string, staged bool) (*GitDiff, error) {
	if s.repoPath == "" {
		return nil, fmt.Errorf("未设置仓库路径")
	}

	args := []string{"diff"}
	if staged {
		args = append(args, "--cached")
	}
	args = append(args, "--", path)

	out, err := s.runGitCommand(args...)
	if err != nil {
		// diff 返回非零退出码但可能有输出
		if out == "" {
			return nil, fmt.Errorf("获取 diff 失败: %w", err)
		}
	}

	diff := &GitDiff{
		Path:    path,
		Content: out,
	}

	// 判断是否为新文件或已删除
	if strings.Contains(out, "new file mode") {
		diff.IsNew = true
	}
	if strings.Contains(out, "deleted file mode") {
		diff.IsDeleted = true
	}
	if strings.Contains(out, "Binary files") {
		diff.IsBinary = true
	}

	return diff, nil
}

// DiffAll 获取所有变更的 Diff（项目级）
func (s *GitService) DiffAll(staged bool) (string, error) {
	if s.repoPath == "" {
		return "", fmt.Errorf("未设置仓库路径")
	}

	args := []string{"diff"}
	if staged {
		args = append(args, "--cached")
	}

	out, err := s.runGitCommand(args...)
	if err != nil {
		if out == "" {
			return "", fmt.Errorf("获取 diff 失败: %w", err)
		}
	}

	return out, nil
}

// Stage 暂存指定文件
func (s *GitService) Stage(paths []string) error {
	if s.repoPath == "" {
		return fmt.Errorf("未设置仓库路径")
	}

	if len(paths) == 0 {
		return fmt.Errorf("未指定文件路径")
	}

	args := append([]string{"add"}, paths...)
	_, err := s.runGitCommand(args...)
	if err != nil {
		return fmt.Errorf("暂存文件失败: %w", err)
	}
	return nil
}

// Unstage 取消暂存指定文件
func (s *GitService) Unstage(paths []string) error {
	if s.repoPath == "" {
		return fmt.Errorf("未设置仓库路径")
	}

	if len(paths) == 0 {
		return fmt.Errorf("未指定文件路径")
	}

	args := append([]string{"reset", "HEAD"}, paths...)
	_, err := s.runGitCommand(args...)
	if err != nil {
		return fmt.Errorf("取消暂存失败: %w", err)
	}
	return nil
}

// Commit 提交暂存区的变更
func (s *GitService) Commit(message string) error {
	if s.repoPath == "" {
		return fmt.Errorf("未设置仓库路径")
	}

	if strings.TrimSpace(message) == "" {
		return fmt.Errorf("提交信息不能为空")
	}

	_, err := s.runGitCommand("commit", "-m", message)
	if err != nil {
		return fmt.Errorf("提交失败: %w", err)
	}
	return nil
}

// Push 推送当前分支到远程
func (s *GitService) Push() error {
	if s.repoPath == "" {
		return fmt.Errorf("未设置仓库路径")
	}

	_, err := s.runGitCommand("push")
	if err != nil {
		return fmt.Errorf("推送失败: %w", err)
	}
	return nil
}

// Pull 从远程拉取更新
func (s *GitService) Pull() error {
	if s.repoPath == "" {
		return fmt.Errorf("未设置仓库路径")
	}

	_, err := s.runGitCommand("pull")
	if err != nil {
		return fmt.Errorf("拉取失败: %w", err)
	}
	return nil
}

// Branch 获取当前分支名称
func (s *GitService) Branch() (string, error) {
	if s.repoPath == "" {
		return "", fmt.Errorf("未设置仓库路径")
	}

	out, err := s.runGitCommand("rev-parse", "--abbrev-ref", "HEAD")
	if err != nil {
		return "", fmt.Errorf("获取分支失败: %w", err)
	}

	return strings.TrimSpace(out), nil
}

// Branches 获取所有分支列表
func (s *GitService) Branches(path string) ([]GitBranch, error) {
	if path != "" {
		s.repoPath = path
	}

	if s.repoPath == "" {
		return nil, fmt.Errorf("未设置仓库路径")
	}

	out, err := s.runGitCommand("branch", "-a", "-vv")
	if err != nil {
		return nil, fmt.Errorf("获取分支列表失败: %w", err)
	}

	var branches []GitBranch
	lines := strings.Split(strings.TrimSpace(out), "\n")

	for _, line := range lines {
		if line == "" {
			continue
		}

		isCurrent := strings.HasPrefix(line, "*")
		line = strings.TrimPrefix(line, "* ")
		line = strings.TrimSpace(line)

		parts := strings.Fields(line)
		if len(parts) == 0 {
			continue
		}

		name := parts[0]
		branch := GitBranch{
			Name:    name,
			Current: isCurrent,
		}

		// 解析远程追踪分支信息
		if len(parts) >= 3 && strings.HasPrefix(parts[2], "[") {
			remoteInfo := strings.Trim(parts[2], "[]")
			branch.Remote = remoteInfo

			// 解析 ahead/behind
			if strings.Contains(remoteInfo, ": ahead ") {
				fmt.Sscanf(remoteInfo, "%*s: ahead %d", &branch.Ahead)
			}
			if strings.Contains(remoteInfo, ": behind ") {
				fmt.Sscanf(remoteInfo, "%*s: behind %d", &branch.Behind)
			}
		}

		branches = append(branches, branch)
	}

	return branches, nil
}

// Checkout 切换到指定分支
func (s *GitService) Checkout(branch string) error {
	if s.repoPath == "" {
		return fmt.Errorf("未设置仓库路径")
	}

	if strings.TrimSpace(branch) == "" {
		return fmt.Errorf("分支名称不能为空")
	}

	_, err := s.runGitCommand("checkout", branch)
	if err != nil {
		return fmt.Errorf("切换分支失败: %w", err)
	}
	return nil
}

// CreateBranch 创建并切换到新分支
func (s *GitService) CreateBranch(branch string) error {
	if s.repoPath == "" {
		return fmt.Errorf("未设置仓库路径")
	}

	if strings.TrimSpace(branch) == "" {
		return fmt.Errorf("分支名称不能为空")
	}

	// 先检查分支是否已存在
	exists, err := s.BranchExists(branch)
	if err != nil {
		return fmt.Errorf("检查分支失败: %w", err)
	}

	if exists {
		return fmt.Errorf("分支已存在: %s", branch)
	}

	_, err = s.runGitCommand("checkout", "-b", branch)
	if err != nil {
		return fmt.Errorf("创建分支失败: %w", err)
	}
	return nil
}

// BranchExists 检查分支是否存在
func (s *GitService) BranchExists(branch string) (bool, error) {
	if s.repoPath == "" {
		return false, fmt.Errorf("未设置仓库路径")
	}

	if strings.TrimSpace(branch) == "" {
		return false, fmt.Errorf("分支名称不能为空")
	}

	// 获取所有分支列表
	branches, err := s.Branches("")
	if err != nil {
		return false, err
	}

	for _, b := range branches {
		if b.Name == branch {
			return true, nil
		}
	}

	return false, nil
}

// Log 获取提交历史
func (s *GitService) Log(limit int) ([]GitCommit, error) {
	if s.repoPath == "" {
		return nil, fmt.Errorf("未设置仓库路径")
	}

	if limit <= 0 {
		limit = 20
	}

	format := "%H|%h|%s|%an|%ae|%ai"
	out, err := s.runGitCommand("log", fmt.Sprintf("-%d", limit), fmt.Sprintf("--pretty=format:%s", format))
	if err != nil {
		return nil, fmt.Errorf("获取提交历史失败: %w", err)
	}

	var commits []GitCommit
	lines := strings.Split(strings.TrimSpace(out), "\n")
	for _, line := range lines {
		if line == "" {
			continue
		}

		parts := strings.SplitN(line, "|", 6)
		if len(parts) < 6 {
			continue
		}

		commits = append(commits, GitCommit{
			Hash:      parts[0],
			ShortHash: parts[1],
			Message:   parts[2],
			Author:    parts[3],
			Email:     parts[4],
			Date:      parts[5],
		})
	}

	return commits, nil
}

// Summary 获取 Git 概要信息（用于左侧任务卡片）
func (s *GitService) Summary(path string) (*GitSummary, error) {
	status, err := s.Status(path)
	if err != nil {
		return nil, err
	}
	return status.ToSummary(), nil
}

// GetRoot 获取指定路径的 Git 仓库根目录
func (s *GitService) GetRoot(path string) (string, error) {
	cmd := exec.Command("git", "-C", path, "rev-parse", "--show-toplevel")
	out, err := cmd.Output()
	if err != nil {
		return "", fmt.Errorf("未找到 Git 仓库: %w", err)
	}
	return strings.TrimSpace(string(out)), nil
}

// DiscardChanges 放弃工作区对指定文件的修改
func (s *GitService) DiscardChanges(paths []string) error {
	if s.repoPath == "" {
		return fmt.Errorf("未设置仓库路径")
	}

	if len(paths) == 0 {
		return fmt.Errorf("未指定文件路径")
	}

	// 对于已追踪的文件使用 checkout，对于未追踪的文件使用 clean
	var trackedPaths []string
	var untrackedPaths []string

	for _, path := range paths {
		// 检查文件是否已追踪
		_, err := s.runGitCommand("ls-files", "--error-unmatch", path)
		if err != nil {
			untrackedPaths = append(untrackedPaths, path)
		} else {
			trackedPaths = append(trackedPaths, path)
		}
	}

	// 恢复已追踪文件的修改
	if len(trackedPaths) > 0 {
		args := append([]string{"checkout", "--"}, trackedPaths...)
		_, err := s.runGitCommand(args...)
		if err != nil {
			return fmt.Errorf("放弃修改失败: %w", err)
		}
	}

	// 删除未追踪的文件
	if len(untrackedPaths) > 0 {
		args := append([]string{"clean", "-f"}, untrackedPaths...)
		_, err := s.runGitCommand(args...)
		if err != nil {
			return fmt.Errorf("删除未追踪文件失败: %w", err)
		}
	}

	return nil
}

// Stash 暂存当前工作区变更
func (s *GitService) Stash(message string) error {
	if s.repoPath == "" {
		return fmt.Errorf("未设置仓库路径")
	}

	args := []string{"stash", "push"}
	if message != "" {
		args = append(args, "-m", message)
	}

	_, err := s.runGitCommand(args...)
	if err != nil {
		return fmt.Errorf("stash 失败: %w", err)
	}
	return nil
}

// StashPop 恢复最近一次 stash
func (s *GitService) StashPop() error {
	if s.repoPath == "" {
		return fmt.Errorf("未设置仓库路径")
	}

	_, err := s.runGitCommand("stash", "pop")
	if err != nil {
		return fmt.Errorf("恢复 stash 失败: %w", err)
	}
	return nil
}

// Init 初始化 Git 仓库
func (s *GitService) Init(path string) error {
	cmd := exec.Command("git", "init")
	if path != "" {
		cmd.Dir = path
		s.repoPath = path
	}
	_, err := cmd.CombinedOutput()
	if err != nil {
		return fmt.Errorf("初始化 Git 仓库失败: %w", err)
	}
	return nil
}

// GetFileStatusIcon 获取文件状态的图标标识
func GetFileStatusIcon(status FileStatus) string {
	switch status {
	case Modified:
		return "M"
	case Added:
		return "A"
	case Deleted:
		return "D"
	case Renamed:
		return "R"
	case Untracked:
		return "?"
	case Updated:
		return "U"
	default:
		return ""
	}
}

// GetFileStatusColor 获取文件状态对应的颜色（用于前端显示）
func GetFileStatusColor(status FileStatus) string {
	switch status {
	case Modified:
		return "#e5c07b" // 黄色
	case Added:
		return "#98c379" // 绿色
	case Deleted:
		return "#e06c75" // 红色
	case Renamed:
		return "#61afef" // 蓝色
	case Untracked:
		return "#abb2bf" // 灰色
	case Updated:
		return "#d19a66" // 橙色
	default:
		return "#abb2bf"
	}
}

// resolveRelativePath 将相对路径转换为绝对路径
func resolveRelativePath(basePath, relPath string) string {
	if filepath.IsAbs(relPath) {
		return relPath
	}
	return filepath.Join(basePath, relPath)
}

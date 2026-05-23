package git

// FileStatus 表示单个文件的 Git 状态
type FileStatus string

const (
	// Modified 文件已修改
	Modified FileStatus = "M"
	// Added 文件已添加（新增到暂存区）
	Added FileStatus = "A"
	// Deleted 文件已删除
	Deleted FileStatus = "D"
	// Renamed 文件已重命名
	Renamed FileStatus = "R"
	// Copied 文件已复制
	Copied FileStatus = "C"
	// Updated 文件已更新但未合并
	Updated FileStatus = "U"
	// Untracked 未追踪的文件
	Untracked FileStatus = "?"
	// Ignored 被忽略的文件
	Ignored FileStatus = "!"
)

// GitFileStatus 单个文件的 Git 状态信息
type GitFileStatus struct {
	// Path 文件相对路径
	Path string `json:"path"`
	// IndexStatus 暂存区状态（左列）
	IndexStatus FileStatus `json:"indexStatus"`
	// WorktreeStatus 工作区状态（右列）
	WorktreeStatus FileStatus `json:"worktreeStatus"`
	// Staged 是否在暂存区
	Staged bool `json:"staged"`
}

// GitStatus Git 仓库整体状态
type GitStatus struct {
	// Branch 当前分支名称
	Branch string `json:"branch"`
	// Ahead 本地领先远程的提交数
	Ahead int `json:"ahead"`
	// Behind 本地落后远程的提交数
	Behind int `json:"behind"`
	// Modified 已修改文件列表
	Modified []GitFileStatus `json:"modified"`
	// Added 已添加文件列表
	Added []GitFileStatus `json:"added"`
	// Deleted 已删除文件列表
	Deleted []GitFileStatus `json:"deleted"`
	// Untracked 未追踪文件列表
	Untracked []GitFileStatus `json:"untracked"`
	// Renamed 已重命名文件列表
	Renamed []GitFileStatus `json:"renamed"`
	// Conflicted 冲突文件列表
	Conflicted []GitFileStatus `json:"conflicted"`
	// Staged 已暂存文件列表
	Staged []GitFileStatus `json:"staged"`
	// IsClean 工作区是否干净
	IsClean bool `json:"isClean"`
}

// GitCommit Git 提交信息
type GitCommit struct {
	// Hash 提交哈希
	Hash string `json:"hash"`
	// ShortHash 短哈希
	ShortHash string `json:"shortHash"`
	// Message 提交信息
	Message string `json:"message"`
	// Author 作者
	Author string `json:"author"`
	// Email 作者邮箱
	Email string `json:"email"`
	// Date 提交日期（ISO 8601 格式）
	Date string `json:"date"`
}

// GitBranch 分支信息
type GitBranch struct {
	// Name 分支名称
	Name string `json:"name"`
	// Current 是否为当前分支
	Current bool `json:"current"`
	// Remote 远程追踪分支
	Remote string `json:"remote,omitempty"`
	// Ahead 领先远程的提交数
	Ahead int `json:"ahead"`
	// Behind 落后远程的提交数
	Behind int `json:"behind"`
}

// GitDiff Git Diff 结果
type GitDiff struct {
	// Path 文件路径
	Path string `json:"path"`
	// OldPath 旧文件路径（重命名时使用）
	OldPath string `json:"oldPath,omitempty"`
	// Content Diff 内容
	Content string `json:"content"`
	// IsNew 是否为新文件
	IsNew bool `json:"isNew"`
	// IsDeleted 是否已删除
	IsDeleted bool `json:"isDeleted"`
	// IsBinary 是否为二进制文件
	IsBinary bool `json:"isBinary"`
}

// GitSummary 左侧任务卡片区域显示的 Git 概要
type GitSummary struct {
	// Branch 当前分支
	Branch string `json:"branch"`
	// Ahead 领先远程提交数
	Ahead int `json:"ahead"`
	// Behind 落后远程提交数
	Behind int `json:"behind"`
	// ModifiedCount 已修改文件数
	ModifiedCount int `json:"modifiedCount"`
	// AddedCount 已添加文件数
	AddedCount int `json:"addedCount"`
	// DeletedCount 已删除文件数
	DeletedCount int `json:"deletedCount"`
	// UntrackedCount 未追踪文件数
	UntrackedCount int `json:"untrackedCount"`
	// StagedCount 已暂存文件数
	StagedCount int `json:"stagedCount"`
	// TotalChanges 总变更数
	TotalChanges int `json:"totalChanges"`
	// IsClean 工作区是否干净
	IsClean bool `json:"isClean"`
}

// ToSummary 将 GitStatus 转换为 GitSummary
func (s *GitStatus) ToSummary() *GitSummary {
	if s == nil {
		return &GitSummary{IsClean: true}
	}

	totalChanges := len(s.Modified) + len(s.Added) + len(s.Deleted) +
		len(s.Untracked) + len(s.Renamed) + len(s.Conflicted)

	return &GitSummary{
		Branch:         s.Branch,
		Ahead:          s.Ahead,
		Behind:         s.Behind,
		ModifiedCount:  len(s.Modified),
		AddedCount:     len(s.Added),
		DeletedCount:   len(s.Deleted),
		UntrackedCount: len(s.Untracked),
		StagedCount:    len(s.Staged),
		TotalChanges:   totalChanges,
		IsClean:        totalChanges == 0,
	}
}

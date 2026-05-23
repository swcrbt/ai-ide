package fs

import (
	"os"
	"time"
)

// FileNode 表示文件树中的一个节点
type FileNode struct {
	Name     string      `json:"name"`     // 文件名
	Path     string      `json:"path"`     // 文件路径
	IsDir    bool        `json:"isDir"`    // 是否为目录
	Children []*FileNode `json:"children"` // 子节点（仅目录有）
	ModTime  time.Time   `json:"modTime"`  // 修改时间
	Size     int64       `json:"size"`     // 文件大小（字节）
}

// FileEventType 表示文件事件类型
type FileEventType string

const (
	// FileEventCreate 文件创建事件
	FileEventCreate FileEventType = "create"
	// FileEventModify 文件修改事件
	FileEventModify FileEventType = "modify"
	// FileEventDelete 文件删除事件
	FileEventDelete FileEventType = "delete"
	// FileEventRename 文件重命名事件
	FileEventRename FileEventType = "rename"
)

// FileEvent 表示一个文件变更事件
type FileEvent struct {
	Type FileEventType `json:"type"` // 事件类型
	Path string        `json:"path"` // 文件路径
}

// ensureDirExists 确保目录存在，不存在则创建
func ensureDirExists(path string, perm os.FileMode) error {
	if _, err := os.Stat(path); os.IsNotExist(err) {
		return os.MkdirAll(path, perm)
	}
	return nil
}

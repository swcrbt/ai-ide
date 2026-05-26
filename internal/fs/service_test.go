package fs

import (
	"encoding/json"
	"os"
	"path/filepath"
	"testing"
)

// TestReadFileJSONSerialization verifies that when Go's json.Marshal
// serializes a []byte return value (as Wails does over IPC), the result
// is a base64-encoded string. The JavaScript side must decode with
// atob() then TextDecoder — NOT treat it as Array<number>.
//
// Regresion test for: bytes.length=11120 but content.length=0 bug.
func TestReadFileJSONSerialization(t *testing.T) {
	dir := t.TempDir()
	testPath := filepath.Join(dir, "test.json")
	content := `{"name": "ai-ide", "version": "0.1.0", "description": "AI驱动的IDE"}`

	if err := os.WriteFile(testPath, []byte(content), 0644); err != nil {
		t.Fatal(err)
	}

	// Simulate ReadFile Go method
	data, err := os.ReadFile(testPath)
	if err != nil {
		t.Fatal(err)
	}

	// Simulate Wails IPC: callbackMessage.Result = data, then json.Marshal
	// This is exactly what calls.go does: json.Marshal(callbackMessage)
	type callbackMessage struct {
		Result interface{} `json:"result"`
	}
	msg := callbackMessage{Result: data}
	jsonBytes, err := json.Marshal(msg)
	if err != nil {
		t.Fatal(err)
	}

	// Parse as JavaScript would: JSON.parse(incomingMessage)
	var parsed struct {
		Result interface{} `json:"result"`
	}
	if err := json.Unmarshal(jsonBytes, &parsed); err != nil {
		t.Fatal(err)
	}

	// KEY ASSERTION: json.Marshal([]byte) produces base64 string, NOT array
	resultStr, ok := parsed.Result.(string)
	if !ok {
		t.Fatalf("json.Marshal([]byte) produced %T, expected string (base64). "+
			"Frontend code must handle base64, not Array<number>.", parsed.Result)
	}

	if len(resultStr) == 0 {
		t.Fatal("expected non-empty base64 string")
	}

	// Verify round-trip: Go can decode the base64 back to the original bytes
	var roundtrip struct {
		Result []byte `json:"result"`
	}
	if err := json.Unmarshal(jsonBytes, &roundtrip); err != nil {
		t.Fatal(err)
	}

	if string(roundtrip.Result) != content {
		t.Fatalf("round-trip failed: expected %q, got %q", content, string(roundtrip.Result))
	}

	// Verify base64 length matches expectation (4/3 ratio + padding)
	expectedB64Len := (len(content) + 2) / 3 * 4
	if len(resultStr) != expectedB64Len {
		t.Logf("Note: base64 length %d vs expected %d", len(resultStr), expectedB64Len)
	}

	t.Logf("Original: %d bytes → base64: %d chars ✓", len(content), len(resultStr))
	t.Logf("Assertion: JS must use atob(base64) then TextDecoder, NOT new Uint8Array(base64)")
}

func TestFileSize(t *testing.T) {
	dir := t.TempDir()
	svc := NewFileService()

	// 正常文件
	smallPath := filepath.Join(dir, "small.txt")
	smallContent := "hello"
	if err := os.WriteFile(smallPath, []byte(smallContent), 0644); err != nil {
		t.Fatal(err)
	}

	size, err := svc.FileSize(smallPath)
	if err != nil {
		t.Fatalf("FileSize failed: %v", err)
	}
	if size != int64(len(smallContent)) {
		t.Fatalf("expected %d, got %d", len(smallContent), size)
	}

	// 大文件
	bigPath := filepath.Join(dir, "big.bin")
	bigContent := make([]byte, 6*1024*1024) // 6MB
	if err := os.WriteFile(bigPath, bigContent, 0644); err != nil {
		t.Fatal(err)
	}

	size, err = svc.FileSize(bigPath)
	if err != nil {
		t.Fatalf("FileSize on big file failed: %v", err)
	}
	if size != int64(len(bigContent)) {
		t.Fatalf("expected %d, got %d", len(bigContent), size)
	}

	// 目录应返回错误
	subDir := filepath.Join(dir, "subdir")
	if err := os.MkdirAll(subDir, 0755); err != nil {
		t.Fatal(err)
	}
	_, err = svc.FileSize(subDir)
	if err == nil {
		t.Fatal("expected error for directory path")
	}

	// 不存在的文件应返回错误
	_, err = svc.FileSize(filepath.Join(dir, "nonexistent"))
	if err == nil {
		t.Fatal("expected error for nonexistent path")
	}

	// 路径遍历应返回错误
	_, err = svc.FileSize("../etc/passwd")
	if err == nil {
		t.Fatal("expected error for path traversal")
	}
}

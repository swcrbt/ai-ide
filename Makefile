# AI IDE — 统一构建工具
# 项目：基于 Wails v2 + Go + React 的跨平台桌面代码编辑器

# =============================================================================
# 默认目标
# =============================================================================
.DEFAULT_GOAL := help

# =============================================================================
# 变量定义
# =============================================================================
APP_NAME := ai-ide
FRONTEND_DIR := frontend
BUILD_DIR := build
BIN_DIR := $(BUILD_DIR)/bin

# 颜色定义（用于美化输出）
BLUE   := \033[34m
GREEN  := \033[32m
YELLOW := \033[33m
RED    := \033[31m
CYAN   := \033[36m
RESET  := \033[0m

# 检测操作系统（用于兼容性处理）
UNAME_S := $(shell uname -s)

# Go 环境
GOPATH := $(shell go env GOPATH)
GOBIN := $(GOPATH)/bin

# Wails CLI 路径检测
# 1. 优先从 PATH 中查找
# 2. 回退到 GOPATH/bin
# 3. 如果都找不到，设为空值
WAILS := $(shell \
	W=$$(which wails 2>/dev/null); \
	if [ -n "$$W" ]; then \
		echo "$$W"; \
	elif [ -f "$(GOBIN)/wails" ]; then \
		echo "$(GOBIN)/wails"; \
	fi \
)

# =============================================================================
# 工具检测函数
# =============================================================================
define check_tool
	@which $(1) > /dev/null 2>&1 || { echo "$(RED)错误：未找到 $(1)，请先安装$(RESET)"; exit 1; }
endef

define check_wails
	@if [ -z "$(WAILS)" ] || [ ! -f "$(WAILS)" ]; then \
		echo "$(RED)错误：未找到 wails，请先运行 'make install'$(RESET)"; \
		echo "$(YELLOW)提示：你也可以执行 export PATH=\"\$$PATH:$(GOBIN)\"$(RESET)"; \
		exit 1; \
	fi
endef

# =============================================================================
# 目标定义
# =============================================================================

## help: 显示帮助信息
.PHONY: help
help:
	@echo ""
	@echo "$(BLUE)╔══════════════════════════════════════════════════════════════╗$(RESET)"
	@echo "$(BLUE)║$(RESET)           $(GREEN)AI IDE$(RESET) — 统一构建工具                        $(BLUE)║$(RESET)"
	@echo "$(BLUE)╚══════════════════════════════════════════════════════════════╝$(RESET)"
	@echo ""
	@echo "$(GREEN)可用命令:$(RESET)"
	@echo ""
	@awk 'BEGIN {FS = ": "} /^## [a-zA-Z_-]+: / {sub(/^## /, ""); printf "  $(CYAN)%-16s$(RESET) %s\n", $$1, $$2}' $(MAKEFILE_LIST)
	@echo ""
	@echo "$(YELLOW)提示：$(RESET)运行 $(CYAN)make <命令>$(RESET) 执行对应操作"
	@echo ""

## install: 安装所有依赖（Go + Node.js + Wails）
.PHONY: install
install:
	@echo "$(BLUE)━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━$(RESET)"
	@echo "$(GREEN)📦 正在安装依赖...$(RESET)"
	@echo "$(BLUE)━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━$(RESET)"
	$(call check_tool,go)
	$(call check_tool,node)
	@echo "$(CYAN)➜ 安装 Go 依赖...$(RESET)"
	@go mod download
	@echo "$(GREEN)✓ Go 依赖安装完成$(RESET)"
	@echo ""
	@echo "$(CYAN)➜ 安装前端依赖...$(RESET)"
	@cd $(FRONTEND_DIR) && npm install
	@echo "$(GREEN)✓ 前端依赖安装完成$(RESET)"
	@echo ""
	@echo "$(CYAN)➜ 检查 Wails CLI...$(RESET)"
	@which wails > /dev/null 2>&1 || (echo "$(YELLOW)⚠ Wails CLI 未安装，正在安装...$(RESET)" && go install github.com/wailsapp/wails/v2/cmd/wails@latest)
	@echo "$(GREEN)✓ Wails CLI 就绪$(RESET)"
	@echo ""
	@echo "$(YELLOW)💡 提示：如果运行 'make build' 时提示找不到 wails，请执行以下命令：$(RESET)"
	@echo "$(CYAN)   export PATH=\"$$PATH:$$(go env GOPATH)/bin\"$(RESET)"
	@echo ""
	@echo "$(GREEN)🎉 所有依赖安装完成！$(RESET)"

## dev: 启动开发模式（wails dev）
.PHONY: dev
dev:
	@echo "$(BLUE)━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━$(RESET)"
	@echo "$(GREEN)🚀 启动开发模式...$(RESET)"
	@echo "$(BLUE)━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━$(RESET)"
	$(call check_tool,go)
	$(call check_tool,node)
	$(call check_wails)
	@echo "$(YELLOW)提示：按 Ctrl+C 停止开发服务器$(RESET)"
	@echo "$(CYAN)前端地址: http://localhost:34115$(RESET)"
	@echo ""
	@$(WAILS) dev

## build: 构建生产版本
.PHONY: build
build:
	@echo "$(BLUE)━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━$(RESET)"
	@echo "$(GREEN)🔨 正在构建生产版本...$(RESET)"
	@echo "$(BLUE)━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━$(RESET)"
	$(call check_tool,go)
	$(call check_tool,node)
	$(call check_wails)
	@echo "$(CYAN)➜ 构建 Wails 应用...$(RESET)"
	@$(WAILS) build
	@echo "$(GREEN)✓ 构建完成$(RESET)"
	@echo "$(CYAN)输出目录: $(BIN_DIR)/$(RESET)"

## build-web: 仅构建前端
.PHONY: build-web
build-web:
	@echo "$(BLUE)━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━$(RESET)"
	@echo "$(GREEN)🔨 正在构建前端...$(RESET)"
	@echo "$(BLUE)━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━$(RESET)"
	$(call check_tool,node)
	@echo "$(CYAN)➜ 运行前端构建...$(RESET)"
	@cd $(FRONTEND_DIR) && npm run build
	@echo "$(GREEN)✓ 前端构建完成$(RESET)"

## test: 运行所有测试（Go + 前端）
.PHONY: test
test: test-go test-fe
	@echo ""
	@echo "$(GREEN)🎉 所有测试执行完毕$(RESET)"

## test-go: 仅运行 Go 测试
.PHONY: test-go
test-go:
	@echo "$(BLUE)━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━$(RESET)"
	@echo "$(GREEN)🧪 正在运行 Go 测试...$(RESET)"
	@echo "$(BLUE)━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━$(RESET)"
	$(call check_tool,go)
	@go test -v -race -coverprofile=coverage.out ./...
	@echo "$(GREEN)✓ Go 测试通过$(RESET)"
	@echo "$(CYAN)覆盖率报告: coverage.out$(RESET)"

## test-fe: 仅运行前端测试
.PHONY: test-fe
test-fe:
	@echo "$(BLUE)━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━$(RESET)"
	@echo "$(GREEN)🧪 正在运行前端测试...$(RESET)"
	@echo "$(BLUE)━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━$(RESET)"
	$(call check_tool,node)
	@cd $(FRONTEND_DIR) && npm test
	@echo "$(GREEN)✓ 前端测试通过$(RESET)"

## lint: 运行代码检查（Go + 前端）
.PHONY: lint
lint: lint-go lint-fe
	@echo ""
	@echo "$(GREEN)🎉 所有代码检查完成$(RESET)"

## lint-go: 仅检查 Go 代码
.PHONY: lint-go
lint-go:
	@echo "$(BLUE)━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━$(RESET)"
	@echo "$(GREEN)🔍 正在检查 Go 代码...$(RESET)"
	@echo "$(BLUE)━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━$(RESET)"
	$(call check_tool,go)
	@echo "$(CYAN)➜ 运行 go vet...$(RESET)"
	@go vet ./...
	@echo "$(CYAN)➜ 检查 gofmt 格式...$(RESET)"
	@UNFORMATTED=$$(gofmt -l .); \
	if [ -n "$$UNFORMATTED" ]; then \
		echo "$(RED)以下文件未格式化:$(RESET)"; \
		echo "$$UNFORMATTED"; \
		echo "$(YELLOW)运行 gofmt -w . 自动修复$(RESET)"; \
		exit 1; \
	fi
	@echo "$(GREEN)✓ Go 代码检查通过$(RESET)"

## lint-fe: 仅检查前端代码
.PHONY: lint-fe
lint-fe:
	@echo "$(BLUE)━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━$(RESET)"
	@echo "$(GREEN)🔍 正在检查前端代码...$(RESET)"
	@echo "$(BLUE)━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━$(RESET)"
	$(call check_tool,node)
	@cd $(FRONTEND_DIR) && npm run build
	@echo "$(GREEN)✓ 前端代码检查通过（TypeScript 编译无错误）$(RESET)"

## clean: 清理构建产物
.PHONY: clean
clean:
	@echo "$(BLUE)━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━$(RESET)"
	@echo "$(GREEN)🧹 正在清理构建产物...$(RESET)"
	@echo "$(BLUE)━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━$(RESET)"
	@echo "$(CYAN)➜ 清理 $(BUILD_DIR)/ ...$(RESET)"
	@rm -rf $(BUILD_DIR)/
	@echo "$(CYAN)➜ 清理 $(FRONTEND_DIR)/dist/ ...$(RESET)"
	@rm -rf $(FRONTEND_DIR)/dist/
	@echo "$(GREEN)✓ 构建产物已清理$(RESET)"

## clean-all: 深度清理（包括依赖）
.PHONY: clean-all
clean-all: clean
	@echo "$(BLUE)━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━$(RESET)"
	@echo "$(GREEN)🧹 正在深度清理...$(RESET)"
	@echo "$(BLUE)━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━$(RESET)"
	@echo "$(CYAN)➜ 清理前端 node_modules ...$(RESET)"
	@rm -rf $(FRONTEND_DIR)/node_modules/
	@echo "$(CYAN)➜ 清理 Go 构建缓存...$(RESET)"
	@go clean -cache
	@echo "$(GREEN)✓ 深度清理完成$(RESET)"

## info: 显示项目信息
.PHONY: info
info:
	@echo ""
	@echo "$(BLUE)╔══════════════════════════════════════════════════════════════╗$(RESET)"
	@echo "$(BLUE)║$(RESET)                    $(GREEN)项目信息$(RESET)                             $(BLUE)║$(RESET)"
	@echo "$(BLUE)╚══════════════════════════════════════════════════════════════╝$(RESET)"
	@echo ""
	@echo "  $(CYAN)应用名称:$(RESET)   $(APP_NAME)"
	@echo "  $(CYAN)操作系统:$(RESET)   $(UNAME_S)"
	@echo ""
	@echo "$(GREEN)依赖版本:$(RESET)"
	@which go > /dev/null 2>&1 && echo "  $(CYAN)Go:$(RESET)       $$(go version)" || echo "  $(RED)Go:$(RESET)       未安装"
	@which node > /dev/null 2>&1 && echo "  $(CYAN)Node.js:$(RESET)  $$(node --version)" || echo "  $(RED)Node.js:$(RESET)  未安装"
	@if [ -n "$(WAILS)" ] && [ -f "$(WAILS)" ]; then \
		echo "  $(CYAN)Wails:$(RESET)    $$($(WAILS) version 2>/dev/null | head -1) ($(WAILS))"; \
	else \
		echo "  $(RED)Wails:$(RESET)    未安装"; \
	fi
	@echo ""
	@echo "$(GREEN)目录结构:$(RESET)"
	@echo "  $(CYAN)前端目录:$(RESET)   $(FRONTEND_DIR)/"
	@echo "  $(CYAN)构建目录:$(RESET)   $(BUILD_DIR)/"
	@echo "  $(CYAN)输出目录:$(RESET)   $(BIN_DIR)/"
	@echo ""

# AI 写作反馈平台后端开发工具
.PHONY: help install format lint type-check test clean dev docs lock lock-upgrade pip-audit

PIP_COMPILE ?= pip-compile
PIP_AUDIT ?= pip-audit
PIP_COMPILE_ARGS ?= --resolver=backtracking
LOCK_OUTPUT_DEV ?= requirements-dev.txt
AUDIT_ARGS ?=
UTF8_ENV ?= PYTHONUTF8=1

define check-tool
	@command -v $(1) >/dev/null 2>&1 || { \
		echo "❌ 未找到 $(1)，请运行 \"pip install $(1)\" 或将其加入虚拟环境"; \
		exit 1; \
	}
endef

define ensure-pip-below-25
	@python - <<'PY'
import sys
import importlib.metadata

version = importlib.metadata.version("pip")
major = int(version.split(".", 1)[0])
if major >= 25:
    print(f"❌ 当前 pip 版本为 {version}，pip-tools 7.x 尚未完全兼容 pip>=25。")
    print("   请切换到 pip<25 的虚拟环境后再运行 make lock/lock-upgrade。")
    sys.exit(1)
PY
endef

# 默认目标
help:
	@echo "AI 写作反馈平台后端开发命令："
	@echo "  install     - 安装依赖（包括开发工具）"
	@echo "  format      - 格式化代码 (black + isort)"
	@echo "  lint        - 代码质量检查 (flake8)"
	@echo "  type-check  - 类型检查 (mypy)"
	@echo "  test        - 运行测试"
	@echo "  test-cov    - 运行测试并生成覆盖率报告"
	@echo "  dev         - 启动开发服务器"
	@echo "  clean       - 清理缓存文件"
	@echo "  docs        - 生成API文档"
	@echo "  lock        - 使用 pip-compile 生成/刷新锁文件"
	@echo "  lock-upgrade- 按批次升级依赖，可配合 PACKAGE=fastapi"
	@echo "  pip-audit   - 运行依赖安全审计"
	@echo "  check-all   - 运行所有检查 (format + lint + type-check + test)"

# 安装依赖
install:
	pip install -e ".[dev]"
	pre-commit install

# 依赖治理
lock:
	$(call ensure-pip-below-25)
	$(call check-tool,$(PIP_COMPILE))
	$(UTF8_ENV) $(PIP_COMPILE) $(PIP_COMPILE_ARGS) requirements.in
	$(UTF8_ENV) $(PIP_COMPILE) $(PIP_COMPILE_ARGS) --output-file $(LOCK_OUTPUT_DEV) requirements-dev.in

lock-upgrade:
	$(call ensure-pip-below-25)
	$(call check-tool,$(PIP_COMPILE))
ifdef PACKAGE
	$(UTF8_ENV) $(PIP_COMPILE) --upgrade-package $(PACKAGE) $(PIP_COMPILE_ARGS) requirements.in
	$(UTF8_ENV) $(PIP_COMPILE) --upgrade-package $(PACKAGE) $(PIP_COMPILE_ARGS) --output-file $(LOCK_OUTPUT_DEV) requirements-dev.in
else
	$(UTF8_ENV) $(PIP_COMPILE) --upgrade $(PIP_COMPILE_ARGS) requirements.in
	$(UTF8_ENV) $(PIP_COMPILE) --upgrade $(PIP_COMPILE_ARGS) --output-file $(LOCK_OUTPUT_DEV) requirements-dev.in
endif

pip-audit:
	$(call check-tool,$(PIP_AUDIT))
	$(PIP_AUDIT) -r requirements.txt $(AUDIT_ARGS)

# 代码格式化
format:
	black app/ tests/ scripts/
	isort app/ tests/ scripts/

# 代码检查
lint:
	flake8 app/ tests/ scripts/

# 类型检查
type-check:
	mypy app/

# 运行测试
test:
	pytest tests/ -v

# 测试覆盖率
test-cov:
	pytest tests/ -v --cov=app --cov-report=html --cov-report=term

# 开发服务器
dev:
	uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# 清理缓存
clean:
	find . -type d -name "__pycache__" -exec rm -rf {} +
	find . -type f -name "*.pyc" -delete
	find . -type d -name "*.egg-info" -exec rm -rf {} +
	find . -name ".coverage" -delete
	find . -name "htmlcov" -exec rm -rf {} +
	find . -name ".pytest_cache" -exec rm -rf {} +
	find . -name ".mypy_cache" -exec rm -rf {} +

# 生成API文档
docs:
	@echo "API文档将在开发服务器启动后访问: http://localhost:8000/docs"

# 运行所有检查
check-all: format lint type-check test
	@echo "✅ 所有检查通过！代码质量良好。"

# 数据库迁移
migrate:
	alembic upgrade head

# 创建新迁移
migration:
	alembic revision --autogenerate -m "$(MSG)"

# 重置数据库
reset-db:
	alembic downgrade base
	alembic upgrade head

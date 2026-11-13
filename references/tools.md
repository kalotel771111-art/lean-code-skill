# 度量工具

## 首选：本仓脚本（零依赖）

```bash
node "${DSH_HOME:-$HOME/.dsh}/skills/lean-code/scripts/bloat.mjs" --diff   # DSH
node "$HOME/.claude/skills/lean-code/scripts/bloat.mjs" --diff          # Claude Code
node <path>/scripts/bloat.mjs src lib                                   # 存量扫描
node <path>/scripts/bloat.mjs --json --strict --max-net=80              # CI / 严格模式
```

读法：

- **diff 模式**：净增行数、新文件、改动函数长度、重复块、try/catch、`any`、TODO、注释掉的代码。
- **files 模式**：存量文件的函数长度与重复（重复只作参考，不阻断）。
- 只统计改动 hunk 内的函数，不会因为老函数长而报警。

误报来源：模板字符串里的代码样例、生成代码、测试脚手架、i18n 文案。判断后忽略。

## TypeScript / JavaScript

- 未用文件、导出、依赖：`npx --yes knip`（先看报告，再删）
- 重复代码：`npx --yes jscpd --threshold 3 src`
- 复杂度（eslint + sonarjs）：

```js
// 按所用 sonarjs 版本的导出方式调整 import
import sonarjs from "eslint-plugin-sonarjs";
export default [{
  files: ["src/**/*.{js,ts,tsx}"],
  plugins: { sonarjs },
  rules: {
    complexity: ["warn", 10],
    "sonarjs/cognitive-complexity": ["warn", 15],
    "max-lines-per-function": ["warn", 60],
    "max-params": ["warn", 4],
    "max-depth": ["warn", 4],
  },
}];
```

- 行数 / 语言构成：`npx --yes scc src`

## Python

```bash
ruff check --select C901,PLR0912,PLR0915,PLR0913,F401,F841 .
radon cc -s -n C .
vulture . --min-confidence 80
pylint --disable=all --enable=R0912,R0914,R0915 .
```

## 通用

- 净增：`git diff --numstat`、`git diff --stat`
- 结构搜索（找重复模式）：`npx --yes @ast-grep/cli --pattern '...'`
- 跨语言复杂度：`pipx run lizard src -C 15 -L 60 -w`

## 安装策略

- 先跑本仓脚本；外部工具只在需要深挖时才装
- 手机上优先 `npx --yes` / `pip install --user`，别全局装一堆
- 要常驻时先说体积和用途
- 团队里再固化成 CI 配置

## 什么时候别看指标

- 生成代码、迁移文件、第三方源码
- 测试 fixture 与快照
- 一次性脚本
- 指标与可读性冲突时，选可读

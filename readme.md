
# Project analysis and approach

## User

分析这个项目，梳理一下实现思路

## Assistant

这个项目本质上不是业务应用，而是一个 **Claude Code 工作流安装器 + 运行时编排模板 + Go 多模型桥接器**。

## 整体定位
`ccg-workflow` 发布为 npm CLI，入口是 `ccg`。用户运行 `npx ccg-workflow` 后，项目会把一整套 `/ccg:*` 斜杠命令、Hook、策略文件、专家 Prompt、Skills、Rules 和 `codeagent-wrapper` 二进制安装到 `~/.claude/`。

核心目标是：让 Claude Code 作为主控，根据用户意图选择策略，再通过 Go wrapper 调用 Codex、Gemini、Grok、Antigravity 等外部模型做分析、审查或实现。

## 核心流程
1. CLI 入口  
   `bin/ccg.mjs` 加载构建后的 `dist/cli.mjs`，源码入口在 `src/cli.ts`，命令注册集中在 `src/cli-setup.ts`。

2. 初始化安装  
   `src/commands/init.ts` 是交互式安装主流程：选择语言、API、前后端模型、MCP 工具、性能模式，然后生成 `~/.claude/.ccg/config.toml`。

3. 资产安装  
   `src/utils/installer.ts` 的 `installWorkflows()` 负责复制模板：
   - `templates/commands/` → Claude 斜杠命令
   - `templates/hooks/` → Claude Hooks
   - `templates/engine/` → 策略和模型路由
   - `templates/prompts/` → 各模型角色 Prompt
   - `templates/skills/`、`templates/rules/` → 领域知识和质量规则
   - 下载/安装 `codeagent-wrapper`

4. 运行时编排  
   用户执行 `/ccg:go xxx` 时，真正的“引擎逻辑”主要写在 `templates/commands/go.md`。它要求 Claude 先读项目上下文，再分类任务类型、复杂度、风险和领域，最后选择对应策略文件，比如 `direct-fix`、`guided-develop`、`full-collaborate` 等。

5. 状态保持  
   中等复杂度以上任务会创建 `.ccg/tasks/{task-name}/task.json`、`context.jsonl`、`plan.md` 等文件。Hook 会在每轮对话中自动注入当前任务状态，防止上下文压缩后丢失进度。

6. 多模型调用  
   `codeagent-wrapper/` 是 Go 子项目。它统一封装 Codex、Claude、Gemini、Antigravity、Grok CLI，负责参数构造、工作目录设置、流式 JSON 输出解析、Session-ID 捕获、并行任务执行和日志清理。

## 关键模块
- `src/cli-setup.ts`：CLI 命令注册层。
- `src/commands/init.ts`：安装向导和配置生成。
- `src/utils/config.ts`：读写 `~/.claude/.ccg/config.toml`。
- `src/utils/installer-data.ts`：定义默认安装哪些 `/ccg:*` 命令。
- `src/utils/installer.ts`：安装/卸载核心实现。
- `templates/commands/go.md`：智能入口策略选择逻辑。
- `templates/hooks/*.js`：Claude Code Hook 运行时注入逻辑。
- `templates/engine/model-router.md`：外部模型选择和 wrapper 调用模板。
- `codeagent-wrapper/*.go`：外部模型 CLI 的统一执行器。

## 实现思路
如果要继续开发这个项目，建议按三层理解：

第一层是 **安装器层**：TypeScript CLI 只负责把配置和模板正确落盘，保证 Windows/macOS/Linux 路径、权限、MCP、二进制下载都可靠。

第二层是 **工作流定义层**：大量核心能力不是硬编码在 TS 里，而是写在 Markdown 模板中，让 Claude Code 读取后按规则执行。新增策略或命令，通常是加 `templates/commands/*.md`、`templates/engine/strategies/*.md`，再在 `installer-data.ts` 注册。

第三层是 **模型桥接层**：Go wrapper 负责把不同模型 CLI 统一成一个调用接口。新增模型时，主要实现 `Backend`、参数构造、输出流解析和测试。

测试方面，TS 侧用 `vitest`，Go wrapper 有比较多单测。分析期间我没有修改代码，也没有运行测试。

## User

我想从零到1开始实现这个项目，应该如何开始呢

## Assistant

从零到一做这类项目，别一上来复刻完整 CCG。正确顺序是：**先做出一个能装、能调、能跑通一条链路的最小系统**，再按层加能力。

## 先想清楚你要造什么

CCG 本质是三件事叠在一起：

1. **安装器**：把命令/Hook/配置写进 `~/.claude/`
2. **编排协议**：Markdown 告诉 Claude「怎么选策略、怎么推进」
3. **模型桥**：一个进程统一调用 Codex / Gemini 等 CLI

第一版只做「Claude 主控 + 一个外部模型 + 一条斜杠命令」，就够验证方向。

---

## 推荐路线：6 个里程碑

### M0：空壳 CLI（半天）

目标：`npx your-tool` 能跑。

```
bin/cli.mjs
src/cli.ts          # cac 入口
src/commands/init.ts
package.json        # bin 指向 cli
```

做到：`init` 打印一句「installed」，并把一个文件写到 `~/.claude/commands/xxx/hello.md`。

**验收**：Claude Code 里能看到 `/xxx:hello`。

---

### M1：模板安装管线（1–2 天）

目标：从仓库 `templates/` 拷到用户目录，而不是硬编码字符串。

```
templates/commands/go.md
src/utils/installer.ts   # copy + 变量替换
src/utils/config.ts      # ~/.xxx/config.toml
```

先只支持两个占位符，例如：

- `{{BACKEND_PRIMARY}}`
- `{{HOME}}` → 绝对路径

**验收**：改模板 → 再跑 `init --force` → 用户目录内容跟着变。

---

### M2：最小「智能入口」协议（2–3 天）

目标：不靠复杂引擎，先用一份 Markdown 约束 Claude 行为。

`templates/commands/go.md` 只写：

1. 读 `git status` + 项目类型文件  
2. 判 S / M / L  
3. S → 自己改；M+ → 调外部模型分析  
4. 写 `.ccg/tasks/{name}/task.json`

先别上 10 个策略，最多 2 个：`direct-fix`、`guided-develop`。

**验收**：在真实小项目里 `/go 修一个 typo` 和 `/go 加一个小功能` 行为不同。

---

### M3：Go / Node wrapper（3–5 天，核心）

目标：Claude 用一条 Bash 就能调外部模型。

最小接口：

```bash
wrapper --backend codex - "$PWD" <<'EOF'
分析这个 bug：...
EOF
```

第一版只接 **一个后端**（建议 Codex 或 Gemini），只做：

- 拼命令行参数  
- 把 stdout 里的最终回答吐回来  
- 超时 / 退出码  
- Windows 路径别踩坑（多行参数用 stdin）

**验收**：不经过 Claude，本地手动跑 wrapper 能拿到模型回复。

---

### M4：一个 Hook（1–2 天）

目标：任务状态不会在会话压缩后丢失。

只做 `UserPromptSubmit` → 读 `.ccg/tasks/*/task.json` → 注入：

```xml
<ccg-state>
Task: xxx
Phase: 2
Next: ...
</ccg-state>
```

**验收**：任务做到一半，新开一轮对话仍知道当前阶段。

---

### M5：再加第二模型 + 并行（之后）

有了单模型桥之后再做：

- `--backend gemini|codex`  
- 双模型并行（两个 wrapper + wait）  
- Session resume  
- MCP 同步、doctor、legacy 命令……

这些都是放大镜，不是地基。

---

## 每天该写哪一层

| 阶段 | 写代码的地方 | 先不要碰 |
|------|-------------|----------|
| 第 1 周 | CLI + installer + 1 个命令模板 | Skills / 10 策略 / i18n |
| 第 2 周 | wrapper + 流式解析 | Agent Teams / Opus 审查环 |
| 第 3 周 | Hook + task.json | Codex-led 模式、全量 MCP |
| 第 4 周+ | 策略拆分、质量关卡 | 发版、CDN、双源下载 |

原则：**编排逻辑尽量写在 Markdown，可靠逻辑写在代码里**（安装、进程、解析、路径）。

---

## 建议的第一周具体任务清单

1. 建 repo：`pnpm` + `cac` + `unbuild`，能 `pnpm build && node bin/cli.mjs init`  
2. `templates/commands/go.md` 写清 Phase 0–2（分析 → 策略 → 执行）  
3. installer：拷贝命令 + 写 `config.toml`  
4. 用 Go 或 Node 做一个只支持一个 backend 的 wrapper  
5. 在 Claude Code 里跑通：`/go 给 README 加一行说明`  
6. 加一个 Hook 注入 task 状态  

跑通这条链路后，你再对照现有 CCG 的 `templates/engine/strategies/*`、`codeagent-wrapper/parser.go` 往上抄设计，会轻松很多。

---

## 常见踩坑（提前避开）

- 把「策略」写进 TypeScript 状态机 → 迭代会极慢；策略应是 Claude 可读的 Markdown  
- wrapper 和 Claude 共用同一套 skills/hooks → 容易递归；wrapper 调 Claude 后端时要关 setting sources（CCG 已这么做）  
- 第一版就做完整前端/后端路由 + 5 个 MCP → 会卡在配置交互，永远到不了「能干活」  
- 任务状态只存在对话里 → 压缩后必丢；必须落盘 `task.json`

---

## 一句话起步

今天就可以开干的最小目标：

> **做一个 `init`，安装一个 `/go`，再做一个能调通单一外部 CLI 的 wrapper；在真实仓库里用 `/go` 完成一次小改动。**

如果你愿意，我可以按这个路线直接在当前目录帮你搭 **M0 脚手架**（CLI + `init` + 空 `go.md` 模板），你再说一声用 TypeScript-only 还是 TS CLI + Go wrapper 一起上。

## User

你帮我新建1个项目实现M0吧，项目名就叫CCD-workflow

### Tool Read File V2

```
{"path":"C:\\Users\\liuhh\\.claude\\skills\\worktree\\SKILL.md"}
```

### Tool Read File V2

```
{"path":"C:\\Users\\liuhh\\.claude\\skills\\tdd\\SKILL.md"}
```

### Tool Get Mcp Tools

```
{"server":"cursor-app-control","toolName":"create_project","toolCallId":"call_VAWmAXBvAY7ekkZTELhSSOyh\nfc_09caeda32d7d8e32016a5855372d908192ab306e3eef007f82"}
```

### Tool Get Mcp Tools

```
{"server":"cursor-app-control","toolName":"move_agent_to_root","toolCallId":"call_mU2HjCvfjdguUCUoxfRHtylN\nfc_09caeda32d7d8e32016a5855372d988192b77e640bab58bbdb"}
```

### Tool Mcp

```
{"name":"cursor-app-control-create_project","args":{"path":"C:\\Users\\liuhh\\lhh\\202607\\CCG\\CCD-workflow"},"toolCallId":"call_lRVh3tPySOz062I1ddRnwthH\nfc_09caeda32d7d8e32016a585539e9108192b8201eb63bd7b9a8","providerIdentifier":"cursor-app-control","toolName":"create_project","smartModeApprovalOnly":false,"skipApproval":true}
```

## Assistant

项目创建工具没能完成 Git 初始化（当前 Windows 环境缺少它依赖的 `/bin/sh`）。我会保留同级目录方案，改用本地 PowerShell 初始化并继续搭建 M0。

### Tool Run Terminal Command V2

```
{}
```

### Tool Run Terminal Command V2

```
{}
```

### Tool Glob File Search

```
{"targetDirectory":"C:\\Users\\liuhh\\lhh\\202607\\CCG\\CCD-workflow","globPattern":"*"}
```

### Tool Glob File Search

```
{"targetDirectory":"C:\\Users\\liuhh\\lhh\\202607\\CCG","globPattern":"CCD-workflow"}
```

### Tool Run Terminal Command V2

### Tool Edit File V2

### Tool Edit File V2

### Tool Run Terminal Command V2

### Tool Edit File V2

### Tool Edit File V2

### Tool Edit File V2

### Tool Edit File V2

### Tool Edit File V2

### Tool Edit File V2

### Tool Run Terminal Command V2

### Tool Glob File Search

```
{"targetDirectory":"C:\\Users\\liuhh\\lhh\\202607\\CCG\\CCD-workflow","globPattern":"pnpm-lock.yaml"}
```

### Tool Glob File Search

```
{"targetDirectory":"C:\\Users\\liuhh\\lhh\\202607\\CCG\\CCD-workflow","globPattern":"dist/*"}
```

### Tool Glob File Search

```
{"targetDirectory":"C:\\Users\\liuhh\\lhh\\202607\\CCG\\CCD-workflow","globPattern":".tmp-claude/**/*"}
```

### Tool Edit File V2

### Tool Edit File V2

### Tool Edit File V2

## Assistant

已新建 `C:\Users\liuhh\lhh\202607\CCG\CCD-workflow`，完成 M0：

- TypeScript CLI：`ccd init`
- 安装 `/ccd:go` 到 `~/.claude/commands/ccd/go.md`
- `/ccd:go` 最小流程：读取项目上下文 → 判定 S/M+ → 小任务执行或大任务输出计划
- 配置了构建、类型检查、Vitest 测试和 README
- 添加了安装器测试：`src/commands/init.test.ts`

主要文件：
- `src/cli.ts`
- `src/commands/init.ts`
- `templates/commands/go.md`
- `package.json`
- `README.md`

本地验证命令：

```bash
cd C:\Users\liuhh\lhh\202607\CCG\CCD-workflow
pnpm install
pnpm test
pnpm typecheck
pnpm build
node bin/ccd.mjs init --install-dir .tmp-claude
```

当前终端执行器没有返回可靠结果，因此我无法确认依赖安装和测试的实际运行状态；代码与测试文件已就绪。

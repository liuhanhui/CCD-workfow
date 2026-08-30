# CCD Workflow

CCD Workflow is a minimal workflow installer for Claude Code.

This project does not directly call Claude APIs. Instead, it installs a reusable
Claude Code command template that guides Claude to inspect a repository, classify
a task, and then decide whether to implement or stop for planning.

## What this project does

- Provides a Claude Code command template named `/ccd:go`
- Installs that template into the Claude command directory
- Lets Claude follow a fixed workflow instead of acting without structure
- Helps enforce a safer flow for code tasks: analyze first, act second

## How it works with Claude

1. Install the command template with this repository.
2. Claude Code reads the installed command when you invoke `/ccd:go`.
3. The command template tells Claude to:
   - inspect repository context
   - read the project manifest
   - classify the task as simple or complex
   - either implement a small change or stop and propose a plan

This means the repository is a helper for Claude Code:

- your local codebase provides the template content
- Claude uses the template as a guided workflow
- the project itself is the installer, not the runtime executor

## M2 workflow enforced by `/ccd:go`

The installed command template contains the workflow rules:

1. Read the repository context:
   - run `git status`
   - read the first available manifest file: `package.json`, `pyproject.toml`, `go.mod`, or `Cargo.toml`
2. Classify the request:
   - **S**: a clear, single-file change
   - **M+**: multiple files, unclear scope, or behavior that needs a plan
3. State the classification and proposed next action before modifying files.
4. For **S** tasks, implement and verify the change.
5. For **M+** tasks, create `.ccd/tasks/{task-name}/task.json` and `plan.md`.
6. Stop after presenting the M+ plan, and wait for explicit approval before modifying application code.

## M3: Codex analysis

M3 adds an installed Node.js wrapper for read-only Codex analysis of M+ tasks.
It uses the official non-interactive `codex exec --json` interface and never
asks Codex to modify project files.

Before using this capability, install and authenticate the Codex CLI, then
install CCD with Codex selected:

```bash
node bin/ccd.mjs init --backend codex --force
```

CCD copies the built wrapper to `~/.claude/bin/ccd-wrapper.mjs`.

## M5: Antigravity analysis

M5 adds support for the Antigravity CLI (`agy`) as a repository-aware analysis
model:

```powershell
agy --version
node bin/ccd.mjs init --backend antigravity --force
node "$HOME\.claude\bin\ccd-wrapper.mjs" --backend antigravity --workdir "$($PWD.Path)" --prompt "Review this task: ..."
```

The wrapper invokes `agy -p` with `--output-format json`, `--mode plan`, and
`--sandbox`, then parses its response and conversation ID. It starts the CLI in
the supplied work directory, allowing Antigravity to inspect the repository
while the plan-mode prompt forbids application-file changes.

## M4: Persistent task context

M4 installs a `UserPromptSubmit` Claude Code Hook at
`~/.claude/hooks/ccd/workflow-state.cjs` and registers it in
`~/.claude/settings.json`.

Before Claude processes each prompt, the Hook reads the newest non-terminal
task from `.ccd/tasks/*/task.json` in the active project and injects its task
name, status, complexity, and next action into Claude's context.

## Why this helps

This workflow is useful when you want Claude to:

- avoid uncontrolled large-scale edits
- think before changing files
- prioritize simple, actionable changes
- explicitly surface complex tasks as plans first

## Project structure

- `bin/ccd.mjs` — CLI entrypoint for this installer
- `src/cli.ts` — command-line definition and parsing
- `src/commands/init.ts` — installs the Claude command template
- `templates/commands/go.md` — the actual command template used by Claude
- `README.md` — documentation and usage guide

## Local development

```bash
pnpm install
pnpm test
pnpm typecheck
pnpm build
node bin/ccd.mjs init --install-dir .tmp-claude
```

## Install for Claude Code

```bash
node bin/ccd.mjs init
```

This writes the command template to `~/.claude/commands/ccd/go.md` by default.

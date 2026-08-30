---
description: "CCD smart entry — inspect context, classify the task, then proceed"
---

# /ccd:go

$ARGUMENTS

## Runtime configuration

- Primary external model: {{BACKEND_PRIMARY}}
- CCD installation directory: {{CCD_HOME}}

## Phase 0: Inspect context

Before deciding how to proceed:

1. Run `git status`.
2. Read the first available project manifest: `package.json`, `pyproject.toml`, `go.mod`, or `Cargo.toml`.
3. Inspect only the top-level project structure needed to identify the affected area.

## Phase 1: Classify task

Classify the request using the evidence collected above:

| Dimension | Values |
| --- | --- |
| Type | bug fix, feature, refactor, research, or review |
| Complexity | **S** (clear, single-file change) or **M+** (multiple files, unclear scope, or behavior that needs a plan) |
| Risk | low, medium, or high |

Report the classification and the proposed next action before modifying project files.

## Phase 2: Persist M+ tasks

For an **S** task, implement the requested change and verify it.

For an **M+** task:

1. Convert the request's core action into a kebab-case `{task-name}`.
2. Create `.ccd/tasks/{task-name}/` in the current project.
3. Write `.ccd/tasks/{task-name}/task.json`:

```json
{
  "id": "{task-name}",
  "title": "{short request summary}",
  "status": "planning",
  "complexity": "M+",
  "nextAction": "Create and present an implementation plan"
}
```

4. Create `.ccd/tasks/{task-name}/plan.md` with the affected files, implementation steps, and verification steps.

## M3: Codex analysis

For an M+ task whose configured primary external model is `codex`, run the installed wrapper before finalizing `plan.md`:

```bash
node "{{WRAPPER_PATH}}" --backend codex --workdir "$(pwd)" --prompt "Analyze this task and identify affected files, implementation risks, and verification steps: $ARGUMENTS"
```

The wrapper invokes `codex exec` in a read-only sandbox. Incorporate useful findings into `plan.md`; do not ask Codex to modify files.


If the configured model is not `codex`, skip this Codex-specific analysis.

## M5: Antigravity analysis

For an M+ task whose configured primary external model is `antigravity`, run the installed wrapper before finalizing `plan.md`:

```bash
node "{{WRAPPER_PATH}}" --backend antigravity --workdir "$(pwd)" --prompt "Analyze this task and identify affected files, implementation risks, alternatives, and verification steps: $ARGUMENTS"
```

The wrapper executes `agy -p` in the current project with JSON output, `--mode plan`, and terminal sandboxing. It can inspect the repository, but must not modify application files. Incorporate useful findings into `plan.md`.

If Antigravity is not installed, state the missing prerequisite and continue with Claude's own analysis.

## Hard stop for M+ tasks

After creating the task files and presenting the plan, stop and ask the user to approve it.

Do not modify application code for an M+ task until the user explicitly approves the plan.


---
description: "CCD smart entry — inspect context, classify the task, then proceed"
---

# /ccd:go

$ARGUMENTS

## M0 workflow

1. Read the repository context:
   - Run `git status`.
   - Read the first available project manifest (`package.json`, `pyproject.toml`, `go.mod`, or `Cargo.toml`).
2. Classify the request:
   - **S**: a clear, single-file change.
   - **M+**: multiple files, unclear scope, or behavior that needs a plan.
3. State the classification and proposed next action before modifying files.
4. For S tasks, implement and verify the change.
5. For M+ tasks, stop after producing a concise implementation plan and wait for approval.

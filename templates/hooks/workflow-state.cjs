#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const TERMINAL_STATUSES = new Set([
  'completed', 'cancelled', 'canceled', 'archived',
]);

function findProjectRoot(startDir) {
  let dir = startDir;
  for (let depth = 0; depth < 20; depth += 1) {
    if (fs.existsSync(path.join(dir, '.ccd', 'tasks')) || fs.existsSync(path.join(dir, '.git'))) {
      return dir;
    }

    const parent = path.dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
  return null;
}

function getActiveTask(projectRoot) {
  const tasksDir = path.join(projectRoot, '.ccd', 'tasks');
  if (!fs.existsSync(tasksDir)) return null;

  const candidates = [];
  for (const name of fs.readdirSync(tasksDir)) {
    const taskDir = path.join(tasksDir, name);
    const taskPath = path.join(taskDir, 'task.json');
    try {
      if (!fs.statSync(taskDir).isDirectory() || !fs.existsSync(taskPath)) continue;
      const task = JSON.parse(fs.readFileSync(taskPath, 'utf8'));
      if (TERMINAL_STATUSES.has(String(task.status || '').toLowerCase())) continue;
      candidates.push({ task, taskDir, mtimeMs: fs.statSync(taskPath).mtimeMs });
    } catch {
      // Ignore malformed task entries so a hook never blocks a user prompt.
    }
  }

  candidates.sort((left, right) => right.mtimeMs - left.mtimeMs);
  return candidates[0] || null;
}

try {
  const root = findProjectRoot(process.env.CLAUDE_PROJECT_DIR || process.cwd());
  if (!root) process.exit(0);

  const active = getActiveTask(root);
  if (!active) process.exit(0);

  const { task, taskDir } = active;
  const context = [
    '<ccd-state>',
    `Task: ${task.title || task.id || path.basename(taskDir)} (${task.status || 'unknown'})`,
    `Complexity: ${task.complexity || 'unknown'}`,
    `Next: ${task.nextAction || 'Continue the active task'}`,
    `Task directory: ${taskDir}`,
    '</ccd-state>',
  ].join('\n');

  console.log(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'UserPromptSubmit',
      additionalContext: context,
    },
  }));
} catch {
  process.exit(0);
}

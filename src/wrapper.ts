#!/usr/bin/env node
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'
import { createCodexProcessSpec } from './codex/process-spec.js'

export interface CodexRunOptions {
  prompt: string
  workdir: string
}

export interface CodexResult {
  sessionId: string | null
  message: string
}

interface CodexEvent {
  type?: string
  thread_id?: string
  item?: {
    type?: string
    text?: string
  }
}

export function buildCodexArgs(options: CodexRunOptions): string[] {
  return [
    'exec',
    '--json',
    '--sandbox',
    'read-only',
    '--cd',
    options.workdir,
    options.prompt,
  ]
}

export function parseCodexEvents(output: string): CodexResult {
  let sessionId: string | null = null
  let message = ''

  for (const line of output.split(/\r?\n/)) {
    if (!line.trim()) continue

    try {
      const event = JSON.parse(line) as CodexEvent
      if (event.thread_id) sessionId = event.thread_id
      if (event.item?.type === 'agent_message' && typeof event.item.text === 'string') {
        message = event.item.text
      }
    }
    catch {
      // Codex events are expected to be JSONL; ignore incidental non-JSON output.
    }
  }

  return { sessionId, message }
}

export async function runCodex(options: CodexRunOptions): Promise<CodexResult> {
  return new Promise((resolveResult, reject) => {
    const spec = createCodexProcessSpec(buildCodexArgs(options))
    const process = spawn(spec.command, spec.args, {
      cwd: options.workdir,
      stdio: [spec.promptViaStdin ? 'pipe' : 'ignore', 'pipe', 'pipe'],
    })
    let stdout = ''
    let stderr = ''

    if (spec.promptViaStdin) {
      process.stdin?.end(options.prompt)
    }
    if (!process.stdout || !process.stderr) {
      reject(new Error('Failed to capture Codex output streams.'))
      return
    }
    process.stdout.on('data', chunk => { stdout += chunk.toString() })
    process.stderr.on('data', chunk => { stderr += chunk.toString() })
    process.on('error', error => reject(error))
    process.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`Codex exited with code ${code}: ${stderr.trim()}`))
        return
      }

      resolveResult(parseCodexEvents(stdout))
    })
  })
}

function readArgument(name: string): string | null {
  const index = process.argv.indexOf(name)
  return index >= 0 ? process.argv[index + 1] ?? null : null
}

async function main(): Promise<void> {
  const backend = readArgument('--backend')
  const workdir = readArgument('--workdir')
  const prompt = readArgument('--prompt')

  if (backend !== 'codex') {
    throw new Error('M3 supports only --backend codex.')
  }
  if (!workdir || !prompt) {
    throw new Error('Usage: ccd-wrapper --backend codex --workdir <path> --prompt <text>')
  }

  console.log(JSON.stringify(await runCodex({ workdir, prompt })))
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  })
}

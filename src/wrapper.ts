#!/usr/bin/env node
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'
import { createCodexProcessSpec } from './codex/process-spec.js'

export interface AnalysisRunOptions {
  prompt: string
  workdir: string
}

export interface AnalysisResult {
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

export function buildCodexArgs(options: AnalysisRunOptions): string[] {
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

export function buildAntigravityArgs(prompt: string): string[] {
  return [
    '--mode',
    'plan',
    '--sandbox',
    '--output-format',
    'json',
    '-p',
    prompt,
  ]
}

export function parseCodexEvents(output: string): AnalysisResult {
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

export async function runCodex(options: AnalysisRunOptions): Promise<AnalysisResult> {
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

interface AntigravityOutput {
  conversation_id?: string
  response?: string
  status?: string
  error?: string
}

export function parseAntigravityOutput(output: string): AnalysisResult {
  const result = JSON.parse(output) as AntigravityOutput
  if (result.status !== 'SUCCESS' || typeof result.response !== 'string') {
    throw new Error(result.error ?? 'Antigravity did not return a successful response.')
  }

  return {
    sessionId: result.conversation_id ?? null,
    message: result.response,
  }
}

export async function runAntigravity(options: AnalysisRunOptions): Promise<AnalysisResult> {
  return new Promise((resolveResult, reject) => {
    const child = spawn('agy', buildAntigravityArgs(options.prompt), {
      cwd: options.workdir,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    let stdout = ''
    let stderr = ''

    if (!child.stdout || !child.stderr) {
      reject(new Error('Failed to capture Antigravity output streams.'))
      return
    }

    child.stdout.on('data', chunk => { stdout += chunk.toString() })
    child.stderr.on('data', chunk => { stderr += chunk.toString() })
    child.on('error', error => reject(error))
    child.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`Antigravity CLI exited with code ${code}: ${stderr.trim()}`))
        return
      }

      try {
        resolveResult(parseAntigravityOutput(stdout))
      }
      catch (error) {
        reject(error)
      }
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

  if (!workdir || !prompt) {
    throw new Error('Usage: ccd-wrapper --backend <codex|antigravity> --workdir <path> --prompt <text>')
  }

  if (backend === 'codex') {
    console.log(JSON.stringify(await runCodex({ workdir, prompt })))
    return
  }
  if (backend === 'antigravity') {
    console.log(JSON.stringify(await runAntigravity({ workdir, prompt })))
    return
  }
  throw new Error('M5 supports --backend codex or --backend antigravity.')
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  })
}

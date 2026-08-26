
/*
解释 Claude 安装命令脚本
这段代码是一个 Claude Code 自定义命令安装器，
作用是将项目自带的命令模板文件复制到用户的 
Claude Code 配置目录中，
让用户可以在 Claude Code 里使用 /ccd:go 这样的自定义斜杠命令。
*/

import { existsSync } from 'node:fs'
import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { homedir } from 'node:os'
import { fileURLToPath } from 'node:url'
import { createDefaultConfig, writeConfig } from '../utils/config.js'
import { injectConfigVariables } from '../utils/template.js'

export function resolvePackageRoot(moduleUrl: string): string {
  const currentDir = dirname(fileURLToPath(moduleUrl))
  const candidates = [
    join(currentDir, '..'),
    join(currentDir, '..', '..'),
    join(currentDir, '..', '..', '..')
  ]

  for (const candidate of candidates) {
    if (existsSync(join(candidate, 'templates', 'commands', 'go.md'))) {
      return candidate
    }
  }

  return process.cwd()
}

const packageRoot = resolvePackageRoot(import.meta.url)

export interface InitOptions {
  installDir?: string
  force?: boolean
  backend?: string
}

export interface InstallResult {
  commandPath: string
  wrapperPath: string
  hookPath: string
  installed: boolean
}

async function installWorkflowStateHook(installDir: string): Promise<string> {
  const hookPath = join(installDir, 'hooks', 'ccd', 'workflow-state.cjs')
  const sourcePath = join(packageRoot, 'templates', 'hooks', 'workflow-state.cjs')
  await mkdir(dirname(hookPath), { recursive: true })
  await copyFile(sourcePath, hookPath)
  return hookPath
}

async function registerWorkflowStateHook(installDir: string, hookPath: string): Promise<void> {
  const settingsPath = join(installDir, 'settings.json')
  let settings: Record<string, unknown> = {}

  if (existsSync(settingsPath)) {
    settings = JSON.parse(await readFile(settingsPath, 'utf8')) as Record<string, unknown>
  }

  const hooks = (settings.hooks ?? {}) as Record<string, unknown>
  const userPromptSubmit = (hooks.UserPromptSubmit ?? []) as Array<Record<string, unknown>>
  const command = `node "${hookPath}"`
  const existing = userPromptSubmit.some((entry) =>
    Array.isArray(entry.hooks)
    && entry.hooks.some((hook: unknown) =>
      typeof hook === 'object'
      && hook !== null
      && 'command' in hook
      && (hook as { command?: unknown }).command === command,
    ),
  )

  if (!existing) {
    userPromptSubmit.push({
      matcher: '',
      hooks: [{ type: 'command', command }],
    })
  }

  hooks.UserPromptSubmit = userPromptSubmit
  settings.hooks = hooks
  await writeFile(settingsPath, JSON.stringify(settings, null, 2), 'utf8')
}

export async function installM0(options: InitOptions = {}): Promise<InstallResult> {
  const installDir = resolve(options.installDir ?? join(homedir(), '.claude'))
  const commandPath = join(installDir, 'commands', 'ccd', 'go.md')
  const templatePath = join(packageRoot, 'templates', 'commands', 'go.md')
  const wrapperPath = join(installDir, 'bin', 'ccd-wrapper.mjs')
  const wrapperSource = join(packageRoot, 'dist', 'wrapper.mjs')
  const config = createDefaultConfig(options.backend)

  await mkdir(dirname(commandPath), { recursive: true })
  await writeConfig(installDir, config)

  if (options.force || !existsSync(commandPath)) {
    const template = await readFile(templatePath, 'utf8')
    await writeFile(commandPath, injectConfigVariables(template, config, installDir), 'utf8')
  }

  if (existsSync(wrapperSource)) {
    await mkdir(dirname(wrapperPath), { recursive: true })
    await copyFile(wrapperSource, wrapperPath)
  }

  const hookPath = await installWorkflowStateHook(installDir)
  await registerWorkflowStateHook(installDir, hookPath)

  return { commandPath, wrapperPath, hookPath, installed: true }
}

export async function init(options: InitOptions = {}): Promise<void> {
  const result = await installM0(options)
  console.log(`Installed /ccd:go → ${result.commandPath}`)
}


/*
解释 Claude 安装命令脚本
这段代码是一个 Claude Code 自定义命令安装器，
作用是将项目自带的命令模板文件复制到用户的 
Claude Code 配置目录中，
让用户可以在 Claude Code 里使用 /ccd:go 这样的自定义斜杠命令。
*/

import { existsSync } from 'node:fs'
import { cp, mkdir } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { homedir } from 'node:os'
import { fileURLToPath } from 'node:url'

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
}

export interface InstallResult {
  commandPath: string
  installed: boolean
}

export async function installM0(options: InitOptions = {}): Promise<InstallResult> {
  const installDir = options.installDir ?? join(homedir(), '.claude')
  const commandPath = join(installDir, 'commands', 'ccd', 'go.md')
  const templatePath = join(packageRoot, 'templates', 'commands', 'go.md')

  await mkdir(dirname(commandPath), { recursive: true })
  await cp(templatePath, commandPath, { force: options.force ?? true })

  return { commandPath, installed: true }
}

export async function init(options: InitOptions = {}): Promise<void> {
  const result = await installM0(options)
  console.log(`Installed /ccd:go → ${result.commandPath}`)
}

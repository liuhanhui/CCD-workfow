import { describe, expect, it } from 'vitest'
import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { installM0, resolvePackageRoot } from './init.js'
import { readConfig } from '../utils/config.js'

describe('installM0', () => {
  it('installs the go command template into the target Claude directory', async () => {
    const installDir = await mkdtemp(join(tmpdir(), 'ccd-workflow-'))

    const result = await installM0({ installDir })

    expect(result.commandPath).toBe(join(installDir, 'commands', 'ccd', 'go.md'))
    await expect(readFile(result.commandPath, 'utf8')).resolves.toContain('# /ccd:go')
  })

  it('resolves the package root when the entrypoint lives in a dist folder', async () => {
    const root = await mkdtemp(join(tmpdir(), 'ccd-workflow-'))
    const distDir = join(root, 'dist')
    await mkdir(join(root, 'templates', 'commands'), { recursive: true })
    await writeFile(join(root, 'templates', 'commands', 'go.md'), '# /ccd:go')

    const resolvedRoot = resolvePackageRoot(pathToFileURL(join(distDir, 'cli.mjs')).href)

    expect(resolvedRoot).toBe(root)
  })

  it('creates configuration and injects its values into the command template', async () => {
    const installDir = await mkdtemp(join(tmpdir(), 'ccd-workflow-'))

    await installM0({ installDir, backend: 'gemini' })

    await expect(readConfig(installDir)).resolves.toMatchObject({
      general: { version: '0.2.0' },
      routing: { backendPrimary: 'gemini' },
    })
    await expect(readFile(join(installDir, 'commands', 'ccd', 'go.md'), 'utf8'))
      .resolves.toContain('Primary external model: gemini')
  })
})

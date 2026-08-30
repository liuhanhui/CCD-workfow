import { readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const projectRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const goTemplatePath = join(projectRoot, 'templates', 'commands', 'go.md')

describe('/ccd:go template', () => {
  it('defines M2 classification, task persistence, and a planning stop', async () => {
    const template = await readFile(goTemplatePath, 'utf8')

    expect(template).toContain('## Phase 0: Inspect context')
    expect(template).toContain('## Phase 1: Classify task')
    expect(template).toContain('.ccd/tasks/{task-name}/task.json')
    expect(template).toContain('"status": "planning"')
    expect(template).toContain('## Hard stop for M+ tasks')
    expect(template).toContain('## M3: Codex analysis')
    expect(template).toContain('{{WRAPPER_PATH}}')
    expect(template).toContain('--backend codex')
    expect(template).toContain('## M5: Antigravity analysis')
    expect(template).toContain('--backend antigravity')
    expect(template).toContain('agy -p')
  })
})

import { describe, expect, it } from 'vitest'
import { createCodexProcessSpec } from './process-spec'

describe('createCodexProcessSpec', () => {
  it('launches the Codex CMD shim through cmd.exe on Windows', () => {
    expect(createCodexProcessSpec(['exec', '--json'], 'win32')).toEqual({
      command: 'cmd.exe',
      args: ['/d', '/s', '/c', 'codex.cmd exec --json --sandbox read-only -'],
      promptViaStdin: true,
    })
  })

  it('launches the Codex executable directly on non-Windows platforms', () => {
    expect(createCodexProcessSpec(['exec', '--json', 'prompt'], 'linux')).toEqual({
      command: 'codex',
      args: ['exec', '--json', 'prompt'],
      promptViaStdin: false,
    })
  })
})

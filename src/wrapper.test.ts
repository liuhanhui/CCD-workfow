import { describe, expect, it } from 'vitest'
import { buildCodexArgs, parseCodexEvents } from './wrapper'

describe('Codex wrapper', () => {
  it('builds a non-interactive, read-only Codex command', () => {
    expect(buildCodexArgs({
      prompt: 'Analyze this repository.',
      workdir: 'C:/work/project',
    })).toEqual([
      'exec',
      '--json',
      '--sandbox',
      'read-only',
      '--cd',
      'C:/work/project',
      'Analyze this repository.',
    ])
  })

  it('returns the final agent message from Codex JSONL output', () => {
    const output = [
      '{"type":"thread.started","thread_id":"thread-123"}',
      '{"type":"item.completed","item":{"type":"agent_message","text":"Repository uses TypeScript."}}',
      '{"type":"turn.completed"}',
    ].join('\n')

    expect(parseCodexEvents(output)).toEqual({
      sessionId: 'thread-123',
      message: 'Repository uses TypeScript.',
    })
  })
})

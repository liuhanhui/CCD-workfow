import { describe, expect, it } from 'vitest'
import {
  buildAntigravityArgs,
  buildCodexArgs,
  parseAntigravityOutput,
  parseCodexEvents,
} from './wrapper'

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

describe('Antigravity wrapper', () => {
  it('builds a non-interactive planning command with JSON output', () => {
    expect(buildAntigravityArgs('Review this task.')).toEqual([
      '--mode',
      'plan',
      '--sandbox',
      '--output-format',
      'json',
      '-p',
      'Review this task.',
    ])
  })

  it('returns the response and conversation ID from Antigravity JSON output', () => {
    expect(parseAntigravityOutput(JSON.stringify({
      conversation_id: 'conversation-123',
      status: 'SUCCESS',
      response: 'The change affects src/wrapper.ts.',
    }))).toEqual({
      sessionId: 'conversation-123',
      message: 'The change affects src/wrapper.ts.',
    })
  })
})

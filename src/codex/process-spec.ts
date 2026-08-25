xport interface CodexProcessSpec {
  command: string
  args: string[]
  promptViaStdin: boolean
}

export function createCodexProcessSpec(args: string[], platform = process.platform): CodexProcessSpec {
  if (platform === 'win32') {
    return {
      command: 'cmd.exe',
      args: ['/d', '/s', '/c', 'codex.cmd exec --json --sandbox read-only -'],
      promptViaStdin: true,
    }
  }

  return {
    command: 'codex',
    args,
    promptViaStdin: false,
  }
}

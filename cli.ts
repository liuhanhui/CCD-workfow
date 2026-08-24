#!/usr/bin/env node
import cac from 'cac'
import { init } from './commands/init.js'

const cli = cac('ccd')

cli
  .command('init', 'Install the CCD M0 command into Claude Code')
  .option('--install-dir <path>', 'Target Claude directory; defaults to ~/.claude')
  .option('--force', 'Overwrite the existing command template')
  .action(async options => init(options))

cli.help()
cli.version('0.1.0')
cli.parse()

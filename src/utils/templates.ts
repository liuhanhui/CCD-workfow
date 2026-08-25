import type { CcdConfig } from './config.js'

export function injectConfigVariables(template: string, config: CcdConfig, installDir: string): string {
  return template
    .replaceAll('{{BACKEND_PRIMARY}}', config.routing.backendPrimary)
    .replaceAll('{{CCD_HOME}}', installDir.replaceAll('\\', '/'))
}

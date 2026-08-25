import { readFile, mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { parse, stringify } from 'smol-toml'

/*
export interface CcdConfig {
  general: {
    version: string
  }
  routing: {
    backendPrimary: string
  }
}
*/

// 1. 定义通用配置接口
export interface GeneralConfig {
  version: string;
}

// 2. 定义路由配置接口
export interface RoutingConfig {
  backendPrimary: string;
}

// 3. 定义主配置接口，引用上述两个接口
export interface CcdConfig {
  general: GeneralConfig;
  routing: RoutingConfig;
}

export function getConfigPath(installDir: string): string {
  return join(installDir, '.ccd', 'config.toml')
}

export function createDefaultConfig(backendPrimary = 'deepseek'): CcdConfig {
  return {
    general: {
      version: '0.2.0',
    },
    routing: {
      backendPrimary,
    },
  }
}

export async function writeConfig(installDir: string, config: CcdConfig): Promise<void> {
  const configPath = getConfigPath(installDir)
  await mkdir(join(installDir, '.ccd'), { recursive: true })
  await writeFile(configPath, stringify(config), 'utf8')
}

export async function readConfig(installDir: string): Promise<CcdConfig | null> {
  try {
    return parse(await readFile(getConfigPath(installDir), 'utf8')) as unknown as CcdConfig
  }
  catch {
    return null
  }
}

import { match } from 'ts-pattern'
import * as vscode from 'vscode'
import { parsedConfigRef, rawConfig } from '../config'
import { formatObject, logger } from './logger'

const buttons = {
  ignoreNodeModules: 'Ignore Node Modules',
  disableWarning: 'Disable This Warning',
} as const

export async function showNodeModulesWarningIfEnabled(packagePaths: string[], extraContext: Record<string, any> = {}) {
  logger.warn('[NODE MODULES WARNING] a change was tracked in a package.json file within a node_modules directory.', formatObject({
    paths: packagePaths,
    nodeModulesWarningDisabled: parsedConfigRef.value.disableNodeModulesWarning,
    extraContext,
  }))

  if (parsedConfigRef.value.disableNodeModulesWarning)
    return

  const result = await vscode.window.showWarningMessage(
    'Ace Imports has scanned a package.json file within a node_modules directory for dependencies. It is highly recommended that you ignore all package.json files in node_modules directories.',
    buttons.ignoreNodeModules,
    buttons.disableWarning,
  )

  match(result)
    .with(buttons.ignoreNodeModules, () => {
      rawConfig.$update('packageMatcherIgnore', [
        ...rawConfig.packageMatcherIgnore,
        '**/node_modules/**',
      ])
    })
    .with(buttons.disableWarning, () => {
      rawConfig.$update('advanced.disableNodeModulesWarning', true)
    })
    .with(undefined, () => {})
    .exhaustive()
}

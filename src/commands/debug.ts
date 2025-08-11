import type { Ref } from 'reactive-vscode'
import type semver from 'semver'
import { parsedConfigRef } from '../config'
import * as Meta from '../generated/meta'
import { lastFoundPackageFilesRef } from '../state'
import { dependenciesToPrintableObject, formatObject, logError, logger, logProgressMessageBuilderFactory } from '../utils/logger'

export function performDebugCommand(activeDependenciesRef: Ref<Map<string, semver.Range>>): void {
  const lgp = logProgressMessageBuilderFactory(
    `CMD_${Meta.commands.debugPrintState}`,
  )

  try {
    logger.info(lgp('Command triggered'))

    const lines = [
      '----------------',
      '[DEBUG DATA]',
      'Current extension configuration:',
      formatObject(parsedConfigRef.value),
      '---',
      'Matched Package.json files:',
      formatObject(lastFoundPackageFilesRef.value),
      '---',
      'Active dependencies:',
      formatObject(
        dependenciesToPrintableObject(activeDependenciesRef.value),
      ),
      '----------------',
    ]
    logger.appendLine(lines.join('\n'))
  }
  catch (error) {
    logError(lgp, error)
    throw error
  }
}

import type { ExtSettingImportRule } from './types'
import path from 'node:path'
import { defineExtension } from 'reactive-vscode'
import semver from 'semver'
import { CompletionItemKind, languages } from 'vscode'
import { config } from './config'
import { getInstalledDependencies, parseDependencyDefinition } from './utils/dep-helpers'
import { formatObject, logError, logger } from './utils/logger'
import { textEditInsertAtStart } from './utils/vsc-helpers'

const { activate, deactivate } = defineExtension(() => {
  logger.info('Extension activated')
  logger.info('Extension configuration:', formatObject(config))

  languages.registerCompletionItemProvider(
    {
      scheme: 'file',
      language: 'typescript',
    },
    {
      provideCompletionItems(document) {
        try {
          logger.info('provideCompletionItems #1: Starting')
          const installedDependencies = getInstalledDependencies(
            path.dirname(document.fileName),
          )

          const notAlreadyImported
            = config.imports.filter(item => !document.getText().includes(`import * as ${item.name}`))

          const installed = notAlreadyImported.filter((item) => {
            const dependency = item.dependency
            if (!dependency)
              return true

            const dependencyRequirementData = parseDependencyDefinition(dependency)
            const localDependencyVersionRange = installedDependencies.get(dependencyRequirementData.name)

            if (localDependencyVersionRange === '*')
              return true

            if (!localDependencyVersionRange)
              return false

            const minInstalledVersion = semver.minVersion(localDependencyVersionRange ?? '')?.version

            return semver.satisfies(minInstalledVersion ?? '', dependencyRequirementData.version ?? '*')
          })

          /**
           * If there are multiple imports that use the same name, we
           * need to remove duplicates, selecting the best fit for each.
           * The quality of the import is determined by the one with the
           * latest satisfied dependency.
           */

          const bestNameVersions = new Map<string, ExtSettingImportRule>() // key = name, value = the whole import rule
          installed.forEach((item) => {
            const currentBest = bestNameVersions.get(item.name)
            let itemIsBest = !currentBest || (!currentBest.dependency && !!item.dependency)

            if (!itemIsBest && item.dependency && currentBest?.dependency) {
              const currentBestVersion = parseDependencyDefinition(currentBest.dependency).version
              const itemVersion = parseDependencyDefinition(item.dependency).version

              try {
                itemIsBest
                = !currentBestVersion
                  || currentBestVersion === itemVersion
                  || currentBestVersion === '*' && itemVersion !== '*'
                  || semver.gte(semver.minVersion(itemVersion ?? '*')!, semver.minVersion(currentBestVersion ?? '*')!)
              }
              catch (error) {
                logger.error('Error comparing versions', formatObject({
                  error,
                  currentBestVersion,
                  itemVersion,
                  semverValidItemVersion: semver.valid(itemVersion),
                  itemIsBest,
                }))
              }
            }

            if (itemIsBest) {
              bestNameVersions.set(item.name, item)
            }
          })

          const finalActiveImports = Array.from(bestNameVersions.values())

          logger.info('provideCompletionItems #2: selected imports: ', formatObject(finalActiveImports))

          return finalActiveImports.map((item) => {
            const importStatement = `import * as ${item.name} from '${item.source}'`
            const labelDetail = '*'

            return ({
              label: {
                label: item.name,
                detail: labelDetail,
                description: item.source,
              },
              kind: CompletionItemKind[item.kind ?? 'Variable'],
              additionalTextEdits: [textEditInsertAtStart(`${importStatement};\n`)],
              insertText: item.name,
              detail: `Add namespace import from "${item.source}"`,
              filterText: `${item.name}${labelDetail}`,
            })
          })
        }
        catch (error) {
          logError('provideCompletionItems', error)
        }
      },
    },
  )
})

export { activate, deactivate }

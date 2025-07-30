import type { ExtSettingImportRule } from './types'
import path from 'node:path'
import { defineExtension } from 'reactive-vscode'
import semver from 'semver'
import { CompletionItemKind, languages } from 'vscode'
import { config } from './config'
import { getInstalledDependencies, parseDependencyDefinition } from './utils/dep-helpers'
import { logger } from './utils/logger'
import { textEditInsertAtStart } from './utils/vsc-helpers'

const { activate, deactivate } = defineExtension(() => {
  logger.info('Extension activated')
  languages.registerCompletionItemProvider(
    {
      language: 'typescript',
      scheme: 'file',
    },
    {
      provideCompletionItems(document) {
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

          if (!localDependencyVersionRange) {
            return false
          }
          const minInstalledVersion = semver.minVersion(localDependencyVersionRange ?? '')?.version

          return semver.satisfies(minInstalledVersion ?? '', dependencyRequirementData.version)
        })

        /**
         * If there are multiple imports that use the same name, we
         * need to remove duplicates, selecting the best fit for each.
         * The quality of the import is determined by the one with the
         * latest satisfied dependency.
         */

        const bestNameVersions = new Map<string, ExtSettingImportRule>()
        // key = name, value = the whole import rule  
        installed.forEach((item) => {
          const currentBest = bestNameVersions.get(item.name)
          let itemIsBest = !currentBest || (!currentBest.dependency && !item.dependency);

          if (item.dependency && currentBest?.dependency) {
            const currentBestVersion = parseDependencyDefinition(currentBest.dependency).version
            const itemVersion = parseDependencyDefinition(item.dependency).version

            itemIsBest = 
              itemIsBest ||
              currentBestVersion === itemVersion ||
              currentBestVersion === "*" && itemVersion !=="*" ||
              semver.gte(itemVersion, currentBestVersion)
          }
          
          if (itemIsBest) {
            bestNameVersions.set(item.name, item)
          }
        })

        const finalActiveImports = Array.from(bestNameVersions.values())

        return finalActiveImports.map((item) => {
          const importStatement = `import * as ${item.name} from '${item.source}'`

          return ({
            label: item.name,
            kind: CompletionItemKind[item.kind ?? 'Variable'],
            additionalTextEdits: [textEditInsertAtStart(`${importStatement};\n`)],
            insertText: item.name,
            detail: importStatement,
            documentation: `documentation for ${item.name}`,

          })
        })
      },
    },
  )
})

export { activate, deactivate }

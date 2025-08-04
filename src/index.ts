import type { ExtSettingImportRule, QuoteStyle } from './types'
import path from 'node:path'
import { defineExtension, watchEffect } from 'reactive-vscode'
import semver from 'semver'
import { CompletionItemKind, languages, workspace } from 'vscode'
import { parsedConfigRef } from './config'
import { getActiveDependencySpecifiers, parseImportRuleDependency } from './utils/dep-helpers'
import { env } from './utils/env'
import { dependenciesToPrintableObject, formatObject, logError, logger, logProgressMessageBuilderFactory } from './utils/logger'
import { getQuoteStyleFromConfig, getQuoteStyleUsedInCode, quoteCharacters } from './utils/quote-style'
import { textEditInsertAtStart } from './utils/vsc-helpers'

const LANGUAGES = ['javascript', 'javascriptreact', 'typescript', 'typescriptreact']

const disabledImportIds = new Set<string>()

// Have to accept disabled imports as a param so we can call it
// reactively
function fillOutDisabledImportIds(disabledImports: string[], allowedDisabledImports: string[]) {
  disabledImports.forEach((id) => {
    disabledImportIds.add(id)
  })
  allowedDisabledImports.forEach((id) => {
    disabledImportIds.delete(id)
  })
  logger.info('Evaluated disabled import IDs:', formatObject(Array.from(disabledImportIds)))
}

fillOutDisabledImportIds(parsedConfigRef.value.disabled, parsedConfigRef.value.allowDisabled)

watchEffect(() => {
  disabledImportIds.clear()
  fillOutDisabledImportIds(parsedConfigRef.value.disabled, parsedConfigRef.value.allowDisabled)
})

const { activate, deactivate } = defineExtension(() => {
  if (env.debug)
    logger.show()

  logger.info('Extension activated')
  logger.info('Extension configuration:', formatObject(parsedConfigRef.value))

  // Clear package.json read cache when package.json changes
  const packageWatcher = workspace.createFileSystemWatcher('**/package.json')
  packageWatcher.onDidChange((uri) => {
    if (uri.fsPath.includes(`${path.sep}node_modules${path.sep}`))
      return
    logger.info('package.json changed:', uri.fsPath)

    getActiveDependencySpecifiers.clearMemoCache()
  })

  // Change this workspace config detection to be an array of objects with
  // `path` and `quoteStyle` properties, so we can support multiple workspace
  // folders. Then when providing completions, we check which workspace folder
  // the document and belongs to and use the corresponding config.

  const primaryWorkspacePath = workspace.workspaceFolders?.[0]?.uri.fsPath
  if (primaryWorkspacePath) {
    logger.info('Primary workspace folder path:', primaryWorkspacePath)
  }
  const quoteStyleForWorkspace = getQuoteStyleFromConfig(primaryWorkspacePath ?? '')
  if (quoteStyleForWorkspace) {
    logger.info('Quote style from workspace formatter config:', quoteStyleForWorkspace)
  }

  // TODO: Watch formatter config files for changes and clear the memo cache

  let lastFoundQuoteStyle: QuoteStyle | undefined

  LANGUAGES.forEach((language) => {
    languages.registerCompletionItemProvider(
      {
        scheme: 'file',
        language,
      },
      {
        // TODO: Move quote detection to `resolveCompletionItem` to improve performance
        provideCompletionItems(document) {
          try {
            const lgp = logProgressMessageBuilderFactory('provideCompletionItems')
            logger.info(lgp('Starting'))

            const detectedQuoteStyle: QuoteStyle = parsedConfigRef.value.quoteStyle ?? quoteStyleForWorkspace ?? getQuoteStyleUsedInCode(document.getText()) ?? lastFoundQuoteStyle ?? 'double'
            lastFoundQuoteStyle = detectedQuoteStyle

            const quoteCharacter = quoteCharacters[detectedQuoteStyle]

            const installedDependencies = getActiveDependencySpecifiers(
              path.dirname(document.fileName),
            )

            logger.info(lgp('Detected installed dependencies'), formatObject({installedDependencies: dependenciesToPrintableObject(installedDependencies)}))

            const nonDisabledImports = parsedConfigRef.value.imports.filter((item) => {
              if (!item.id)
                return true

              return !disabledImportIds.has(item.id)
            })

            logger.info(lgp('Filtered out disabled imports'), formatObject({nonDisabledImports}))

            const notAlreadyImported
            = nonDisabledImports.filter(item => !document.getText().includes(`import * as ${item.name}`))

            logger.info(lgp('Filtered out already imported items'), formatObject({notAlreadyImported}))

            const installed = notAlreadyImported.filter((item) => {
              const dependency = item.dependency ?? item.source

              const dependencyRequirementData = parseImportRuleDependency(dependency)
              const localDependencyVersionRange = installedDependencies.get(dependencyRequirementData.name)

              if (!localDependencyVersionRange)
                return false

              const minVersion = semver.minVersion(localDependencyVersionRange)
              if (!minVersion)
                throw new Error(`Unable to determine minimum version for "${dependencyRequirementData.name}" with range "${localDependencyVersionRange.raw}"`)

              return semver.satisfies(minVersion, dependencyRequirementData.versionRange)
            })

            logger.info(lgp('Filtered out imports that are not satisfied by installed dependencies'), formatObject({installed}))

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
                const currentBestVersion = parseImportRuleDependency(currentBest.dependency).versionRange
                const itemVersion = parseImportRuleDependency(item.dependency).versionRange

                try {
                  itemIsBest
                = !currentBestVersion
                  || currentBestVersion.raw === itemVersion.raw
                  || currentBestVersion.raw === '*' && itemVersion.raw !== '*'
                  || semver.gte(semver.minVersion(itemVersion ?? '*')!, semver.minVersion(currentBestVersion ?? '*')!)
                }
                catch (error) {
                  logger.error('Error comparing versions', formatObject({
                    error,
                    currentBestVersion,
                    itemVersion,
                    itemIsBest,
                  }))
                }
              }

              if (itemIsBest) {
                bestNameVersions.set(item.name, item)
              }
            })

            logger.info(lgp('Resolved duplicate named imports'), formatObject({
              bestNameVersions: Array.from(bestNameVersions.entries()).map(([name, item]) => ({ name, item })),
            }))

            const finalActiveImports = Array.from(bestNameVersions.values())

            logger.info(lgp('Finished evaluating applicable imports'), formatObject({finalActiveImports}))

            return finalActiveImports.map((item) => {
              const importStatement = `import * as ${item.name} from ${quoteCharacter}${item.source}${quoteCharacter}`
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
})

export { activate, deactivate }

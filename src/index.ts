import type { ExtSettingImportRule, QuoteStyle } from './types'
import path from 'node:path'
import { defineExtension } from 'reactive-vscode'
import semver from 'semver'
import { CompletionItemKind, languages, workspace } from 'vscode'
import { config } from './config'
import { getActiveDependencySpecifiers, parseImportRuleDependency } from './utils/dep-helpers'
import { env } from './utils/env'
import { formatObject, logError, logger } from './utils/logger'
import { getQuoteStyleFromConfig, getQuoteStyleUsedInCode, quoteCharacters } from './utils/quote-style'
import { textEditInsertAtStart } from './utils/vsc-helpers'

const LANGUAGES = ['javascript', 'javascriptreact', 'typescript', 'typescriptreact']

const { activate, deactivate } = defineExtension(() => {
  if (env.debug)
    logger.show()

  logger.info('Extension activated')
  logger.info('Extension configuration:', formatObject(config))

  logger.info('Testing stuff: ', formatObject({
    minVersionAsterisk: semver.minVersion('*'),
  }))

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

  const primaryWorkspacePath = workspace.workspaceFolders?.[0]?.uri.fsPath;
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
            logger.info('provideCompletionItems #1: Starting')

            const detectedQuoteStyle: QuoteStyle = config.quoteStyle ?? quoteStyleForWorkspace ?? getQuoteStyleUsedInCode(document.getText()) ?? lastFoundQuoteStyle ?? 'double'
            lastFoundQuoteStyle = detectedQuoteStyle

            const quoteCharacter = quoteCharacters[detectedQuoteStyle]

            logger.info('quote style for document:', formatObject({
              configQuoteStyle: config.quoteStyle,
              documentQuoteStyle: detectedQuoteStyle,
              quoteCharacter,
            }))

            const installedDependencies = getActiveDependencySpecifiers(
              path.dirname(document.fileName),
            )

            const disabledImportIds = new Set<string>()
            config.disabled.forEach((item) => {
              if (item.startsWith('!')) {
                const id = item.slice(1)
                disabledImportIds.delete(id) // If it starts with '!', we enable it, so
              }
              else {
                disabledImportIds.add(item) // Otherwise, we disable it
              }
            })

            const enabledImports = config.imports.filter((item) => {
              if (!item.id)
                return true

              return !disabledImportIds.has(item.id)
            })

            const notAlreadyImported
            = enabledImports.filter(item => !document.getText().includes(`import * as ${item.name}`))

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

            const finalActiveImports = Array.from(bestNameVersions.values())

            logger.info('provideCompletionItems #2: selected imports: ', formatObject(finalActiveImports))

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

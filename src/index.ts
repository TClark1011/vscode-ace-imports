import type { Ref } from 'reactive-vscode'
import type { ExtSettingImportRule, QuoteStyle } from './types'
import { matchesGlob } from 'node:path'
import {
  computed,
  defineExtension,
  ref,
  useCommand,
  useDisposable,
  useWorkspaceFolders,
  watchEffect,
} from 'reactive-vscode'
import semver from 'semver'
import * as vscode from 'vscode'
import { parsedConfigRef } from './config'
import * as Meta from './generated/meta'
import {
  getActiveDependencySpecifiersFromPackage,
  parseImportRuleDependency,
} from './utils/dep-helpers'
import { env } from './utils/env'
import {
  dependenciesToPrintableObject,
  formatObject,
  logError,
  logger,
  logProgressMessageBuilderFactory,
} from './utils/logger'
import {
  getQuoteStyleFromConfig,
  getQuoteStyleUsedInCode,
  quoteCharacters,
} from './utils/quote-style'
import { textEditInsertAtStart } from './utils/vsc-helpers'

const LANGUAGES = [
  'javascript',
  'javascriptreact',
  'typescript',
  'typescriptreact',
]

const disabledImportIds = new Set<string>()

watchEffect(() => {
  disabledImportIds.clear()
  parsedConfigRef.value.disabled
    .filter(id => !parsedConfigRef.value.allowDisabled.includes(id))
    .forEach(id => disabledImportIds.add(id))

  logger.info(
    'Evaluated disabled import IDs:',
    formatObject(Array.from(disabledImportIds)),
  )
})

interface GetAvailableImportsInDocumentInput {
  document: vscode.TextDocument
  quoteStyleForWorkspace: QuoteStyle | undefined
  lastFoundQuoteStyle: QuoteStyle | undefined
  activeDependencies: Map<string, semver.Range>
}

interface GetAvailableImportsInDocumentOutput {
  imports: ExtSettingImportRule[]
  quoteStyle: QuoteStyle
}

function getAvailableImportsInDocument({
  document,
  quoteStyleForWorkspace,
  lastFoundQuoteStyle,
  activeDependencies,
}: GetAvailableImportsInDocumentInput): GetAvailableImportsInDocumentOutput {
  const lgp = logProgressMessageBuilderFactory(
    getAvailableImportsInDocument.name,
  )
  try {
    logger.info(lgp('Starting'), document.uri.fsPath)

    const detectedQuoteStyle: QuoteStyle
			= parsedConfigRef.value.quoteStyle
			  ?? quoteStyleForWorkspace
			  ?? getQuoteStyleUsedInCode(document.getText())
			  ?? lastFoundQuoteStyle
			  ?? 'double'

    const nonDisabledImports = parsedConfigRef.value.imports.filter((item) => {
      if (!item.id)
        return true

      return !disabledImportIds.has(item.id)
    })

    logger.info(
      lgp('Filtered out disabled imports'),
      formatObject({ nonDisabledImports }),
    )

    const notAlreadyImported = nonDisabledImports.filter(
      item => !document.getText().includes(`import * as ${item.name}`),
    )

    logger.info(
      lgp('Filtered out already imported items'),
      formatObject({ notAlreadyImported }),
    )

    const installed = notAlreadyImported.filter((item) => {
      const dependency = item.dependency ?? item.source

      const dependencyRequirementData = parseImportRuleDependency(dependency)
      const localDependencyVersionRange = activeDependencies.get(
        dependencyRequirementData.name,
      )

      if (!localDependencyVersionRange)
        return false

      const minVersion = semver.minVersion(localDependencyVersionRange)
      if (!minVersion) {
        throw new Error(
          `Unable to determine minimum version for "${dependencyRequirementData.name}" with range "${localDependencyVersionRange.raw}"`,
        )
      }

      return semver.satisfies(
        minVersion,
        dependencyRequirementData.versionRange,
      )
    })

    logger.info(
      lgp(
        'Filtered out imports that are not satisfied by installed dependencies',
      ),
      formatObject({ installed }),
    )

    /**
     * If there are multiple imports that use the same name, we
     * need to remove duplicates, selecting the best fit for each.
     * The quality of the import is determined by the one with the
     * latest satisfied dependency.
     */

    const bestNameVersions = new Map<string, ExtSettingImportRule>() // key = name, value = the whole import rule
    installed.forEach((item) => {
      const currentBest = bestNameVersions.get(item.name)
      let itemIsBest
				= !currentBest || (!currentBest.dependency && !!item.dependency)

      if (!itemIsBest && item.dependency && currentBest?.dependency) {
        const currentBestVersion = parseImportRuleDependency(
          currentBest.dependency,
        ).versionRange
        const itemVersion = parseImportRuleDependency(
          item.dependency,
        ).versionRange

        itemIsBest
					= !currentBestVersion
					  || currentBestVersion.raw === itemVersion.raw
					  || (currentBestVersion.raw === '*' && itemVersion.raw !== '*')
					  || semver.gte(
					    semver.minVersion(itemVersion ?? '*')!,
					    semver.minVersion(currentBestVersion ?? '*')!,
					  )
      }

      if (itemIsBest) {
        bestNameVersions.set(item.name, item)
      }
    })

    logger.info(
      lgp('Resolved duplicate named imports'),
      formatObject({
        bestNameVersions: Array.from(bestNameVersions.entries()).map(
          ([name, item]) => ({ name, item }),
        ),
      }),
    )

    const finalActiveImports = Array.from(bestNameVersions.values())

    logger.info(lgp('Final active imports'), formatObject(finalActiveImports))

    return {
      imports: finalActiveImports,
      quoteStyle: detectedQuoteStyle,
    }
  }
  catch (error) {
    logError(lgp, error)
    throw error
  }
}

const lastFoundPackageFilesRef = ref<string[]>([])

function runPostInsertActions(): Thenable<any> {
  const lgp = logProgressMessageBuilderFactory(runPostInsertActions.name)
  try {
    logger.info(lgp('Starting'))
    const actions: Thenable<any>[] = []
    if (parsedConfigRef.value.organizeImportsOnInsert) {
      logger.info(lgp('Organizing imports after insertion'))
      actions.push(
        vscode.commands.executeCommand('editor.action.organizeImports'),
      )
    }

    if (parsedConfigRef.value.formatDocumentOnInsert) {
      logger.info(lgp('Formatting document after insertion'))
      actions.push(vscode.commands.executeCommand('editor.action.formatDocument'))
    }

    return Promise.all(actions)
  }
  catch (error) {
    logError(lgp, error)
    throw error
  }
}

function useActiveDependencies(): Ref<Map<string, semver.Range>> {
  const lgp = logProgressMessageBuilderFactory(useActiveDependencies.name)
  try {
    logger.info(lgp('Starting'))

    const combinedPackageMatcherGlobRef = computed(
      () => `{${parsedConfigRef.value.packageMatcherGlobs.join(',')}}`,
    )
    const combinedPackageMatcherIgnoreGlobRef = computed(
      () => `{${parsedConfigRef.value.packageMatcherIgnoreGlobs.join(',')}}`,
    )

    // Maps file paths of package.json files to their dependencies
    const fileToDependenciesRef = ref<Map<string, Map<string, semver.Range>>>(
      new Map(),
    )

    // Detect package.json file dependencies at startup and whenever the extension settings
    // affecting package file detection change
    watchEffect(async () => {
      const lgp = logProgressMessageBuilderFactory(
        `${useActiveDependencies.name}_watchEffect_dependencyInitialization`,
      )
      try {
        logger.info(
          lgp('Starting'),
          formatObject({
            combinedPackageMatcherGlob: combinedPackageMatcherGlobRef.value,
            combinedPackageMatcherIgnoreGlob:
							combinedPackageMatcherIgnoreGlobRef.value,
          }),
        )
        const files = await vscode.workspace.findFiles(
          combinedPackageMatcherGlobRef.value,
          combinedPackageMatcherIgnoreGlobRef.value,
          20, // max results
        )
        lastFoundPackageFilesRef.value = files.map(file => file.fsPath) // Store for debugging purposes

        logger.info(
          lgp('Found package.json files'),
          formatObject(files.map(file => file.fsPath)),
        )

        const packageFilePaths = files
          .filter(file => file.fsPath.endsWith('package.json'))
          .map(uri => uri.fsPath)

        // If package file detection settings have changed such that a previously detected
        // package file should no longer be tracked, we discard it
        const freshlyDiscardedPackageFiles = [
          ...fileToDependenciesRef.value.keys(),
        ].filter(filePath => !packageFilePaths.includes(filePath))
        logger.info(
          lgp(
            'Discarding dependencies for package files that are no longer tracked',
          ),
          formatObject(freshlyDiscardedPackageFiles),
        )
        freshlyDiscardedPackageFiles.forEach((filePath) => {
          fileToDependenciesRef.value.delete(filePath)
        })

        packageFilePaths.forEach((filePath) => {
          fileToDependenciesRef.value.set(
            filePath,
            getActiveDependencySpecifiersFromPackage(filePath),
          )
        })
      }
      catch (error) {
        logError(lgp, error)
      }
    })

    const workspaceFoldersRef = useWorkspaceFolders()

    watchEffect((onCleanup) => {
      const lgp = logProgressMessageBuilderFactory(
        `${useActiveDependencies.name}_watchEffect_fileWatchers`,
      )
      try {
        logger.info(lgp('Creating file watchers for package.json files'))
        const watcher = vscode.workspace.createFileSystemWatcher(
          combinedPackageMatcherGlobRef.value,
        )
        onCleanup(() => {
          logger.info(lgp('Disposing file watcher'))
          watcher.dispose()
        })
        logger.info(lgp('Created file watcher'))

        const workspaceIgnorePatterns = (workspaceFoldersRef.value ?? []).map(
          folder =>
            `${folder.uri.fsPath}/${combinedPackageMatcherIgnoreGlobRef.value}`,
        )
        function listener(uri: vscode.Uri, eventKind: vscode.FileChangeType) {
          logger.info(
            `Package file ${vscode.FileChangeType[eventKind].toLowerCase()}: `,
            uri.fsPath,
          )

          if (
            !uri.fsPath.endsWith('package.json') // is not package.json file
            || workspaceIgnorePatterns.some(ignorePattern =>
              matchesGlob(uri.fsPath, ignorePattern),
            ) // matches any ignore pattern
          ) {
            return
          }

          if (eventKind === vscode.FileChangeType.Deleted) {
            fileToDependenciesRef.value.delete(uri.fsPath)
            return
          }

          const dependencies = getActiveDependencySpecifiersFromPackage(
            uri.fsPath,
          )
          logger.info(
            lgp('New package file dependencies'),
            formatObject({
              path: uri.fsPath,
              dependencies: dependenciesToPrintableObject(dependencies),
            }),
          )
          fileToDependenciesRef.value.set(uri.fsPath, dependencies)
        }

        watcher.onDidCreate(uri =>
          listener(uri, vscode.FileChangeType.Created),
        )
        watcher.onDidChange(uri =>
          listener(uri, vscode.FileChangeType.Changed),
        )
        watcher.onDidDelete(uri =>
          listener(uri, vscode.FileChangeType.Deleted),
        )
      }
      catch (error) {
        logError(lgp, error)
      }
    })

    const activeDependenciesRef = computed(() => {
      const combinedDependencies = new Map(
        ...fileToDependenciesRef.value.values(),
      )
      logger.info(
        'Computed active dependencies: ',
        formatObject(dependenciesToPrintableObject(combinedDependencies)),
      )
      return combinedDependencies
    })

    return activeDependenciesRef
  }
  catch (error) {
    logError(lgp, error)
    throw error
  }
}

interface ComposeImportCodeInput {
  importRule: ExtSettingImportRule
  quoteStyle: QuoteStyle
  useSemicolon: boolean
}

function composeImportCode({
  importRule,
  quoteStyle,
  useSemicolon,
}: ComposeImportCodeInput): string {
  return `import * as ${importRule.name} from ${quoteCharacters[quoteStyle]}${
    importRule.source
  }${quoteCharacters[quoteStyle]}${useSemicolon ? ';' : ''}`
}

const { activate, deactivate } = defineExtension(() => {
  const lgp = logProgressMessageBuilderFactory('defineExtension')
  try {
    if (env.debug)
      logger.show() // Auto open the logger in debug mode

    logger.info(lgp('Extension activated'))
    logger.info(
      lgp('Extension configuration'),
      formatObject(parsedConfigRef.value),
    )

    const activeDependenciesRef = useActiveDependencies()

    const primaryWorkspace = vscode.workspace.workspaceFolders?.[0]
    if (!primaryWorkspace) {
      throw new Error(
        'No primary workspace folder found. Cannot activate extension without a workspace folder.',
      )
    }

    logger.info(
      lgp('Primary workspace folder path:'),
      primaryWorkspace.uri.fsPath,
    )

    const quoteStyleForWorkspace = getQuoteStyleFromConfig(
      primaryWorkspace.uri.fsPath,
    )
    if (quoteStyleForWorkspace) {
      logger.info(
        lgp('Quote style from workspace formatter config:'),
        quoteStyleForWorkspace,
      )
    }

    let lastFoundQuoteStyle: QuoteStyle | undefined

    useCommand(Meta.commands.insertImport, async () => {
      const lgp = logProgressMessageBuilderFactory(
        `CMD_${Meta.commands.insertImport}`,
      )
      try {
        logger.info(lgp('Command triggered'))
        const activeEditor = vscode.window.activeTextEditor
        if (!activeEditor)
          return

        const { imports, quoteStyle } = getAvailableImportsInDocument({
          document: activeEditor.document,
          quoteStyleForWorkspace,
          lastFoundQuoteStyle,
          activeDependencies: activeDependenciesRef.value,
        })
        lastFoundQuoteStyle = quoteStyle

        if (!imports.length) {
          vscode.window.showInformationMessage(
            'No applicable imports found in the current document.',
          )
          return
        }

        const selectedOption = await vscode.window.showQuickPick(
          imports.map(
            (item): vscode.QuickPickItem => ({
              label: item.name,
              detail: composeImportCode({
                importRule: item,
                quoteStyle,
                useSemicolon: false,
              }),
              description: item.source,
            }),
          ),
        )

        logger.info(lgp('Selected import'), selectedOption)

        if (!selectedOption)
          return

        const selectedImportRule = imports.find(
          item => item.name === selectedOption.label,
        )
        if (!selectedImportRule) {
          throw new Error(
            `Selected import "${selectedOption}" not found in available imports.`,
          )
        }

        const importStatement = composeImportCode({
          importRule: selectedImportRule,
          quoteStyle,
          useSemicolon: parsedConfigRef.value.insertSemicolon,
        })

        // Insert the import statement at the start of the document and
        // the variable at the current cursor position
        await activeEditor.edit((editBuilder) => {
          editBuilder.insert(new vscode.Position(0, 0), `${importStatement}\n`)
          editBuilder.insert(
            activeEditor.selection.active,
            selectedImportRule.name,
          )
        })

        await vscode.commands.executeCommand(
          Meta.commands.postInsertActions,
        )
      }
      catch (error) {
        logError(lgp, error)
        throw error
      }
    })

    useCommand(Meta.commands.postInsertActions, async () => {
      await runPostInsertActions()
    })

    useCommand(Meta.commands.debugPrintState, () => {
      // Print debugging information
      logger.show()

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
      // We log all in one statement to avoid other simultaneous logs getting
      // mixed in
    })

    // Setup intellisense suggestions
    LANGUAGES.forEach((language) => {
      useDisposable(
        vscode.languages.registerCompletionItemProvider(
          {
            scheme: 'file',
            language,
          },
          {
            provideCompletionItems(document) {
              const lgp = logProgressMessageBuilderFactory(
                'provideCompletionItems',
              )

              try {
                if (parsedConfigRef.value.disableSuggestions)
                  return undefined

                logger.info(lgp('Starting'))
                if (parsedConfigRef.value.disableSuggestions) {
                  logger.info(
                    lgp(
                      'Suggestions are disabled, no completions will be provided',
                    ),
                  )
                  return undefined
                }

                const { imports, quoteStyle } = getAvailableImportsInDocument(
                  {
                    document,
                    quoteStyleForWorkspace,
                    lastFoundQuoteStyle,
                    activeDependencies: activeDependenciesRef.value,
                  },
                )
                lastFoundQuoteStyle = quoteStyle

                return imports.map((item) => {
                  const importStatement = composeImportCode({
                    importRule: item,
                    quoteStyle,
                    useSemicolon: parsedConfigRef.value.insertSemicolon,
                  })
                  const labelDetail = '*'

                  return {
                    label: {
                      label: item.name,
                      detail: labelDetail,
                      description: item.source,
                    },
                    kind: vscode.CompletionItemKind[item.kind ?? 'Variable'],
                    additionalTextEdits: [
                      textEditInsertAtStart(`${importStatement}\n`),
                    ],
                    command: {
                      command: Meta.commands.postInsertActions,
                      title: 'Run Post Insert Actions',
                    },
                    insertText: item.name,
                    detail: `Add namespace import from "${item.source}"`,
                    filterText: `${item.name}${labelDetail}`,
                  }
                })
              }
              catch (error) {
                logError(lgp, error)
              }
            },
          },
        ),
      )
    })
  }
  catch (error) {
    logError(lgp, error)
  }
})

export { activate, deactivate }

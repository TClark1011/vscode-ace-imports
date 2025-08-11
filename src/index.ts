import type {
  Ref,
} from 'reactive-vscode'
import type { QuoteStyle } from './types'
import {
  defineExtension,
  ref,
  useCommand,
  useDisposable,
  watchEffect,
} from 'reactive-vscode'
import * as vscode from 'vscode'
import { performDebugCommand } from './commands/debug'
import { performInsertImportCommand } from './commands/insert-import'
import { performPostInsertActionsCommand } from './commands/post-insert-actions'
import { parsedConfigRef } from './config'
import * as Meta from './generated/meta'
import { composeImportCode } from './utils/compose-import-code'
import { env } from './utils/env'
import { getAvailableImportsInDocument } from './utils/get-available-imports-in-document'
import {
  formatObject,
  logError,
  logger,
  logProgressMessageBuilderFactory,
} from './utils/logger'
import {
  getQuoteStyleFromConfig,
} from './utils/quote-style'
import { useActiveDependencies } from './utils/use-active-dependencies'
import { textEditInsertAtStart } from './utils/vsc-helpers'

const LANGUAGES = [
  'javascript',
  'javascriptreact',
  'typescript',
  'typescriptreact',
]

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

    const quoteStyleForWorkspaceRef = ref(getQuoteStyleFromConfig(
      primaryWorkspace.uri.fsPath,
    ))

    watchEffect(() => {
      if (quoteStyleForWorkspaceRef.value) {
        logger.info(
          lgp('Quote style from workspace formatter config', false),
          quoteStyleForWorkspaceRef.value,
        )
      }
    })

    const lastFoundQuoteStyleRef: Ref<QuoteStyle | undefined> = ref(undefined)

    useCommand(Meta.commands.insertImport, () => performInsertImportCommand({
      quoteStyleForWorkspaceRef,
      lastFoundQuoteStyleRef,
      activeDependenciesRef,
    }))
    useCommand(Meta.commands.postInsertActions, performPostInsertActionsCommand)
    useCommand(Meta.commands.debugPrintState, () => performDebugCommand(activeDependenciesRef))

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
                    quoteStyleForWorkspace: quoteStyleForWorkspaceRef.value,
                    lastFoundQuoteStyle: lastFoundQuoteStyleRef.value,
                    activeDependencies: activeDependenciesRef.value,
                  },
                )
                lastFoundQuoteStyleRef.value = quoteStyle

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

import type { Ref } from 'reactive-vscode'
import type semver from 'semver'
import type { QuoteStyle } from '../types'
import * as vscode from 'vscode'
import { parsedConfigRef } from '../config'
import * as Meta from '../generated/meta'
import { composeImportCode } from '../utils/compose-import-code'
import { getAvailableImportsInDocument } from '../utils/get-available-imports-in-document'
import { logError, logger, logProgressMessageBuilderFactory } from '../utils/logger'

interface PerformInsertImportCommandInput {
  quoteStyleForWorkspaceRef: Ref<QuoteStyle | undefined>
  lastFoundQuoteStyleRef: Ref<QuoteStyle | undefined>
  activeDependenciesRef: Ref<Map<string, semver.Range>>
}

export async function performInsertImportCommand({
  quoteStyleForWorkspaceRef,
  lastFoundQuoteStyleRef,
  activeDependenciesRef,
}: PerformInsertImportCommandInput): Promise<void> {
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
      quoteStyleForWorkspace: quoteStyleForWorkspaceRef.value,
      lastFoundQuoteStyle: lastFoundQuoteStyleRef.value,
      activeDependencies: activeDependenciesRef.value,
    })
    lastFoundQuoteStyleRef.value = quoteStyle

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
        `Selected import "${selectedOption.label}" not found in available imports.`,
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
}

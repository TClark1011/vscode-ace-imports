import * as vscode from 'vscode'
import { parsedConfigRef } from '../config'
import * as Meta from '../generated/meta'
import { logError, logger, logProgressMessageBuilderFactory } from '../utils/logger'

export function performPostInsertActionsCommand() {
  const lgp = logProgressMessageBuilderFactory(
    `CMD_${Meta.commands.postInsertActions}`,
  )

  try {
    logger.info(lgp('Command triggered'))

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

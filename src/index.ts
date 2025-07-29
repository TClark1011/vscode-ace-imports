import { defineExtension } from 'reactive-vscode'
import { CompletionItemKind, CompletionItemTag, languages, Position, Range, TextEdit, window } from 'vscode'
import { config } from './config'

function textEditInsertAtStart(text: string) {
  return new TextEdit(
    new Range(
      new Position(0, 0),
      new Position(0, 0),
    ),
    text,
  )
}


const { activate, deactivate } = defineExtension(() => {
  const output = window.createOutputChannel('ext-name')

  output.appendLine('Extension activated!')
  
  languages.registerCompletionItemProvider(
    {
      language: 'typescript',
      scheme: 'file',
    },
    {
      provideCompletionItems(document) {
        const notAlreadyImported =
          config.imports.filter(item => 
            !document.getText().includes(`import * as ${item.name}`))
          
        return notAlreadyImported.map(item => {
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

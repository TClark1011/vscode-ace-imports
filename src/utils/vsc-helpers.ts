import { Position, Range, TextEdit } from 'vscode'

export function textEditInsertAtStart(text: string) {
  return new TextEdit(
    new Range(
      new Position(0, 0),
      new Position(0, 0),
    ),
    text,
  )
}

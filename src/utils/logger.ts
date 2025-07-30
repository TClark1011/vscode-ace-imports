import { useLogger } from 'reactive-vscode'
import { displayName } from '../generated/meta'

export const logger = useLogger(displayName)

export function formatObject(obj: Record<string, any>): string {
  return JSON.stringify(obj, null, 2)
}

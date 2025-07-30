import { useLogger } from 'reactive-vscode'
import { displayName } from '../generated/meta'

export const logger = useLogger(displayName)

export function formatObject(obj: unknown): string {
  return JSON.stringify(obj, null, 2)
}

export function logError(contextName: string, error: unknown): void {
  const unableToStringify = String(error) === '[object Object]'
  const stringifiedError = unableToStringify ? formatObject(error) : String(error)
  logger.error(`Error in ${contextName}: \n`, stringifiedError)
}

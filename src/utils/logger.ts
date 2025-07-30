import { useLogger } from 'reactive-vscode'
import { match, P } from 'ts-pattern'
import { displayName } from '../generated/meta'

export const logger = useLogger(displayName)

export function formatObject(obj: unknown): string {
  return JSON.stringify(obj, null, 2)
}

export function logError(contextName: string, error: unknown): void {
  const stringifiedError: string = match(error)
    .with(P.instanceOf(Error), err => formatObject({
      name: err.name,
      message: err.message,
      stack: err.stack,
    }))
    .when(v => String(v) === '[object Object]', formatObject)
    .otherwise(v => String(v))

  logger.error(`Error in ${contextName}: \n`, stringifiedError)
}

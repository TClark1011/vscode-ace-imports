import type semver from 'semver'
import { useLogger } from 'reactive-vscode'
import { match, P } from 'ts-pattern'
import { displayName } from '../generated/meta'

export const logger = useLogger(displayName)

export function formatObject(obj: unknown): string {
  return JSON.stringify(obj, null, 2)
}

/**
 * Create a function that will create labels for logger messages that
 * includes a counter that increases with each call. This is useful for
 * logging the progress of a function.
 *
 * Intended usage is to initialize a logger message builder at the top
 * of a function and use it to create numbered log messages within the
 * function.
 */
export function logProgressMessageBuilderFactory(
  contextLabel: string,
) {
  let callNumber = 1

  return (message?: string, numbered = true) => {
    const label = `[${contextLabel}]${numbered ? ` #${callNumber}` : ''}${message ? ` (${message})` : ''}: `
    if (numbered) {
      callNumber++
    }
    return label
  }
}

/**
 * Log an error with a provided context name. Handles graceful
 * stringification of the error object.
 */
export function logError(contextName: string | ReturnType<typeof logProgressMessageBuilderFactory>, error: unknown): void {
  const contextNameString = typeof contextName === 'string' ? contextName : contextName(undefined, false)

  const stringifiedError: string = match(error)
    .with(P.instanceOf(Error), err => formatObject({
      name: err.name,
      message: err.message,
      stack: err.stack,
    }))
    .when(v => String(v) === '[object Object]', formatObject)
    .otherwise(v => String(v))

  logger.error(`[ERROR] ${contextNameString}: \n`, stringifiedError)
}

export function dependenciesToPrintableObject(dependencies: Map<string, semver.Range>): Record<string, string> {
  const result: Record<string, string> = {}

  dependencies.forEach((versionRange, name) => {
    result[name] = versionRange.raw
  })

  return result
}

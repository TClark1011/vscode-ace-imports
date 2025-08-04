import { useLogger } from 'reactive-vscode'
import { match, P } from 'ts-pattern'
import { displayName } from '../generated/meta'
import semver from 'semver';

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

/**
 * Create a function that will create labels for logger messages that
 * includes a counter that increases with each call. This is useful for
 * logging the progress of a function.
 */
export function logProgressMessageBuilderFactory(
  contextLabel: string,
) {
  let callNumber = 1;

  return (message?: string) => {
    const postfix = message ? ` (${message})` : '';
    const label = `${contextLabel} #${callNumber}${postfix}: `;
    callNumber++;
    return label;
  }
}

export function dependenciesToPrintableObject(dependencies: Map<string, semver.Range>): Record<string, string> {
  const result: Record<string, string> = {};

  dependencies.forEach((versionRange, name) => {
    result[name] = versionRange.raw;
  });

  return result;
}

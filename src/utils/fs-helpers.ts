import fs from 'node:fs'
import path from 'node:path'

type FileNameMatcher = string | RegExp | ((fileName: string) => boolean) | string[] | RegExp[]

function checkMatcher(matcher: FileNameMatcher, fileName: string): boolean {
  if (typeof matcher === 'string') {
    return fileName === matcher
  }
  else if (matcher instanceof RegExp) {
    return matcher.test(fileName)
  }
  else if (Array.isArray(matcher)) {
    return matcher.some(m => checkMatcher(m, fileName))
  }
  else if (typeof matcher === 'function') {
    return matcher(fileName)
  }
  return false
}

interface FindFileFirstUpwardsExtraOptions {
  /** Maximum depth to search upwards, defaults to 20 */
  maxDepth?: number
  /** A folder that will end the search if reached */
  alwaysStopAt?: string | undefined
}

export function findFirstFileUpwards(
  fileNameMatcher: FileNameMatcher,
  startingDir: string,
  options: FindFileFirstUpwardsExtraOptions = {},
  currentDepth: number = 0,
): string | undefined {
  const { maxDepth = 20, alwaysStopAt = undefined } = options

  if (startingDir === alwaysStopAt)
    return undefined

  if (currentDepth > maxDepth)
    return undefined

  const files = fs.readdirSync(startingDir, { withFileTypes: true })
  const matchingFile = files.find(file => file.isFile() && checkMatcher(fileNameMatcher, file.name))

  if (matchingFile)
    return `${startingDir}/${matchingFile.name}`

  return findFirstFileUpwards(
    fileNameMatcher,
    path.dirname(startingDir),
    options,
    currentDepth + 1,
  )
}

export type ConfigFileType = 'json' | 'js' | 'yaml' | 'toml' // Formats a config file might be in

type ConfigFilePropertyChecker = (documentText: string, property: string, value: any) => boolean

// Functions for quickly checking if a property with a specific value exists in a config file
// without needing to parse the whole file
export const configFileTypePropertyFinders: Record<ConfigFileType, ConfigFilePropertyChecker> = {
  json: (text, property, value) =>
    text.includes(`"${property}": ${JSON.stringify(value)}`) || text.includes(`"${property}": '${value}'`),
  js: (text, property, value) => {
    const valueForms = [
      `${value}`,
      `'${value}'`,
      `"${value}"`,
      `\`${value}\``,
      JSON.stringify(value),
    ]
    const keyForms = [
      property,
      `${property}:`,
      `"${property}":`,
      `'${property}':`,
      `${property}: `,
      `"${property}": `,
      `'${property}': `,
    ]
    for (const keyForm of keyForms) {
      for (const valueForm of valueForms) {
        if (text.includes(`${keyForm} ${valueForm}`) || text.includes(`${keyForm}${valueForm}`)) {
          return true
        }
      }
    }
    return false
  },
  yaml: (text, property, value) => {
    const valueForms = [
      `${value}`,
      `'${value}'`,
      `"${value}"`,
      `| ${value}`,
      `| '${value}'`,
      `| "${value}"`,
    ]
    const keyForms = [
      property,
      `${property}:`,
      `"${property}":`,
      `'${property}':`,
    ]
    for (const keyForm of keyForms) {
      for (const valueForm of valueForms) {
        if (text.includes(`${keyForm} ${valueForm}`) || text.includes(`${keyForm}${valueForm}`)) {
          return true
        }
      }
    }
    return false
  },
  toml: (text, property, value) => {
    const valueForms = [
      `${value}`,
      `'${value}'`,
      `"${value}"`,
      `[${value}]`,
      `[ '${value}' ]`,
      `[ "${value}" ]`,
    ]
    const keyForms = [
      property,
      `${property} =`,
      `"${property}" =`,
      `'${property}' =`,
    ]
    for (const keyForm of keyForms) {
      for (const valueForm of valueForms) {
        if (text.includes(`${keyForm} ${valueForm}`) || text.includes(`${keyForm}${valueForm}`)) {
          return true
        }
      }
    }
    return false
  },
}

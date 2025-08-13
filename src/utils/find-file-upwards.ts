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

export function findFileUpwards(
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

  return findFileUpwards(
    fileNameMatcher,
    path.dirname(startingDir),
    options,
    currentDepth + 1,
  )
}

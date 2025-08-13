import type { QuoteStyle } from '../../types'
import type { ConfigFileType } from '../fs-helpers'
import fs from 'node:fs'
import path from 'node:path'
import { configFileTypePropertyFinders, findFirstFileUpwards } from '../fs-helpers'

const prettierConfigFileNames = ['.prettierrc', '.prettierrc.json', '.prettierrc.js', '.prettierrc.yaml', '.prettierrc.toml']
const eslintConfigFileNames = ['.eslintrc', '.eslintrc.json', '.eslintrc.js', '.eslintrc.yaml', '.eslintrc.toml']

type QuoteConfigFileKind = 'prettier' | 'eslint'

export function getQuoteStyleFromConfig(workingPath: string): QuoteStyle | undefined {
  let configFileNames = prettierConfigFileNames.concat(eslintConfigFileNames)

  let quoteStyle: QuoteStyle | undefined

  while (quoteStyle === undefined && configFileNames.length > 0) {
    const configFile = findFirstFileUpwards(
      configFileNames,
      workingPath,
    )

    if (!configFile)
      return undefined

    const configContent = fs.readFileSync(configFile, 'utf-8')
    const configFileKind: QuoteConfigFileKind
			= prettierConfigFileNames.some(name => configFile.endsWith(name)) ? 'prettier' : 'eslint'

    const configFileType: ConfigFileType | undefined
		 = (configFile.endsWith('.json') || configFile.endsWith('.prettierrc') || configFile.endsWith('.eslintrc'))
		   ? 'json'
		   : configFile.endsWith('.js')
		     ? 'js'
		     : configFile.endsWith('.yaml')
		       ? 'yaml'
		       : configFile.endsWith('.toml')
		         ? 'toml'
		         : undefined

    if (!configFileType) {
      throw new Error(`Unable to determine file type for file name: ${path.basename(configFile)}`)
    }

    const propertyChecker = configFileTypePropertyFinders[configFileType]

    if (configFileKind === 'prettier') {
      if (propertyChecker(configContent, 'singleQuote', true)) {
        quoteStyle = 'single'
      }
      else if (propertyChecker(configContent, 'singleQuote', false)) {
        quoteStyle = 'double'
      }
      else {
        configFileNames = configFileNames.filter(name => !prettierConfigFileNames.includes(name))
        // Remove prettier files from search list if we didn't find a quote style
      }
    }
    else if (configFileKind === 'eslint') {
      if (propertyChecker(configContent, 'quotes', 'single')) {
        quoteStyle = 'single'
      }
      else if (propertyChecker(configContent, 'quotes', 'double')) {
        quoteStyle = 'double'
      }
      else if (propertyChecker(configContent, 'quotes', 'backtick')) {
        quoteStyle = 'backtick'
      }
      else {
        configFileNames = configFileNames.filter(name => !eslintConfigFileNames.includes(name))
        // Remove eslint files from search list if we didn't find a quote style
      }
    }
  }
  return quoteStyle
}

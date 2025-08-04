import type { ExtSettingQuoteStyle } from '../types'
import { ConfigFileType, configFileTypePropertyFinders, findFirstFileUpwards } from './fs-helpers';
import fs from 'node:fs'
import { memo } from './memo';
import { TextDocument } from 'vscode';

export function getQuoteStyleUsedInCode(text: string): ExtSettingQuoteStyle | undefined {
  const singleQuoteRegex = /'/g
  const doubleQuoteRegex = /"/g
  const backtickRegex = /`/g

  const singleQuoteCount = (text.match(singleQuoteRegex) || []).length
  const doubleQuoteCount = (text.match(doubleQuoteRegex) || []).length
  const backtickCount = (text.match(backtickRegex) || []).length

  if (singleQuoteCount > doubleQuoteCount && singleQuoteCount > backtickCount) {
    return 'single'
  }
  else if (backtickCount > doubleQuoteCount && backtickCount > singleQuoteCount) {
    return 'backtick'
  }
  else if (doubleQuoteCount >= singleQuoteCount && doubleQuoteCount >= backtickCount) {
    return 'double'
  }

  return undefined // No clear quote style found
}

export const quoteCharacters: Record<ExtSettingQuoteStyle, string> = {
  single: '\'',
  double: '"',
  backtick: '`',
}

const prettierConfigFileNames = ['.prettierrc', '.prettierrc.json', '.prettierrc.js', '.prettierrc.yaml', '.prettierrc.toml']
const eslintConfigFileNames = ['.eslintrc', '.eslintrc.json', '.eslintrc.js', '.eslintrc.yaml', '.eslintrc.toml']

type QuoteConfigFileKind = 'prettier' | 'eslint';


export const getQuoteStyleFromConfig = memo((workingPath: string): ExtSettingQuoteStyle | undefined => {
	let configFileNames = prettierConfigFileNames.concat(eslintConfigFileNames);

	let quoteStyle: ExtSettingQuoteStyle | undefined;

	while (quoteStyle === undefined && configFileNames.length > 0) {
		const configFile = findFirstFileUpwards(
			configFileNames,
			workingPath,
		)
	
		if (!configFile) return undefined
	
		const configContent = fs.readFileSync(configFile, 'utf-8');
		const configFileKind: QuoteConfigFileKind = 
			prettierConfigFileNames.some(name => configFile.endsWith(name)) ? 'prettier' : 'eslint';

		const configFileType: ConfigFileType | undefined
		 = (configFile.endsWith('.json') || configFile.endsWith('.prettierrc')) ? 'json'
			: configFile.endsWith('.js') ? 'js'
			: configFile.endsWith('.yaml') ? 'yaml'
			: configFile.endsWith('.toml') ? 'toml'
			: undefined;

		if (!configFileType) {
			throw new Error(`Unsupported config file type: ${configFile}`);
		}

		const propertyChecker = configFileTypePropertyFinders[configFileType];

		if (configFileKind === 'prettier') {
			if (propertyChecker(configContent, 'singleQuote', true)) {
				quoteStyle = 'single';
			} else if (propertyChecker(configContent, 'singleQuote', false)) {
				quoteStyle = 'double';
			} else {
				configFileNames = configFileNames.filter(name => !prettierConfigFileNames.includes(name));
				// Remove prettier files from search list if we didn't find a quote style
			}
		} else if (configFileKind === 'eslint') {
			if (propertyChecker(configContent, 'quotes', 'single')) {
				quoteStyle = 'single';
			} else if (propertyChecker(configContent, 'quotes', 'double')) {
				quoteStyle = 'double';
			} else if (propertyChecker(configContent, 'quotes', 'backtick')) {
				quoteStyle = 'backtick';
			} else {
				configFileNames = configFileNames.filter(name => !eslintConfigFileNames.includes(name));
				// Remove eslint files from search list if we didn't find a quote style
			}
		}
	}
	return quoteStyle;
});

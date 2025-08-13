import type { ExtSettingImportRule, QuoteStyle } from '../../types'
import { quoteCharacters } from '../quotes/quote-characters'

interface ComposeImportCodeInput {
  importRule: ExtSettingImportRule
  quoteStyle: QuoteStyle
  useSemicolon: boolean
}

export function composeImportCode({
  importRule,
  quoteStyle,
  useSemicolon,
}: ComposeImportCodeInput): string {
  return `import * as ${importRule.name} from ${quoteCharacters[quoteStyle]}${
    importRule.source
  }${quoteCharacters[quoteStyle]}${useSemicolon ? ';' : ''}`
}

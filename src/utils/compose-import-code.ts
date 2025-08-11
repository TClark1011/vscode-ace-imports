import type { ExtSettingImportRule, QuoteStyle } from '../types'
import { quoteCharacters } from './quote-style'

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

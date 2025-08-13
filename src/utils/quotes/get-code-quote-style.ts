import type { QuoteStyle } from '../../types';


export function getQuoteStyleUsedInCode(text: string): QuoteStyle | undefined {
  const singleQuoteRegex = /'/g;
  const doubleQuoteRegex = /"/g;
  const backtickRegex = /`/g;

  const singleQuoteCount = (text.match(singleQuoteRegex) || []).length;
  const doubleQuoteCount = (text.match(doubleQuoteRegex) || []).length;
  const backtickCount = (text.match(backtickRegex) || []).length;

  if (singleQuoteCount > doubleQuoteCount && singleQuoteCount > backtickCount) {
    return 'single';
  }
  else if (backtickCount > doubleQuoteCount && backtickCount > singleQuoteCount) {
    return 'backtick';
  }
  else if (doubleQuoteCount >= singleQuoteCount && doubleQuoteCount >= backtickCount) {
    return 'double';
  }

  return undefined; // No clear quote style found
}

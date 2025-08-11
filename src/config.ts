import { computed, defineConfigObject } from 'reactive-vscode'
import * as Meta from './generated/meta'
import { formatObject, logger } from './utils/logger'

export const rawConfig = defineConfigObject<Meta.ScopedConfigKeyTypeMap>(
  Meta.scopedConfigs.scope,
  Meta.scopedConfigs.defaults,
)

logger.info('Raw config:', formatObject(rawConfig))

export const parsedConfigRef = computed(() => ({
  imports: rawConfig.imports.concat(rawConfig.workspaceImports),
  disabled: rawConfig.disabled,
  allowDisabled: rawConfig.workspaceAllowDisabled,
  quoteStyle: rawConfig.quoteStyle === 'auto' ? undefined : rawConfig.quoteStyle,
  packageMatcherGlobs: rawConfig.packageMatcher,
  packageMatcherIgnoreGlobs: rawConfig.packageMatcherIgnore,
  disableNodeModulesWarning: rawConfig['advanced.disableNodeModulesWarning'],
  insertSemicolon: rawConfig.insertSemicolon,
  disableSuggestions: rawConfig.disableSuggestions,
  organizeImportsOnInsert: rawConfig.organizeImportsOnInsert,
  formatDocumentOnInsert: rawConfig.formatDocumentOnInsert,
}))

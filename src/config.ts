import { computed, defineConfigObject } from 'reactive-vscode'
import * as Meta from './generated/meta'
import { formatObject, logger } from './utils/logger'

const baseConfig = defineConfigObject<Meta.ScopedConfigKeyTypeMap>(
  Meta.scopedConfigs.scope,
  Meta.scopedConfigs.defaults,
)

logger.info('Raw config:', formatObject(baseConfig))

export const parsedConfigRef = computed(() => ({
  imports: baseConfig.imports.concat(baseConfig.workspaceImports),
  disabled: baseConfig.disabled,
  allowDisabled: baseConfig.workspaceAllowDisabled,
  quoteStyle: baseConfig.quoteStyle === 'auto' ? undefined : baseConfig.quoteStyle,
}))

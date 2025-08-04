import { defineConfigObject } from 'reactive-vscode'
import * as Meta from './generated/meta'

const baseConfig = defineConfigObject<Meta.ScopedConfigKeyTypeMap>(
  Meta.scopedConfigs.scope,
  Meta.scopedConfigs.defaults,
)

export const config = {
  ...baseConfig,
  quoteStyle: baseConfig.quoteStyle || undefined, // Missing settings is defaulting to empty string for some reason
}

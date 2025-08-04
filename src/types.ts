import type * as Meta from './generated/meta'

export type ValueOf<T> = T extends Array<infer U> ? U : T[keyof T]

export type ExtSettingImportRule = ValueOf<Meta.ConfigKeyTypeMap['ace-imports.imports']>

export type ExtSettingQuoteStyle = NonNullable<Meta.ConfigKeyTypeMap['ace-imports.quoteStyle']>

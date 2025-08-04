import type * as Meta from './generated/meta'

export type ValueOf<T> = T extends Array<infer U> ? U : T[keyof T]

type StrictExclude<T, U extends T> = Exclude<T, U>;

// # Domain Types

export type ExtSettingImportRule = ValueOf<Meta.ConfigKeyTypeMap['ace-imports.imports']>

export type QuoteStyle = NonNullable<StrictExclude<Meta.ConfigKeyTypeMap['ace-imports.quoteStyle'], 'auto'>>;

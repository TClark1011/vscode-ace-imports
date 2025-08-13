import semver from 'semver'
import { match, P } from 'ts-pattern'
import * as z from 'zod/v4'

const semverSchema = z.string().refine(
  value => semver.valid(value) || semver.validRange(value),
  {
    error: 'Invalid semver version or range',
  },
)

const dependencyNameAndSpecifierSchema = z.string().pipe(
  z.transform(value => value.split('@')),
).pipe(
  z.union([
    z.tuple([z.string(), semverSchema]),
    z.tuple([z.literal(''), z.string(), semverSchema]), // scoped package like `@scope/package@^1.0.0`
    z.tuple([z.string()]), // no version specified
    z.tuple([z.literal(''), z.string()]), // scoped package without version like `@scope/package`
  ]),
).pipe(
  z.transform(value =>
    match(value)
      .returnType<[string, string?]>()
      .with(P.union(
        ['', P.string],
        ['', P.string, P.string],
      ), ([_, name, ...rest]) => [`@${name}`, ...rest])
      .otherwise(v => v),
  ),
).pipe(
  z.transform(([name, versionRange]) => ({
    name,
    versionRange: new semver.Range(versionRange ?? '*'), // if they provided a dependency without a version, we count that as any version
  })),
)

export function parseImportRuleDependency(definition: string) {
  const result = dependencyNameAndSpecifierSchema.parse(definition)
  return result
}

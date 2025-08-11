import fs from 'node:fs'
import semver from 'semver'
import { match, P } from 'ts-pattern'
import * as z from 'zod/v4'
import { dependenciesToPrintableObject, formatObject, logError, logger, logProgressMessageBuilderFactory } from './logger'
import { memo } from './memo'

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

export const parseImportRuleDependency = memo((definition: string) => {
  const result = dependencyNameAndSpecifierSchema.parse(definition)
  return result
})

const dependencyRecordSchema = z.record(z.string(), z.string())

// Does not include all properties, more will be added if needed
const packageJsonSchema = z.object({
  name: z.string(),
  version: z.string(),
  dependencies: dependencyRecordSchema,
  devDependencies: dependencyRecordSchema,
  peerDependencies: dependencyRecordSchema,
}).partial()

type PackageJson = z.output<typeof packageJsonSchema>

function readPackageJson(path: string): PackageJson {
  const rawData = fs.readFileSync(path, 'utf-8')
  const untypedParsed = JSON.parse(rawData)
  return packageJsonSchema.parse(untypedParsed)
}
export function getActiveDependencySpecifiersFromPackage(packagePath: string): Map<string, semver.Range> {
  const lgp = logProgressMessageBuilderFactory(getActiveDependencySpecifiersFromPackage.name)
  try {
    logger.info(lgp('Starting reading package.json from'), packagePath)

    const packageJson = readPackageJson(packagePath)
    logger.info(lgp('Parsed package.json file'), formatObject(packageJson))

    const dependencies = new Map<string, semver.Range>();

    [packageJson.dependencies, packageJson.devDependencies, packageJson.peerDependencies].forEach((value) => {
      Object.entries(value ?? {}).forEach(([name, version]) => {
        dependencies.set(name, new semver.Range(version))
      })
    })

    logger.info(lgp('Extracted dependencies'), formatObject(dependenciesToPrintableObject(dependencies)))

    return dependencies
  }
  catch (error) {
    logError(lgp, error)
    throw error
  }
}

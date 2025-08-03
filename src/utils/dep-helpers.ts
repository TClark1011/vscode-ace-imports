import fs from 'node:fs'
import path from 'node:path'
import semver from 'semver'
import { match, P } from 'ts-pattern'
import * as z from 'zod/v4'
import { memo } from './memo'

function fileExists(filePath: string): boolean {
  try {
    return fs.statSync(filePath).isFile()
  }
  // eslint-disable-next-line unused-imports/no-unused-vars
  catch (_) {
    return false
  }
}

const findFilesUpwards = memo((
  filename: string,
  startDir: string,
  maxDepth: number = 20,
): string[] => {
  let currentDir = path.resolve(startDir)
  let depth = 0
  const results: string[] = []

  while (depth < maxDepth) {
    const filePath = path.join(currentDir, filename)

    if (fileExists(filePath)) {
      results.push(filePath)
      break
    }

    // Move up one directory
    const parentDir = path.dirname(currentDir)

    // If we've reached the root directory and can't go up further
    if (parentDir === currentDir) {
      break
    }

    currentDir = parentDir
    depth++
  }

  return results
})

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

/**
 * Returns a map, keys are dependency names, values are their version specifiers
 * found in the nearest `package.json` files.
 */
export const getActiveDependencySpecifiers = memo((path: string): Map<string, semver.Range> => {
  const packageFilePaths = findFilesUpwards('package.json', path)

  const packages = packageFilePaths.map(readPackageJson)

  const result = new Map<string, semver.Range>()

  packages.forEach((pkg) => {
    [pkg.dependencies, pkg.devDependencies, pkg.peerDependencies].forEach((value) => {
      Object.entries(value ?? {}).forEach(([name, version]) => {
        result.set(name, new semver.Range(version))
      })
    })
  })

  return result
})

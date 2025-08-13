import fs from 'node:fs'
import semver from 'semver'
import * as z from 'zod/v4'
import { dependenciesToPrintableObject, formatObject, logError, logger, logProgressMessageBuilderFactory } from '../logger'

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

import type semver from 'semver'
import fs from 'node:fs'
import * as z from 'zod/v4'
import { dependenciesToPrintableObject, formatObject, logError, logger, logProgressMessageBuilderFactory } from '../logger'
import { semverRangeSchema } from './parse-rule-dependency'

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
    logger.info(lgp('Parsed package.json file'), formatObject({
      path: packagePath,
      parsedPackageJson: packageJson,
    }))

    const dependencies = new Map<string, semver.Range>();

    [packageJson.dependencies, packageJson.devDependencies, packageJson.peerDependencies].forEach((value) => {
      Object.entries(value ?? {}).forEach(([name, version]) => {
        dependencies.set(name, semverRangeSchema.parse(version))
      })
    })

    logger.info(lgp('Extracted dependencies'), formatObject({
      path: packagePath,
      dependencies: dependenciesToPrintableObject(dependencies),
    }))

    return dependencies
  }
  catch (error) {
    logError(lgp, error)
    throw error
  }
}

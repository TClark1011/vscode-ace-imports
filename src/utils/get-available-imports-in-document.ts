import type * as vscode from 'vscode'
import type { ExtSettingImportRule, QuoteStyle } from '../types'
import semver from 'semver'
import { parsedConfigRef } from '../config'
import { disabledImportIds } from '../state'
import { parseImportRuleDependency } from './dep-helpers'
import { formatObject, logError, logger, logProgressMessageBuilderFactory } from './logger'
import { getQuoteStyleUsedInCode } from './quote-style'

interface GetAvailableImportsInDocumentInput {
  document: vscode.TextDocument
  quoteStyleForWorkspace: QuoteStyle | undefined
  lastFoundQuoteStyle: QuoteStyle | undefined
  activeDependencies: Map<string, semver.Range>
}

interface GetAvailableImportsInDocumentOutput {
  imports: ExtSettingImportRule[]
  quoteStyle: QuoteStyle
}

export function getAvailableImportsInDocument({
  document,
  quoteStyleForWorkspace,
  lastFoundQuoteStyle,
  activeDependencies,
}: GetAvailableImportsInDocumentInput): GetAvailableImportsInDocumentOutput {
  const lgp = logProgressMessageBuilderFactory(
    getAvailableImportsInDocument.name,
  )
  try {
    logger.info(lgp('Starting'), document.uri.fsPath)

    const detectedQuoteStyle: QuoteStyle
			= parsedConfigRef.value.quoteStyle
			  ?? quoteStyleForWorkspace
			  ?? getQuoteStyleUsedInCode(document.getText())
			  ?? lastFoundQuoteStyle
			  ?? 'double'

    const nonDisabledImports = parsedConfigRef.value.imports.filter((item) => {
      if (!item.id)
        return true

      return !disabledImportIds.has(item.id)
    })

    logger.info(
      lgp('Filtered out disabled imports'),
      formatObject({ nonDisabledImports }),
    )

    const notAlreadyImported = nonDisabledImports.filter(
      item => !document.getText().includes(`import * as ${item.name}`),
    )

    logger.info(
      lgp('Filtered out already imported items'),
      formatObject({ notAlreadyImported }),
    )

    const installed = notAlreadyImported.filter((item) => {
      const dependency = item.dependency ?? item.source

      const dependencyRequirementData = parseImportRuleDependency(dependency)
      const localDependencyVersionRange = activeDependencies.get(
        dependencyRequirementData.name,
      )

      if (!localDependencyVersionRange)
        return false

      const minVersion = semver.minVersion(localDependencyVersionRange)
      if (!minVersion) {
        throw new Error(
          `Unable to determine minimum version for "${dependencyRequirementData.name}" with range "${localDependencyVersionRange.raw}"`,
        )
      }

      return semver.satisfies(
        minVersion,
        dependencyRequirementData.versionRange,
      )
    })

    logger.info(
      lgp(
        'Filtered out imports that are not satisfied by installed dependencies',
      ),
      formatObject({ installed }),
    )

    /**
     * If there are multiple imports that use the same name, we
     * need to remove duplicates, selecting the best fit for each.
     * The quality of the import is determined by the one with the
     * latest satisfied dependency.
     */

    const bestNameVersions = new Map<string, ExtSettingImportRule>() // key = name, value = the whole import rule
    installed.forEach((item) => {
      const currentBest = bestNameVersions.get(item.name)
      let itemIsBest
				= !currentBest || (!currentBest.dependency && !!item.dependency)

      if (!itemIsBest && item.dependency && currentBest?.dependency) {
        const currentBestVersion = parseImportRuleDependency(
          currentBest.dependency,
        ).versionRange
        const itemVersion = parseImportRuleDependency(
          item.dependency,
        ).versionRange

        itemIsBest
					= !currentBestVersion
					  || currentBestVersion.raw === itemVersion.raw
					  || (currentBestVersion.raw === '*' && itemVersion.raw !== '*')
					  || semver.gte(
					    semver.minVersion(itemVersion ?? '*')!,
					    semver.minVersion(currentBestVersion ?? '*')!,
					  )
      }

      if (itemIsBest) {
        bestNameVersions.set(item.name, item)
      }
    })

    logger.info(
      lgp('Resolved duplicate named imports'),
      formatObject({
        bestNameVersions: Array.from(bestNameVersions.entries()).map(
          ([name, item]) => ({ name, item }),
        ),
      }),
    )

    const finalActiveImports = Array.from(bestNameVersions.values())

    logger.info(lgp('Final active imports'), formatObject(finalActiveImports))

    return {
      imports: finalActiveImports,
      quoteStyle: detectedQuoteStyle,
    }
  }
  catch (error) {
    logError(lgp, error)
    throw error
  }
}

import type { Ref } from 'reactive-vscode'
import type semver from 'semver'
import { matchesGlob } from 'node:path/posix'
import { computed, ref, useWorkspaceFolders, watchEffect } from 'reactive-vscode'
import * as vscode from 'vscode'
import { parsedConfigRef } from '../config'
import { lastFoundPackageFilesRef } from '../state'
import { getActiveDependencySpecifiersFromPackage } from './dep-helpers'
import { dependenciesToPrintableObject, formatObject, logError, logger, logProgressMessageBuilderFactory } from './logger'

export function useActiveDependencies(): Ref<Map<string, semver.Range>> {
  const lgp = logProgressMessageBuilderFactory(useActiveDependencies.name)
  try {
    logger.info(lgp('Starting'))

    const combinedPackageMatcherGlobRef = computed(
      () => `{${parsedConfigRef.value.packageMatcherGlobs.join(',')}}`,
    )
    const combinedPackageMatcherIgnoreGlobRef = computed(
      () => `{${parsedConfigRef.value.packageMatcherIgnoreGlobs.join(',')}}`,
    )

    // Maps file paths of package.json files to their dependencies
    const fileToDependenciesRef = ref<Map<string, Map<string, semver.Range>>>(
      new Map(),
    )

    // Detect package.json file dependencies at startup and whenever the extension settings
    // affecting package file detection change
    watchEffect(async () => {
      const lgp = logProgressMessageBuilderFactory(
        `${useActiveDependencies.name}_watchEffect_dependencyInitialization`,
      )
      try {
        logger.info(
          lgp('Starting'),
          formatObject({
            combinedPackageMatcherGlob: combinedPackageMatcherGlobRef.value,
            combinedPackageMatcherIgnoreGlob: combinedPackageMatcherIgnoreGlobRef.value,
          }),
        )
        const files = await vscode.workspace.findFiles(
          combinedPackageMatcherGlobRef.value,
          combinedPackageMatcherIgnoreGlobRef.value,
          20,
        )
        lastFoundPackageFilesRef.value = files.map(file => file.fsPath) // Store for debugging purposes

        logger.info(
          lgp('Found package.json files'),
          formatObject(files.map(file => file.fsPath)),
        )

        const packageFilePaths = files
          .filter(file => file.fsPath.endsWith('package.json'))
          .map(uri => uri.fsPath)

        // If package file detection settings have changed such that a previously detected
        // package file should no longer be tracked, we discard it
        const freshlyDiscardedPackageFiles = [
          ...fileToDependenciesRef.value.keys(),
        ].filter(filePath => !packageFilePaths.includes(filePath))
        logger.info(
          lgp(
            'Discarding dependencies for package files that are no longer tracked',
          ),
          formatObject(freshlyDiscardedPackageFiles),
        )
        freshlyDiscardedPackageFiles.forEach((filePath) => {
          fileToDependenciesRef.value.delete(filePath)
        })

        packageFilePaths.forEach((filePath) => {
          fileToDependenciesRef.value.set(
            filePath,
            getActiveDependencySpecifiersFromPackage(filePath),
          )
        })
      }
      catch (error) {
        logError(lgp, error)
      }
    })

    const workspaceFoldersRef = useWorkspaceFolders()

    watchEffect((onCleanup) => {
      const lgp = logProgressMessageBuilderFactory(
        `${useActiveDependencies.name}_watchEffect_fileWatchers`,
      )
      try {
        logger.info(lgp('Creating file watchers for package.json files'))
        const watcher = vscode.workspace.createFileSystemWatcher(
          combinedPackageMatcherGlobRef.value,
        )
        onCleanup(() => {
          logger.info(lgp('Disposing file watcher'))
          watcher.dispose()
        })
        logger.info(lgp('Created file watcher'))

        const workspaceIgnorePatterns = (workspaceFoldersRef.value ?? []).map(
          folder => `${folder.uri.fsPath}/${combinedPackageMatcherIgnoreGlobRef.value}`,
        )
        function listener(uri: vscode.Uri, eventKind: vscode.FileChangeType) {
          logger.info(
            `Package file ${vscode.FileChangeType[eventKind].toLowerCase()}: `,
            uri.fsPath,
          )

          if (!uri.fsPath.endsWith('package.json') // is not package.json file
            || workspaceIgnorePatterns.some(ignorePattern => matchesGlob(uri.fsPath, ignorePattern),
            ) // matches any ignore pattern
          ) {
            return
          }

          if (eventKind === vscode.FileChangeType.Deleted) {
            fileToDependenciesRef.value.delete(uri.fsPath)
            return
          }

          const dependencies = getActiveDependencySpecifiersFromPackage(
            uri.fsPath,
          )
          logger.info(
            lgp('New package file dependencies'),
            formatObject({
              path: uri.fsPath,
              dependencies: dependenciesToPrintableObject(dependencies),
            }),
          )
          fileToDependenciesRef.value.set(uri.fsPath, dependencies)
        }

        watcher.onDidCreate(uri => listener(uri, vscode.FileChangeType.Created),
        )
        watcher.onDidChange(uri => listener(uri, vscode.FileChangeType.Changed),
        )
        watcher.onDidDelete(uri => listener(uri, vscode.FileChangeType.Deleted),
        )
      }
      catch (error) {
        logError(lgp, error)
      }
    })

    const activeDependenciesRef = computed(() => {
      const combinedDependencies = new Map(
        ...fileToDependenciesRef.value.values(),
      )
      logger.info(
        'Computed active dependencies: ',
        formatObject(dependenciesToPrintableObject(combinedDependencies)),
      )
      return combinedDependencies
    })

    return activeDependenciesRef
  }
  catch (error) {
    logError(lgp, error)
    throw error
  }
}

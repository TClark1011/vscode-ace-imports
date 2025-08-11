import { ref, watchEffect } from 'reactive-vscode'
import { parsedConfigRef } from './config'
import { formatObject, logger } from './utils/logger'

export const disabledImportIds = new Set<string>()

watchEffect(() => {
  disabledImportIds.clear()
  parsedConfigRef.value.disabled
    .filter(id => !parsedConfigRef.value.allowDisabled.includes(id))
    .forEach(id => disabledImportIds.add(id))

  logger.info(
    'Evaluated disabled import IDs:',
    formatObject(Array.from(disabledImportIds)),
  )
})

export const lastFoundPackageFilesRef = ref<string[]>([])

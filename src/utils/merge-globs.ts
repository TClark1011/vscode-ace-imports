
export function mergeGlobs(globs: string[]): string {
	if (globs.length === 0) return ''

  return `{${globs.join(',')},}`
}
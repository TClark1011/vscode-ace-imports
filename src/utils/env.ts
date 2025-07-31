import process from 'node:process'

export const env = {
  debug: process.env.VSCODE_DEBUG_MODE === 'true',
}

// @ts-check
import antfu from '@antfu/eslint-config'

export default antfu(
  {
    ignores: [
      'demos',
    ],
  },
  {
    rules: {
      'jsonc/no-useless-escape': 'off',
    },
  },
)

export type ConfigFileType = 'json' | 'js' | 'yaml' | 'toml' // Formats a config file might be in

type ConfigFilePropertyChecker = (documentText: string, property: string, value: any) => boolean

// Functions for quickly checking if a property with a specific value exists in a config file
// without needing to parse the whole file
export const configFileTypePropertyFinders: Record<ConfigFileType, ConfigFilePropertyChecker> = {
  json: (text, property, value) =>
    text.includes(`"${property}": ${JSON.stringify(value)}`) || text.includes(`"${property}": '${value}'`),
  js: (text, property, value) => {
    const valueForms = [
      `${value}`,
      `'${value}'`,
      `"${value}"`,
      `\`${value}\``,
      JSON.stringify(value),
    ]
    const keyForms = [
      property,
      `${property}:`,
      `"${property}":`,
      `'${property}':`,
      `${property}: `,
      `"${property}": `,
      `'${property}': `,
    ]
    for (const keyForm of keyForms) {
      for (const valueForm of valueForms) {
        if (text.includes(`${keyForm} ${valueForm}`) || text.includes(`${keyForm}${valueForm}`)) {
          return true
        }
      }
    }
    return false
  },
  yaml: (text, property, value) => {
    const valueForms = [
      `${value}`,
      `'${value}'`,
      `"${value}"`,
      `| ${value}`,
      `| '${value}'`,
      `| "${value}"`,
    ]
    const keyForms = [
      property,
      `${property}:`,
      `"${property}":`,
      `'${property}':`,
    ]
    for (const keyForm of keyForms) {
      for (const valueForm of valueForms) {
        if (text.includes(`${keyForm} ${valueForm}`) || text.includes(`${keyForm}${valueForm}`)) {
          return true
        }
      }
    }
    return false
  },
  toml: (text, property, value) => {
    const valueForms = [
      `${value}`,
      `'${value}'`,
      `"${value}"`,
      `[${value}]`,
      `[ '${value}' ]`,
      `[ "${value}" ]`,
    ]
    const keyForms = [
      property,
      `${property} =`,
      `"${property}" =`,
      `'${property}' =`,
    ]
    for (const keyForm of keyForms) {
      for (const valueForm of valueForms) {
        if (text.includes(`${keyForm} ${valueForm}`) || text.includes(`${keyForm}${valueForm}`)) {
          return true
        }
      }
    }
    return false
  },
}

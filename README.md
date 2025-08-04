# Ace Imports

A VS Code extension that automatically creates asterisk (aka "namespace") imports (`import * as X from 'x'`) for installed packages.

Why? Because some libraries (like `zod`) recommend using namespace imports, but VS Code's auto-import feature does not support them, so you have to manually move your cursor to the top of the file and type it out yourself which can throw off your flow. This extension solves that problem by automatically creating the import statement for you, just like VS Code's auto-import feature does for normal imports.

## Usage

To start using Ace Imports, you need to provide your import rules in the extension settings. Import rules define what imports can be created. Here is a basic example that defines an import rule for `zod`:

```json
{
  "ace-imports.imports": [
    {
      "name": "z",
      "source": "zod"
    }
  ]
}
```

This rule will create the following import statement: `import * as z from 'zod'`. `name` defines the namespace (variable name) that will be used in the import statement, and `source` defines the path from which the import is made. By default, the extension will only show an import if it's source is detected in the nearest `package.json` file, so you don't have to worry about it showing imports for packages that are not installed.

When auto-importing a namespace import, the extension will add an item to VS Code's auto-completion menu, marked with an "*", simply accept that suggestion to create the import statement.

![Screenshot of Ace Imports in action](/doc-assets/zod-suggestion-screenshot.png)

If the source of the import does not match the package name, you can specify the package name in the `dependency` field:

```json
{
  "ace-imports.imports": [
    {
      "name": "Schema",
      "source": "effect/Schema",
      "dependency": "effect"
    }
  ]
}
```

```js
import * as Schema from 'effect/Schema'
```

Additionally, you can use the `dependency` field to specify a version range for the dependency, so that the import can only be created if the correct version of the dependency is installed.

```json
{
  "ace-imports.imports": [
    {
      "name": "z",
      "source": "zod/v4",
      "dependency": "zod@^4.0.0"
    }
  ]
}
```

```js
import * as Schema from 'effect/Schema'
```

This rule will create `import * as z from 'zod/v4'`, but only if your installed version of zod is at major version 4. The range specifier supports the [semver](https://semver.org) syntax ([cheatsheet](https://devhints.io/semver)).

If you have multiple import rules with the same `name`, the one with the highest matching dependency version will be used (imports that don't specify a dependency version are counted as having a version of `0.0.0` for this comparison). For example, we could use both our our `zod` examples together like this:

```json
{
  "ace-imports.imports": [
    {
      "name": "z",
      "source": "zod"
    },
    {
      "name": "z",
      "source": "zod/v4",
      "dependency": "zod@^4.0.0"
    }
  ]
}
```

Now the extension will create `import * as z from 'zod/v4'` if you have zod version 4 installed, if you have a different version of `zod` installed it will create `import * as z from 'zod'`.

*If two matching imports have the same dependency version, their priority is determined by the order they are defined in the settings, with the last one taking priority.*

**Import Kind:** You can also specify the classification VSCode will apply to the import, which will affect the icon that is shown next to the suggestion item and possibly also the item's sorting order. This is done using the `kind` field, which accepts any of VS Code's `CompletionItemKind` enum values (when editting the settings your IDE will provide autocompletion for these). By default, the `Variable` kind is used, which is what a namespace import is actually classified as, so there isn't any situation where you need to change this, but it's there if you want to use it.

### Workspace Imports

If you have some imports that you only want to apply to a single project in addition to your main imports, you can define them in `ace-imports.workspaceImports`. Here you can define imports the exact same way as in `ace-imports.imports`, and they will be appended to your list imports. The idea is that you could define `ace-imports.imports` in your user settings, and then define `ace-imports.workspaceImports` in your workspace settings to add additional imports that are only relevant to that workspace.

```json
{
  "ace-imports.workspaceImports": [
    {
      "name": "z",
      "source": "zod/v4",
      "dependency": "zod@^4.0.0"
    }
  ]
}
```

### Disabling Imports

If you have some imports that your normally want to disable but may want enabled for some projects, you can use the `ace-imports.disabled` in your user settings to define a list of import IDs that should be disabled:

```json
{
  "ace-imports.disabled": ["zod-v4"]
}
```

Its important to note that we are referencing the import *ID*, which you have to define in the rule itself. So the above example requires you to have an import with `"id": "zod-v4"` defined in your settings.

Then in your workspace settings, you can re-enable the import by using the `ace-imports.workspaceAllowDisabled` setting:

```json
{
  "ace-imports.workspaceAllowDisabled": ["zod-v4"]
}
```

### Quote Style
You can specify the kind of quotes that should be used for the import statements using the `ace-imports.quoteStyle` setting. Can be `single`, `double`, `backtick` or `auto`, defaults to `auto`. If set to `auto` it will attempt to detect the quote style by looking at eslint/prettier config files, or the quote style used in the code. If no quote style can be detected double quotes will be used.

```json
{
  "ace-imports.quoteStyle": "single"
}
```

### Full Example Config

```json
{
  "ace-imports.imports": [{
    "name": "z",
    "source": "zod"
  }, {
    "name": "z",
    "source": "zod/v4",
    "dependency": "zod@^4.0.0"
  }, {
    "name": "z",
    "source": "zod/mini",
    "dependency": "zod@>=4",
    "id": "zod-mini",
  }],
  "ace-imports.disabled": ["zod-mini"],
  "ace-imports.quoteStyle": "single"
}
```

---

## Developing

Extension settings config is edited through `package.json`, once changes are made, run the "generate" script to generate the typescript types for the settings.

To test the extension, run the `Extension` launch configuration in VS Code. When you are finished, you may have to manually terminate the `dev` task in the terminal.

**Important:** This project uses `reactive-vscode`, so check in the docs for that when developing, it changes alot of aspects of developing VS Code extensions.

**Dependencies:** Because of `tsdown` behaviour, any dependencies that are used in the extension code must be listed in `devDependencies` in `package.json`, otherwise they will not be included in the build output.

### Debugging

**Extension Not Starting?:** If your extension doesn't appear to be starting, go to the `Output` panel and select `Extension Host` from the dropdown. Any unhandled critical extension errors are logged there.

## Releasing

To release the extension, run the "release" script, or you can run "pack" to create a `.vsix` file which can be installed manually.

## Todo

### Baseline
- [x] Prevent duplicate import statements
- [x] Description comment on left side of auto import item
- [x] Only show imports from installed packages
- [x] Add option to imports to define required dependency (eg; `zod/v4` import requires `zod@^4.0.0`)
- [x] Handle priority if multiple imports match (eg; prefer to import `zod/v4` over `zod`)
- [x] Add way to disable imports (make it a seperate option not defined in the import rule itself, that way you can disable certain imports in different projects, eg; disabling `zod/v4` even if it is installed)
- [ ] Option to specify specific package.json files to check for installed dependencies
- [x] Custom extension icon
- [ ] Improve mechanism for determining if a package is installed
- [x] Support javascript, javascriptreact and typescriptreact files
- [ ] Option to run "sort import" and/or "format document" actions after import is added
- [x] Refactor to make clear distinction between specific package version and version specifier (eg; ^4.0.0)
- [x] Clear package.json cache when package.json changes
- [x] Add new "importsExt" and "disabledExt" settings, which have the exact same typing as the "imports" and "disabled" settings, but allow you to extend your user settings with workspace settings by existing as different settings. Their arrays are appended to the non "Ext" settings, so you can disable an import in your user settings, but enable it in your workspace settings.
- [x] Option for quote style (single or double quotes)
- [ ] Publish to extension marketplace

### Later Additions

- [ ] Support type imports (eg; `import type * as X from 'x'`)
- [ ] Support default imports (eg; `import X from 'x'`)
- [ ] Allow import dependency to be based on a file existing that matches a glob (eg; importing from `~/utils` if a `src/utils.ts` file exists)
- [ ] Allow import rules to be scoped to specific files (glob is probably best way to do this) (eg; allow `zod/mini` import in `web` folder, but not in `server` folder)

### Testing
- [ ] Scoped packages eg; (`@scope/package`)

### Documentation
- [x] Basic Usage
- [ ] Disabling + Re-enabling with "!"
- [x] Import rule dependency + collision resolution
- [ ] Move development documentation to a separate file

### Todo Notes

**Improving Package Install Check:** Use `npm list` terminal command (actually use an package-manager neutral equivalent) to check if a package is installed. Rather than doing it every time we provide completions, check on startup, and then watch the package.json file for changes, and re-check when it changes. This will improve performance and reduce the number of times we have to check if a package is installed.

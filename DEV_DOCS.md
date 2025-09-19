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

- [ ] **IMPORTANT:** Ignore `package.json` files that are placed in `node_modules` by package manager workspace functionality. I think many workspace features work by sym-linking the package folders into `node_modules`.

### Baseline

- [x] Prevent duplicate import statements
- [x] Description comment on left side of auto import item
- [x] Only show imports from installed packages
- [x] Add option to imports to define required dependency (eg; `zod/v4` import requires `zod@^4.0.0`)
- [x] Handle priority if multiple imports match (eg; prefer to import `zod/v4` over `zod`)
- [x] Add way to disable imports (make it a seperate option not defined in the import rule itself, that way you can disable certain imports in different projects, eg; disabling `zod/v4` even if it is installed)
- [x] Custom extension icon
- [x] Option to specify package.json file(s) to check for installed packages
- [x] Support javascript, javascriptreact and typescriptreact files
- [x] Option to run "sort import" and/or "format document" actions after import is added
- [x] Refactor to make clear distinction between specific package version and version specifier (eg; ^4.0.0)
- [x] Clear package.json cache when package.json changes
- [x] Add new "importsExt" and "disabledExt" settings, which have the exact same typing as the "imports" and "disabled" settings, but allow you to extend your user settings with workspace settings by existing as different settings. Their arrays are appended to the non "Ext" settings, so you can disable an import in your user settings, but enable it in your workspace settings.
- [x] Option for quote style (single or double quotes)
- [x] Show warning for node_modules any time a non-ignored package.json file is found in a node_modules folder
  - When watching changes
  - When constructing dependencies
- [x] Add a command for creating imports and an option to disable completions (so the only way to create an import is through the command, in case users are annoyed by the auto-completion suggestions that are always present)
- [x] Publish to extension marketplace

### Next Up
- [ ] In node_modules warning, show the path of the violating package.json file
- [ ] Support default imports (eg; `import X from 'x'`)

### Later Improvements

#### Features

- [ ] Support `require` statements (eg; `const z = require('zod')`)
- [ ] Command to apply imports that would fix missing variable errors in the current file (eg; if a a file has an error because variables `z` and `lodash` are not defined and their are imports that match those names, then the command will automatically import them)
- [ ] Option to limit to a single package.json file (use the first found by the vscode API)
- [ ] Infer semicolon usage from config files (eg; eslint/prettier) or from the code itself
- [ ] Support type imports (eg; `import type * as X from 'x'`)
- [ ] Allow import dependency to be based on a file existing that matches a glob (eg; importing from `~/utils` if a `src/utils.ts` file exists)
- [ ] Allow import rules to be scoped to specific files (glob is probably best way to do this) (eg; allow `zod/mini` import in `web` folder, but not in `server` folder)
- [ ] Option to specify dependency detection "rules" for different files, options of rules include...
  - What files are a rule applied too
  - What `package.json` file(s) to check
  - What kind of dependencies to check (eg; `dependencies`, `devDependencies`, `optionalDependencies`)
- [ ] Option to define an array of commands to run after an import is added

#### Other Improvements

- [ ] Check for dependencies in lock files instead of `package.json` files
- [x] Handle disposal of completion provider (https://kermanx.com/reactive-vscode/guide/disposable.html)
- [ ] Split up parsed settings into individual reactive variables, so that they can be subscribed to individually, rather than having to subscribe to the whole settings object
- [ ] Move quote detection into `resolveCompletionItem` (inside the `registerCompletionItemProvider` call) method to improve performance
- [ ] Improve mechanism for determining if a package is installed

### Testing

- [x] Scoped packages eg; (`@scope/package`)

### Documentation

- [x] Basic Usage
- [x] Disabling
- [x] Import rule dependency + collision resolution
- [x] Move development documentation to a separate file

### Todo Notes

**Improving Package Install Check:** Use `npm list` terminal command (actually use an package-manager neutral equivalent) to check if a package is installed. Rather than doing it every time we provide completions, check on startup, and then watch the package.json file for changes, and re-check when it changes. This will improve performance and reduce the number of times we have to check if a package is installed.

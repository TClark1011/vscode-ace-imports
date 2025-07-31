# Ace Imports

A VS Code extension that automatically creates asterisk (aka "namespace") imports (`import * as X from 'x'`) for installed packages.

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
- [x] Prevent duplicate import statements
- [x] Description comment on left side of auto import item
- [x] Only show imports from installed packages
- [x] Add option to imports to define required dependency (eg; `zod/v4` import requires `zod@^4.0.0`)
- [x] Handle priority if multiple imports match (eg; prefer to import `zod/v4` over `zod`)
- [ ] Add way to disable imports (make it a seperate option not defined in the import rule itself, that way you can disable certain imports in different projects, eg; disabling `zod/v4` even if it is installed)
- [ ] Allow import dependency to be based on a file existing that matches a glob (eg; importing from `~/utils` if a `src/utils.ts` file exists)
- [ ] Option to specify specific package.json files to check for installed dependencies
- [ ] Default dependency to use source if not specified
- [ ] Custom extension icon
- [ ] Improve mechanism for determining if a package is installed
- [ ] Document usage
- [ ] Do not show suggestions when its not a valid usage context
- [ ] Enable for javascript (have to create a second provider with `javascript` language)
- [ ] Allow multiple names
- [ ] Option to run sort import action when accepting completion
- [x] Refactor to make clear distinction between specific package version and version specifier (eg; ^4.0.0)

### Todo Notes

**Improving Package Install Check:** Use `npm list` terminal command (actually use an package-manager neutral equivalent) to check if a package is installed. Rather than doing it every time we provide completions, check on startup, and then watch the package.json file for changes, and re-check when it changes. This will improve performance and reduce the number of times we have to check if a package is installed.

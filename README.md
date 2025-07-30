# Name To Come

## Developing

Alter the extension config (commands, settings, etc) in `package.json` and then run `ni` to update the generated files.

To test the extension, run the `Extension` launch configuration in VS Code. When you are finished, you may have to manually terminate the `dev` task in the terminal.

**Important:** This project uses `reactive-vscode`, so check in the docs for that when developing, it changes alot of aspects of developing VS Code extensions.

## Todo
- [x] Prevent duplicate import statements
- [x] Description comment on left side of auto import item
- [x] Only show imports from installed packages
- [x] Add option to imports to define required dependency (eg; `zod/v4` import requires `zod@^4.0.0`)
- [x] Handle priority if multiple imports match (eg; prefer to import `zod/v4` over `zod`)
- [ ] Add way to disable imports (make it a seperate option not defined in the import rule itself, that way you can disable certain imports in different projects, eg; disabling `zod/v4` even if it is installed)
- [ ] Allow import dependency to be based on existing of a file existing that matches a glob (eg; importing from `~/utils` if a `src/utils.ts` file exists)
- [ ] Option to manually specific package.json files to check for installed dependencies
- [x] Default dependency to use source if not specified
- [ ] Option to make the completion suggestion have higher priority than other completions (eg; so it shows up first in the list)

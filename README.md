# Name To Come

## Developing

Alter the extension config (commands, settings, etc) in `package.json` and then run `ni` to update the generated files.

To test the extension, run the `Extension` launch configuration in VS Code. When you are finished, you may have to manually terminate the `dev` task in the terminal.

**Important:** This project uses `reactive-vscode`, so check in the docs for that when developing, it changes alot of aspects of developing VS Code extensions.

## Todo
- [x] Prevent duplicate import statements
- [ ] Description comment on left side of auto import item
- [ ] Only show imports from installed packages
- [ ] Add option to imports to define required dependency (eg; `zod/v4` import requires `zod@^4.0.0`)

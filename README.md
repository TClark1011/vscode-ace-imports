# Name To Come

## Developing

Alter the extension config (commands, settings, etc) in `package.json` and then run `ni` to update the generated files.

To test the extension, run the `Extension` launch configuration in VS Code. When you are finished, you may have to manually terminate the `dev` task in the terminal.

**Important:** This project uses `reactive-vscode`, so check in the docs for that when developing, it changes alot of aspects of developing VS Code extensions.

## Todo
- [ ] Prevent duplicate import statements
- [ ] Description comment on left side of auto import item

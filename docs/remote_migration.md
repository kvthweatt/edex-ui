# Remote Module Migration Checklist

This document tracks the migration from the deprecated `@electron/remote` module to secure IPC patterns in Electron 37.

## Files with remote usage:

### src/_boot.js
- [ ] Line 33: `require('@electron/remote/main').initialize()`
- [ ] Line 195: `enableRemoteModule: true` in webPreferences

### src/_renderer.js  
- [ ] Line 40: `const remote = require("@electron/remote");`
- [ ] Line 43: `const settingsDir = remote.app.getPath("userData");`
- [ ] Line 57: `if (remote.process.argv.includes("--nointro")) {`
- [ ] Line 62: `if (electron.remote.process.argv.includes("--nocursor")) {`
- [ ] Line 207: Usage in boot screen context
- [ ] Line 246: Usage in intro theme loading
- [ ] Line 490: Usage in settings loading
- [ ] Line 606: Usage in shortcuts loading  
- [ ] Line 619: Usage in window state
- [ ] Line 805: Usage in theme management
- [ ] Line 919: Usage in keyboard management
- [ ] Line 1035: Usage in audio management
- [ ] Line 1047: Usage in update checker
- [ ] Line 1109: Usage in terminal management
- [ ] Line 1127: Usage in filesystem management
- [ ] Line 1132: Usage in modal management
- [ ] Line 1151: Usage in final initialization

### src/classes/netstat.class.js
- [ ] Line 50: Remote usage in netstat class

### src/classes/updateChecker.class.js
- [ ] Line 5: `const {ipcRenderer, remote} = require("electron");`
- [ ] Line 6: Usage of remote in update checker

### src/classes/terminal.class.js
- [ ] Line 296: Remote usage in terminal class

## Migration Strategy:
1. Create preload script to expose secure API
2. Replace remote.app.getPath() with IPC calls  
3. Replace remote.process.argv with IPC calls
4. Move all privileged operations to main process
5. Remove enableRemoteModule and set secure defaults

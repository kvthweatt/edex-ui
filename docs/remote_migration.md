# Remote Module Migration Checklist

This document tracks the migration from the deprecated `@electron/remote` module to secure IPC patterns in Electron 37.

## Files with remote usage:

### src/_boot.js
- [ ] Line 33: `require('@electron/remote/main').initialize()`
- [ ] Line 195: `enableRemoteModule: true` in webPreferences

### src/_renderer.js - ✅ COMPLETED
- [x] All electron.remote usage replaced with secure IPC bridge
- [x] Global shortcut management migrated to IPC
- [x] File system operations converted to secure methods
- [x] Window management updated to async IPC calls
- [x] WebFrame operations migrated to IPC
- [x] App control methods replaced with IPC
- [x] All direct Node.js module usage removed
- [x] Proper error handling added throughout
- [x] Context isolation fully implemented

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

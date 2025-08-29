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

### src/classes/netstat.class.js - ✅ COMPLETED
- [x] Replaced @electron/remote.app.getPath() with electronAPI.getUserDataPath()
- [x] Updated IPC logging calls to use electronAPI.send()
- [x] Added async initialization pattern for GeoIP database

### src/classes/updateChecker.class.js - ✅ COMPLETED
- [x] Replaced electron.remote with electronAPI.getAppVersion()
- [x] Updated all IPC calls to use electronAPI.send()
- [x] Replaced electron.shell.openExternal with electronAPI.shellOpenExternal()
- [x] Added async initialization pattern

### src/classes/terminal.class.js - ✅ NO MIGRATION NEEDED
- [x] No @electron/remote usage found in this file

## Migration Strategy:
1. Create preload script to expose secure API
2. Replace remote.app.getPath() with IPC calls  
3. Replace remote.process.argv with IPC calls
4. Move all privileged operations to main process
5. Remove enableRemoteModule and set secure defaults

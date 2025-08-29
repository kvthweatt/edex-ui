# WARP.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

## Project Overview

eDEX-UI is a fullscreen, cross-platform terminal emulator and system monitor built with Electron. It features a science fiction computer interface heavily inspired by the TRON Legacy movie effects. The application combines a fully featured terminal with real-time system monitoring (CPU, RAM, network), file browsing, and customizable themes with sci-fi aesthetics.

## Project Status

**⚠️ This repository has been archived since October 18th, 2021.** The project is no longer actively maintained, though the software remains functional. Issues and pull requests may not receive responses.

## High-Level Architecture

### Electron Structure
- **Main Process**: `src/_boot.js` - Creates the BrowserWindow, spawns node-pty terminal instances, manages settings, and handles IPC communication
- **Renderer Process**: `src/_renderer.js` + `src/ui.html` - Loads the UI, themes, keyboard layouts, and module classes
- **Classes**: `src/classes/` contains modular components (Terminal, FileSystem, Modal, Clock, etc.)
- **Assets**: `src/assets/` contains themes, keyboard layouts, fonts, CSS, icons, and audio files

### Communication Flow
- WebSocket transport between renderer and backend terminal instances using node-pty + ws
- IPC channels for theme/keyboard hot-switching and terminal spawning
- Multithreaded system information calls via `_multithread.js`
- Settings stored in user data directory (themes, keyboards, fonts copied there on startup)

### Module System
The UI is built from independent class-based modules:
- `terminal.class.js` - xterm.js integration with WebSocket attachment
- `filesystem.class.js` - Directory browser with file operations
- `keyboard.class.js` - On-screen keyboard with layout support
- System monitoring modules (cpuinfo, ramwatcher, netstat, toplist, etc.)
- `modal.class.js` - Error handling and dialog system

## Key Technologies & Dependencies

- **Electron 12** - Desktop application framework
- **node-pty** - Terminal backend with native process spawning
- **xterm.js** + addons - Terminal emulator with WebGL, ligatures, fit addons
- **systeminformation** - Cross-platform system data collection
- **WebSockets (ws)** - Real-time communication between processes
- **SmoothieCharts** - Real-time data visualization
- **augmented-ui** - Sci-fi CSS framework
- **howler** - Audio effects system
- **maxmind** + geolite2 - GeoIP location services
- **electron-builder** - Cross-platform binary packaging

**Build Targets**: AppImage (Linux), DMG (macOS), NSIS installer (Windows)

## Development Workflow & Commands

### Installation Commands

| Platform | Command | Notes |
|----------|---------|-------|
| **Linux/macOS** | `npm run install-linux` | Installs deps and rebuilds native modules |
| **Windows** | `npm run install-windows` | **Run in Administrator PowerShell** |

### Development Commands

| Command | Purpose |
|---------|---------|
| `npm run start` | Start development version with `--nointro` flag |
| `npm install` | Basic dependency installation (for building only) |

### Build Commands

| Platform | Command | Output |
|----------|---------|--------|
| **Linux** | `npm run build-linux` | AppImage for x64, ia32, arm64, armv7l |
| **Windows** | `npm run build-windows` | NSIS installer for x64, ia32 |
| **macOS** | `npm run build-darwin` | DMG for x64 |

**Important**: You can only build for your current platform due to native dependencies.

### Maintenance Commands

| Command | Purpose |
|---------|---------|
| `npm run init-file-icons` | Initialize file-icons git submodule |
| `npm run update-file-icons` | Update file icons and regenerate mappings |
| `npm run test` | Run security tests with Snyk |

### Build Process Details

1. **Prebuild phase**: Copies `src/` to `prebuild-src/`, minifies JS/CSS, installs production dependencies
2. **electron-builder**: Packages from `prebuild-src/` into distributable binaries
3. **Postbuild**: Cleans up temporary `prebuild-src/` directory

Native modules (especially node-pty) are rebuilt during installation for the target platform.

## Key Configuration Files

- `settings.json` - User preferences (shell, theme, keyboard, audio, etc.)
- `shortcuts.json` - Keyboard shortcuts and shell commands
- `lastWindowState.json` - Window state persistence
- Theme files in `userData/themes/` - JSON-based theming system
- Keyboard layouts in `userData/keyboards/` - Layout definitions

## Development Tips & Gotchas

### Platform-Specific Issues
- **Linux AppImage**: Requires `chmod +x` to make executable
- **Windows**: Never use `&&` command chaining in scripts - use separate commands
- **macOS**: Requires Xcode command line tools for native compilation

### Runtime Behavior  
- **Single Instance**: Only one eDEX-UI can run at a time (enforced by `app.requestSingleInstanceLock()`)
- **Proxy Variables**: `http_proxy` and `https_proxy` are deliberately unset to avoid WebSocket issues
- **Unsigned Binaries**: Binaries are intentionally unsigned - expect security warnings
- **GPU Acceleration**: Force-enabled with `--ignore-gpu-blocklist` for performance

### Theme & Customization System
- Themes support CSS injection, color customization, and font overrides
- Hot-switching available via IPC without restart
- Terminal color filters can be customized with CSS-style functions

### Debugging
- DevTools accessible via Ctrl+Shift+I (if enabled in shortcuts)
- Terminal communication logged via signale in main process
- WebSocket errors will crash the terminal connection

### Asset Management
- File icons use git submodules - run icon commands if file type detection breaks
- Fonts, themes, keyboards copied to userData on every startup (overwrites custom changes)
- Audio can be disabled but still loads initially

For detailed feature documentation, see the [project wiki](https://github.com/GitSquared/edex-ui/wiki).

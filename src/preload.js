const { contextBridge, ipcRenderer } = require('electron');
const path = require('path');

// Load TerminalBridge to handle XTerm instances in preload context
try {
  const TerminalBridge = require('./preload/terminalBridge.js');
  const terminalBridge = new TerminalBridge();
  
  // Expose terminal bridge with serializable API
  contextBridge.exposeInMainWorld('terminalBridge', {
    create: (id, parentSelector, options) => terminalBridge.create(id, parentSelector, options),
    write: (id, data) => terminalBridge.write(id, data),
    writeln: (id, data) => terminalBridge.writeln(id, data),
    resize: (id, cols, rows) => terminalBridge.resize(id, cols, rows),
    fit: (id) => terminalBridge.fit(id),
    focus: (id) => terminalBridge.focus(id),
    getDimensions: (id) => terminalBridge.getDimensions(id),
    scrollLines: (id, amount) => terminalBridge.scrollLines(id, amount),
    attachWebSocket: (id, websocket) => terminalBridge.attachWebSocket(id, websocket),
    send: (id, data) => terminalBridge.send(id, data),
    on: (id, event, callback) => terminalBridge.on(id, event, callback),
    off: (id, event, callback) => terminalBridge.off(id, event, callback),
    hasSelection: (id) => terminalBridge.hasSelection(id),
    clearSelection: (id) => terminalBridge.clearSelection(id),
    dispose: (id) => terminalBridge.dispose(id)
  });
  
  console.log('[PRELOAD] TerminalBridge loaded successfully');
} catch (error) {
  console.error('[PRELOAD] Failed to load TerminalBridge:', error);
  // Provide fallback that throws meaningful errors
  contextBridge.exposeInMainWorld('terminalBridge', {
    create: () => { throw new Error('TerminalBridge not available'); },
    write: () => { throw new Error('TerminalBridge not available'); },
    writeln: () => { throw new Error('TerminalBridge not available'); },
    resize: () => { throw new Error('TerminalBridge not available'); },
    fit: () => { throw new Error('TerminalBridge not available'); },
    focus: () => { throw new Error('TerminalBridge not available'); },
    getDimensions: () => { throw new Error('TerminalBridge not available'); },
    scrollLines: () => { throw new Error('TerminalBridge not available'); },
    attachWebSocket: () => { throw new Error('TerminalBridge not available'); },
    send: () => { throw new Error('TerminalBridge not available'); },
    on: () => { throw new Error('TerminalBridge not available'); },
    off: () => { throw new Error('TerminalBridge not available'); },
    hasSelection: () => { throw new Error('TerminalBridge not available'); },
    clearSelection: () => { throw new Error('TerminalBridge not available'); },
    dispose: () => { throw new Error('TerminalBridge not available'); }
  });
}

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // App/System info
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  getUserDataPath: () => ipcRenderer.invoke('get-user-data-path'),
  getCommandLineArgs: () => ipcRenderer.invoke('get-command-line-args'),
  
  // Settings & Configuration
  loadSettings: () => ipcRenderer.invoke('load-settings'),
  saveSettings: (settings) => ipcRenderer.invoke('save-settings', settings),
  loadShortcuts: () => ipcRenderer.invoke('load-shortcuts'),
  saveShortcuts: (shortcuts) => ipcRenderer.invoke('save-shortcuts', shortcuts),
  loadWindowState: () => ipcRenderer.invoke('load-window-state'),
  saveWindowState: (state) => ipcRenderer.invoke('save-window-state', state),
  
  // Theme & Assets
  loadTheme: (themeName) => ipcRenderer.invoke('load-theme', themeName),
  loadKeyboardLayout: (layoutName) => ipcRenderer.invoke('load-keyboard-layout', layoutName),
  
  // File System Operations
  readFile: (filePath) => ipcRenderer.invoke('read-file', filePath),
  writeFile: (filePath, content, encoding) => ipcRenderer.invoke('write-file', filePath, content, encoding),
  listDirectory: (dirPath) => ipcRenderer.invoke('list-directory', dirPath),
  readDir: (dirPath) => ipcRenderer.invoke('readdir-sync', dirPath),
  writeSettings: (settings) => ipcRenderer.invoke('write-settings', settings),
  writeWindowState: (state) => ipcRenderer.invoke('write-window-state', state),
  
  // General IPC communication
  send: (channel, data) => {
    // Whitelist channels for security
    const validChannels = [
      'log',
      'ttyspawn',
      'terminal_channel',
      'getThemeOverride',
      'setThemeOverride',
      'getKbOverride',
      'setKbOverride',
      'systeminformation-call'
    ];
    
    if (validChannels.some(prefix => channel.startsWith(prefix))) {
      ipcRenderer.send(channel, data);
    }
  },
  
  receive: (channel, func) => {
    const validChannels = [
      'ttyspawn-reply',
      'terminal_channel',
      'getThemeOverride',
      'getKbOverride',
      'systeminformation-reply'
    ];
    
    if (validChannels.some(prefix => channel.startsWith(prefix))) {
      // Deliberately strip event as it includes `sender` 
      ipcRenderer.on(channel, (event, ...args) => func(...args));
    }
  },
  
  removeAllListeners: (channel) => {
    ipcRenderer.removeAllListeners(channel);
  },
  
  // One-time communication (equivalent to ipc.once)
  once: (channel, func) => {
    const validChannels = [
      'ttyspawn-reply',
      'terminal_channel',
      'getThemeOverride',
      'getKbOverride',
      'systeminformation-reply'
    ];
    
    if (validChannels.some(prefix => channel.startsWith(prefix))) {
      ipcRenderer.once(channel, (event, ...args) => func(...args));
    }
  },
  
  // Additional methods to replace electron.remote usage
  getProcessVersions: () => ipcRenderer.invoke('get-process-versions'),
  
  // File system operations (extended)
  readFileSync: (filePath) => ipcRenderer.invoke('read-file-sync', filePath),
  writeFileSync: (filePath, content) => ipcRenderer.invoke('write-file-sync', filePath, content),
  fileExists: (filePath) => ipcRenderer.invoke('file-exists', filePath),
  readdirSync: (dirPath) => ipcRenderer.invoke('readdir-sync', dirPath),
  
  // OS information
  getPlatform: () => ipcRenderer.invoke('get-platform'),
  getUsername: () => ipcRenderer.invoke('get-username'),
  
  // Screen information
  getAllDisplays: () => ipcRenderer.invoke('get-all-displays'),
  
    // Window controls
    isWindowFullScreen: () => ipcRenderer.invoke('window-is-fullscreen'),
    setWindowFullScreen: (fullscreen) => ipcRenderer.invoke('window-set-fullscreen', fullscreen),
    minimizeWindow: () => ipcRenderer.invoke('window-minimize'),
    isWindowMaximized: () => ipcRenderer.invoke('window-is-maximized'),
    maximizeWindow: () => ipcRenderer.invoke('window-maximize'),
    unmaximizeWindow: () => ipcRenderer.invoke('window-unmaximize'),
    getWindowSize: () => ipcRenderer.invoke('window-get-size'),
    setWindowSize: (width, height) => ipcRenderer.invoke('window-set-size', width, height),
    toggleDevTools: () => ipcRenderer.invoke('toggle-dev-tools'),
    setVisualZoomLevelLimits: (min, max) => ipcRenderer.invoke('set-visual-zoom-limits', min, max),
  
  // Window event handlers
  onWindowResize: (callback) => {
    ipcRenderer.on('window-resize', callback);
  },
  onWindowLeaveFullScreen: (callback) => {
    ipcRenderer.on('window-leave-fullscreen', callback);
  },
  
  // Shell operations
  shellOpenPath: (path) => ipcRenderer.invoke('shell-open-path', path),
  shellOpenExternal: (url) => ipcRenderer.invoke('shell-open-external', url),
  
  // App controls
  appRelaunch: () => ipcRenderer.invoke('app-relaunch'),
  appQuit: () => ipcRenderer.invoke('app-quit'),
  
  // Global shortcuts
  globalShortcutRegister: (accelerator, callback) => {
    // Store callback for later use
    const callbackId = 'shortcut_' + Math.random().toString(36).substring(2, 15);
    ipcRenderer.on('global-shortcut-' + callbackId, callback);
    return ipcRenderer.invoke('global-shortcut-register', accelerator, callbackId);
  },
  globalShortcutUnregister: (accelerator) => ipcRenderer.invoke('global-shortcut-unregister', accelerator),
  globalShortcutUnregisterAll: () => ipcRenderer.invoke('global-shortcut-unregister-all'),
  
  // Web frame operations
  setVisualZoomLimits: (min, max) => ipcRenderer.invoke('set-visual-zoom-limits', min, max),
  
  // Renderer utilities (replacement for Node.js modules in renderer)
  pathJoin: (...parts) => {
    // Simple path joining implementation for renderer
    return parts.join('/').replace(/\/+/g, '/').replace(/\\/g, '/');
  },
  
  // Generate asset URLs for the renderer
  resolveAssetPath: (relativePath) => {
    // Use file:// protocol for local asset paths
    const basePath = window.location.pathname.replace('/ui.html', '');
    return `file://${basePath}/assets/${relativePath}`;
  },
  
  // Simple nanoid implementation for renderer (avoids require)
  nanoid: (size = 21) => {
    const alphabet = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
    let id = '';
    for (let i = 0; i < size; i++) {
      id += alphabet[Math.floor(Math.random() * alphabet.length)];
    }
    return id;
  },
  
  // Network operations for Netstat class
  networkPing: (target, port, localAddress) => ipcRenderer.invoke('network-ping', target, port, localAddress),
  httpsGet: (options) => ipcRenderer.invoke('https-get', options),
  
  // GeoIP operations
  geoipInit: (cacheDir) => ipcRenderer.invoke('geoip-init', cacheDir),
  geoipLookup: (ip) => ipcRenderer.invoke('geoip-lookup', ip)
});

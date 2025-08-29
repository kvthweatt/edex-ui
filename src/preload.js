const { contextBridge, ipcRenderer } = require('electron');

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
  writeFile: (filePath, content) => ipcRenderer.invoke('write-file', filePath, content),
  listDirectory: (dirPath) => ipcRenderer.invoke('list-directory', dirPath),
  
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
  }
});

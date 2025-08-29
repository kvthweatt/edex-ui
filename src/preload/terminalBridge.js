const path = require('path');

/**
 * Terminal Bridge - Keeps XTerm instances in preload context to avoid serialization issues
 * 
 * With context isolation enabled, complex objects like XTerm classes cannot be passed
 * through contextBridge. This bridge keeps all XTerm instances in the preload context
 * and exposes only serializable methods to the renderer.
 */
class TerminalBridge {
    constructor() {
        this.terminals = new Map(); // id -> terminal instance
        this.callbacks = new Map(); // id -> { onData: [], onResize: [], etc. }
        this.sockets = new Map(); // id -> websocket
        
        // Load XTerm classes in preload context where require() works
        try {
            const { Terminal } = require(path.join(__dirname, '..', 'node_modules', '@xterm', 'xterm'));
            const { FitAddon } = require(path.join(__dirname, '..', 'node_modules', '@xterm', 'addon-fit'));
            const { AttachAddon } = require(path.join(__dirname, '..', 'node_modules', '@xterm', 'addon-attach'));
            const { LigaturesAddon } = require(path.join(__dirname, '..', 'node_modules', '@xterm', 'addon-ligatures'));
            const { WebglAddon } = require(path.join(__dirname, '..', 'node_modules', '@xterm', 'addon-webgl'));
            
            this.Terminal = Terminal;
            this.FitAddon = FitAddon;
            this.AttachAddon = AttachAddon;
            this.LigaturesAddon = LigaturesAddon;
            this.WebglAddon = WebglAddon;
            
            console.log('[TERMINAL-BRIDGE] XTerm classes loaded successfully in preload context');
        } catch (error) {
            console.error('[TERMINAL-BRIDGE] Failed to load XTerm classes:', error);
            throw error;
        }
    }
    
    /**
     * Create a new terminal instance
     * @param {string} id - Unique identifier for this terminal
     * @param {string} parentSelector - CSS selector for parent element
     * @param {object} options - XTerm configuration options
     */
    create(id, parentSelector, options) {
        try {
            console.log(`[TERMINAL-BRIDGE] Creating terminal ${id} with options:`, options);
            
            // Create the terminal instance
            const terminal = new this.Terminal(options);
            
            // Create addons (but don't load ligatures yet - it needs terminal to be opened first)
            const fitAddon = new this.FitAddon();
            const webglAddon = new this.WebglAddon();
            const ligaturesAddon = new this.LigaturesAddon();
            
            // Load addons that can be loaded before opening
            terminal.loadAddon(fitAddon);
            terminal.loadAddon(webglAddon);
            
            // Store terminal and addons
            this.terminals.set(id, {
                terminal,
                fitAddon,
                webglAddon,
                ligaturesAddon,
                attachAddon: null
            });
            
            // Initialize callbacks storage
            this.callbacks.set(id, {
                onData: [],
                onResize: [],
                onTitleChange: [],
                onBell: []
            });
            
            // Set up terminal event handlers
            terminal.onData(data => {
                this._fireCallbacks(id, 'onData', data);
            });
            
            terminal.onResize(({ cols, rows }) => {
                this._fireCallbacks(id, 'onResize', { cols, rows });
            });
            
            terminal.onTitleChange(title => {
                this._fireCallbacks(id, 'onTitleChange', title);
            });
            
            terminal.onBell(() => {
                this._fireCallbacks(id, 'onBell');
            });
            
            // Wait for DOM to be ready, then open terminal
            const openTerminal = () => {
                const parentElement = document.querySelector(parentSelector);
                if (parentElement) {
                    terminal.open(parentElement);
                    
                    // Now that terminal is opened, we can load the ligatures addon
                    try {
                        terminal.loadAddon(ligaturesAddon);
                        console.log(`[TERMINAL-BRIDGE] Ligatures addon loaded for terminal ${id}`);
                    } catch (error) {
                        console.warn(`[TERMINAL-BRIDGE] Failed to load ligatures addon for terminal ${id}:`, error);
                        // Continue without ligatures - it's not critical
                    }
                    
                    fitAddon.fit();
                    terminal.focus();
                    console.log(`[TERMINAL-BRIDGE] Terminal ${id} opened successfully`);
                } else {
                    console.error(`[TERMINAL-BRIDGE] Parent element not found: ${parentSelector}`);
                    throw new Error(`Parent element not found: ${parentSelector}`);
                }
            };
            
            // If DOM is already loaded, open immediately, otherwise wait
            if (document.readyState === 'complete' || document.readyState === 'interactive') {
                openTerminal();
            } else {
                document.addEventListener('DOMContentLoaded', openTerminal);
            }
            
            return true;
        } catch (error) {
            console.error(`[TERMINAL-BRIDGE] Failed to create terminal ${id}:`, error);
            return false;
        }
    }
    
    /**
     * Write data to terminal
     */
    write(id, data) {
        const terminalData = this.terminals.get(id);
        if (terminalData) {
            terminalData.terminal.write(data);
            return true;
        }
        return false;
    }
    
    /**
     * Write line to terminal
     */
    writeln(id, data) {
        const terminalData = this.terminals.get(id);
        if (terminalData) {
            terminalData.terminal.writeln(data);
            return true;
        }
        return false;
    }
    
    /**
     * Resize terminal
     */
    resize(id, cols, rows) {
        const terminalData = this.terminals.get(id);
        if (terminalData) {
            terminalData.terminal.resize(cols, rows);
            return true;
        }
        return false;
    }
    
    /**
     * Fit terminal to container
     */
    fit(id) {
        const terminalData = this.terminals.get(id);
        if (terminalData && terminalData.fitAddon) {
            terminalData.fitAddon.fit();
            return {
                cols: terminalData.terminal.cols,
                rows: terminalData.terminal.rows
            };
        }
        return null;
    }
    
    /**
     * Focus terminal
     */
    focus(id) {
        const terminalData = this.terminals.get(id);
        if (terminalData) {
            terminalData.terminal.focus();
            return true;
        }
        return false;
    }
    
    /**
     * Get terminal dimensions
     */
    getDimensions(id) {
        const terminalData = this.terminals.get(id);
        if (terminalData) {
            return {
                cols: terminalData.terminal.cols,
                rows: terminalData.terminal.rows
            };
        }
        return null;
    }
    
    /**
     * Scroll terminal
     */
    scrollLines(id, amount) {
        const terminalData = this.terminals.get(id);
        if (terminalData) {
            terminalData.terminal.scrollLines(amount);
            return true;
        }
        return false;
    }
    
    /**
     * Attach WebSocket to terminal via URL
     * Since WebSocket objects can't cross contextBridge, we create the WebSocket here
     */
    attachWebSocket(id, websocketUrl) {
        const terminalData = this.terminals.get(id);
        if (terminalData) {
            try {
                // Create WebSocket in preload context
                const websocket = new WebSocket(websocketUrl);
                
                // Create and load attach addon
                const attachAddon = new this.AttachAddon(websocket);
                terminalData.terminal.loadAddon(attachAddon);
                terminalData.attachAddon = attachAddon;
                
                this.sockets.set(id, websocket);
                console.log(`[TERMINAL-BRIDGE] WebSocket attached to terminal ${id} at ${websocketUrl}`);
                return true;
            } catch (error) {
                console.error(`[TERMINAL-BRIDGE] Failed to attach WebSocket to terminal ${id}:`, error);
                return false;
            }
        }
        return false;
    }
    
    /**
     * Send data through WebSocket
     */
    send(id, data) {
        const socket = this.sockets.get(id);
        if (socket && socket.readyState === WebSocket.OPEN) {
            socket.send(data);
            return true;
        }
        return false;
    }
    
    /**
     * Register event callback
     */
    on(id, event, callback) {
        const callbacks = this.callbacks.get(id);
        if (callbacks && callbacks[event]) {
            callbacks[event].push(callback);
            return true;
        }
        return false;
    }
    
    /**
     * Remove event callback
     */
    off(id, event, callback) {
        const callbacks = this.callbacks.get(id);
        if (callbacks && callbacks[event]) {
            const index = callbacks[event].indexOf(callback);
            if (index !== -1) {
                callbacks[event].splice(index, 1);
                return true;
            }
        }
        return false;
    }
    
    /**
     * Check if terminal has selection
     */
    hasSelection(id) {
        const terminalData = this.terminals.get(id);
        if (terminalData) {
            return terminalData.terminal.hasSelection();
        }
        return false;
    }
    
    /**
     * Clear terminal selection
     */
    clearSelection(id) {
        const terminalData = this.terminals.get(id);
        if (terminalData) {
            terminalData.terminal.clearSelection();
            return true;
        }
        return false;
    }
    
    /**
     * Dispose terminal and clean up resources
     */
    dispose(id) {
        const terminalData = this.terminals.get(id);
        if (terminalData) {
            // Close websocket if attached
            const socket = this.sockets.get(id);
            if (socket && socket.readyState === WebSocket.OPEN) {
                socket.close();
            }
            
            // Dispose terminal
            terminalData.terminal.dispose();
            
            // Clean up stored references
            this.terminals.delete(id);
            this.callbacks.delete(id);
            this.sockets.delete(id);
            
            console.log(`[TERMINAL-BRIDGE] Terminal ${id} disposed`);
            return true;
        }
        return false;
    }
    
    /**
     * Fire callbacks for a specific event
     * @private
     */
    _fireCallbacks(id, event, ...args) {
        const callbacks = this.callbacks.get(id);
        if (callbacks && callbacks[event]) {
            callbacks[event].forEach(callback => {
                try {
                    callback(...args);
                } catch (error) {
                    console.error(`[TERMINAL-BRIDGE] Error in ${event} callback for terminal ${id}:`, error);
                }
            });
        }
    }
}

module.exports = TerminalBridge;

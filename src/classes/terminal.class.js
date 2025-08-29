class Terminal {
    constructor(opts) {
        console.log('[TERMINAL] Constructor called with opts:', opts);
        
        if (opts.role === "client") {
            console.log('[TERMINAL] Client mode - using TerminalBridge');
            if (!opts.parentId) throw "Missing options";

            // Check for TerminalBridge availability
            if (!window.terminalBridge) {
                console.error('[TERMINAL] TerminalBridge not available! Check preload.js.');
                throw new Error('TerminalBridge not available - secure terminal backend required');
            }
            
            this.Ipc = window.electronAPI;
            console.log('[TERMINAL] TerminalBridge and IPC loaded successfully');

            this.port = opts.port || 3000;
            this.cwd = "";
            this.oncwdchange = () => {};

            this._sendSizeToServer = () => {
                const dimensions = window.terminalBridge.getDimensions(this.id);
                if (!dimensions) return;
                
                let cols = dimensions.cols.toString();
                let rows = dimensions.rows.toString();
                while (cols.length < 3) {
                    cols = "0"+cols;
                }
                while (rows.length < 3) {
                    rows = "0"+rows;
                }
                this.Ipc.send("terminal_channel-"+this.port, "Resize", cols, rows);
            };

            // Support for custom color filters on the terminal - see #483
            let doCustomFilter = (window.isTermFilterValidated) ? true : false;

            // Parse & validate color filter
            if (window.isTermFilterValidated !== true && typeof window.theme.terminal.colorFilter === "object" && window.theme.terminal.colorFilter.length > 0) {
                doCustomFilter = window.theme.terminal.colorFilter.every((step, i, a) => {
                    let func = step.slice(0, step.indexOf("("));

                    switch(func) {
                        case "negate":
                        case "grayscale":
                            a[i] = {
                                func,
                                arg: []
                            };
                            return true;
                        case "lighten":
                        case "darken":
                        case "saturate":
                        case "desaturate":
                        case "whiten":
                        case "blacken":
                        case "fade":
                        case "opaquer":
                        case "rotate":
                        case "mix":
                            break;
                        default:
                            return false;
                    }

                    let arg = step.slice(step.indexOf("(")+1, step.indexOf(")"));

                    if (typeof Number(arg) === "number") {
                        a[i] = {
                            func,
                            arg: [Number(arg)]
                        };
                        window.isTermFilterValidated = true;
                        return true;
                    }

                    return false;
                });
            }

            // Use globally loaded color library
            let color = window.Color || function(c) { return { hex: () => c, grayscale: () => ({ mix: () => ({ hex: () => c }) }) }; };
            let colorify;
            if (doCustomFilter) {
                colorify = (base, target) => {
                    let newColor = color(base);
                    target = color(target);

                    for (let i = 0; i < window.theme.terminal.colorFilter.length; i++) {
                        if (window.theme.terminal.colorFilter[i].func === "mix") {
                            newColor = newColor[window.theme.terminal.colorFilter[i].func](target, ...window.theme.terminal.colorFilter[i].arg);
                        } else {
                            newColor = newColor[window.theme.terminal.colorFilter[i].func](...window.theme.terminal.colorFilter[i].arg);
                        }
                    }

                    return newColor.hex();
                };
            } else {
                colorify = (base, target) => {
                    return color(base).grayscale().mix(color(target), 0.3).hex();
                };
            }

            let themeColor = `rgb(${window.theme.r}, ${window.theme.g}, ${window.theme.b})`;

            // Terminal configuration object
            const terminalConfig = {
                cols: 80,
                rows: 24,
                cursorBlink: window.theme.terminal.cursorBlink || true,
                cursorStyle: window.theme.terminal.cursorStyle || "block",
                allowTransparency: window.theme.terminal.allowTransparency || false,
                allowProposedApi: true, // Required for ligatures addon
                fontFamily: window.theme.terminal.fontFamily || "Fira Mono",
                fontSize: window.theme.terminal.fontSize || window.settings.termFontSize || 15,
                fontWeight: window.theme.terminal.fontWeight || "normal",
                fontWeightBold: window.theme.terminal.fontWeightBold || "bold",
                letterSpacing: window.theme.terminal.letterSpacing || 0,
                lineHeight: window.theme.terminal.lineHeight || 1,
                scrollback: 1500,
                bellStyle: "none",
                theme: {
                    foreground: window.theme.terminal.foreground,
                    background: window.theme.terminal.background,
                    cursor: window.theme.terminal.cursor,
                    cursorAccent: window.theme.terminal.cursorAccent,
                    selection: window.theme.terminal.selection,
                    black: window.theme.colors.black || colorify("#2e3436", themeColor),
                    red: window.theme.colors.red || colorify("#cc0000", themeColor),
                    green: window.theme.colors.green || colorify("#4e9a06", themeColor),
                    yellow: window.theme.colors.yellow || colorify("#c4a000", themeColor),
                    blue: window.theme.colors.blue || colorify("#3465a4", themeColor),
                    magenta: window.theme.colors.magenta || colorify("#75507b", themeColor),
                    cyan: window.theme.colors.cyan || colorify("#06989a", themeColor),
                    white: window.theme.colors.white || colorify("#d3d7cf", themeColor),
                    brightBlack: window.theme.colors.brightBlack || colorify("#555753", themeColor),
                    brightRed: window.theme.colors.brightRed || colorify("#ef2929", themeColor),
                    brightGreen: window.theme.colors.brightGreen || colorify("#8ae234", themeColor),
                    brightYellow: window.theme.colors.brightYellow || colorify("#fce94f", themeColor),
                    brightBlue: window.theme.colors.brightBlue || colorify("#729fcf", themeColor),
                    brightMagenta: window.theme.colors.brightMagenta || colorify("#ad7fa8", themeColor),
                    brightCyan: window.theme.colors.brightCyan || colorify("#34e2e2", themeColor),
                    brightWhite: window.theme.colors.brightWhite || colorify("#eeeeec", themeColor)
                }
            };

            // Generate unique terminal ID and create terminal via bridge
            this.id = window.electronAPI.nanoid();
            console.log('[TERMINAL] Creating terminal via TerminalBridge with ID:', this.id);
            
            // Create terminal through secure bridge
            const success = window.terminalBridge.create(this.id, '#' + opts.parentId, terminalConfig);
            if (!success) {
                throw new Error('Failed to create terminal via TerminalBridge');
            }
            console.log('[TERMINAL] Terminal created successfully via TerminalBridge');
            
            // Set up custom key event handler after terminal is ready
            const setupKeyHandlers = () => {
                const textArea = document.querySelector('.xterm-helper-textarea');
                if (textArea && window.keyboard) {
                    textArea.addEventListener('keydown', e => {
                        window.keyboard.keydownHandler(e);
                    });
                    // Prevent soft-keyboard on touch devices #733
                    textArea.setAttribute('readonly', 'readonly');
                    
                    // Set up F11 handler
                    textArea.addEventListener("keydown", e => {
                        if (e.key === "F11" && window.settings.allowWindowed) {
                            e.preventDefault();
                            window.toggleFullScreen();
                        }
                    });
                    console.log('[TERMINAL] Key handlers set up successfully');
                } else if (!window.keyboard) {
                    console.warn('[TERMINAL] Keyboard not ready yet, retrying in 500ms');
                    setTimeout(setupKeyHandlers, 500);
                } else {
                    console.warn('[TERMINAL] Could not find xterm textarea for key handler setup');
                }
            };
            
            setTimeout(setupKeyHandlers, 100);

            this.Ipc.send("terminal_channel-"+this.port, "Renderer startup");
            this.Ipc.receive("terminal_channel-"+this.port, (...args) => {
                switch(args[0]) {
                    case "New cwd":
                        this.cwd = args[1];
                        this.oncwdchange(this.cwd);
                        break;
                    case "Fallback cwd":
                        this.cwd = "FALLBACK |-- "+args[1];
                        this.oncwdchange(this.cwd);
                        break;
                    case "New process":
                        if (this.onprocesschange) {
                            this.onprocesschange(args[1]);
                        }
                        break;
                    default:
                        return;
                }
            });
            this.resendCWD = () => {
                this.oncwdchange(this.cwd || null);
            };

            let sockHost = opts.host || "127.0.0.1";
            let sockPort = this.port;

            // Attach WebSocket through bridge using URL (WebSocket objects can't cross contextBridge)
            let websocketUrl = "ws://"+sockHost+":"+sockPort;
            const socketSuccess = window.terminalBridge.attachWebSocket(this.id, websocketUrl);
            if (!socketSuccess) {
                console.error('[TERMINAL] Failed to attach WebSocket through bridge');
            }
            
            // Set up additional WebSocket handling if needed (for onclose callback)
            this.socket = { 
                url: websocketUrl,
                onclose: null,
                close: () => {
                    // The actual WebSocket is managed by the bridge, so we just trigger callbacks
                    if (this.onclose) {
                        this.onclose({ reason: 'Manual close' });
                    }
                }
            };
            
            // Trigger fit and initial prompt after a short delay to ensure WebSocket connection is established
            setTimeout(() => {
                this.fit();
                // Send a carriage return to trigger the initial shell prompt
                setTimeout(() => {
                    this.write("\r");
                }, 500);
            }, 100);

            // Note: WebSocket message handling is now done inside the TerminalBridge
            // The actual WebSocket lives in the preload context and is managed by the bridge
            this.lastSoundFX = Date.now();
            
            // Set up data event handler through bridge to handle sound effects and globe features
            window.terminalBridge.on(this.id, 'onData', (data) => {
                let d = Date.now();

                if (d - this.lastSoundFX > 30) {
                    if(window.passwordMode == "false")
                        window.audioManager.stdout.play();
                    this.lastSoundFX = d;
                }
                if (d - this.lastRefit > 10000) {
                    this.fit();
                }

                // See #397 - Extract IP addresses for globe visualization
                if (!window.settings.experimentalGlobeFeatures) return;
                let ips = data.match(/((25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)/g);
                if (ips !== null && ips.length >= 1) {
                    ips = ips.filter((val, index, self) => { return self.indexOf(val) === index; });
                    ips.forEach(ip => {
                        window.mods.globe.addTemporaryConnectedMarker(ip);
                    });
                }
            });

            let parent = document.getElementById(opts.parentId);
            parent.addEventListener("wheel", e => {
                window.terminalBridge.scrollLines(this.id, Math.round(e.deltaY/10));
            });
            this._lastTouchY = null;
            parent.addEventListener("touchstart", e => {
                this._lastTouchY = e.targetTouches[0].screenY;
            });
            parent.addEventListener("touchmove", e => {
                if (this._lastTouchY) {
                    let y = e.changedTouches[0].screenY;
                    let deltaY = y - this._lastTouchY;
                    this._lastTouchY = y;
                    window.terminalBridge.scrollLines(this.id, -Math.round(deltaY/10));
                }
            });
            parent.addEventListener("touchend", e => {
                this._lastTouch = null;
            });
            parent.addEventListener("touchcancel", e => {
                this._lastTouch = null;
            });

            // F11 handler is set up in the timeout handler above after terminal is ready

            this.fit = () => {
                this.lastRefit = Date.now();
                const fitResult = window.terminalBridge.fit(this.id);
                if (!fitResult) return;
                
                let {cols, rows} = fitResult;

                // Apply custom fixes based on screen ratio, see #302
                let w = screen.width;
                let h = screen.height;
                let x = 1;
                let y = 0;

                function gcd(a, b) {
                    return (b == 0) ? a : gcd(b, a%b);
                }
                let d = gcd(w, h);

                if (d === 100) { y = 1; x = 3;}
                // if (d === 120) y = 1;
                if (d === 256) x = 2;

                if (window.settings.termFontSize < 15) y = y - 1;

                cols = cols+x;
                rows = rows+y;

                const currentDimensions = window.terminalBridge.getDimensions(this.id);
                if (!currentDimensions || currentDimensions.cols !== cols || currentDimensions.rows !== rows) {
                    this.resize(cols, rows);
                }
            };

            this.resize = (cols, rows) => {
                window.terminalBridge.resize(this.id, cols, rows);
                this._sendSizeToServer();
            };

            this.write = cmd => {
                const success = window.terminalBridge.send(this.id, cmd);
                if (!success) {
                    console.warn('[TERMINAL] Failed to send command through WebSocket');
                }
            };

            this.writelr = cmd => {
                const success = window.terminalBridge.send(this.id, cmd + "\r");
                if (!success) {
                    console.warn('[TERMINAL] Failed to send command through WebSocket');
                }
            };

            this.clipboard = {
                copy: () => {
                    if (!window.terminalBridge.hasSelection(this.id)) return false;
                    document.execCommand("copy");
                    window.terminalBridge.clearSelection(this.id);
                    this.clipboard.didCopy = true;
                },
                paste: async () => {
                    try {
                        const text = await navigator.clipboard.readText();
                        this.write(text);
                    } catch (err) {
                        // Fallback for browsers that don't support clipboard API
                        console.warn('Clipboard read failed:', err);
                    }
                    this.clipboard.didCopy = false;
                },
                didCopy: false
            };

        } else if (opts.role === "server") {

            // Load secure PTY backend via abstraction layer
            this.Pty = require("./ptyLoader");
            if (!this.Pty) {
                throw new Error('PTY backend unavailable - terminal functionality disabled');
            }
            this.Websocket = require("ws").Server;
            this.Ipc = require("electron").ipcMain;

            this.renderer = null;
            this.port = opts.port || 3000;

            this._closed = false;
            this.onclosed = () => {};
            this.onopened = () => {};
            this.onresize = () => {};
            this.ondisconnected = () => {};

            this._disableCWDtracking = false;
            this._getTtyCWD = tty => {
                return new Promise((resolve, reject) => {
                    let pid = tty._pid;
                    switch(require("os").type()) {
                        case "Linux":
                            require("fs").readlink(`/proc/${pid}/cwd`, (e, cwd) => {
                                if (e !== null) {
                                    reject(e);
                                } else {
                                    resolve(cwd);
                                }
                            });
                            break;
                        case "Darwin":
                            require("child_process").exec(`lsof -a -d cwd -p ${pid} | tail -1 | awk '{ for (i=9; i<=NF; i++) printf "%s ", $i }'`, (e, cwd) => {
                                if (e !== null) {
                                    reject(e);
                                } else {
                                    resolve(cwd.trim());
                                }
                            });
                            break;
                        default:
                            reject("Unsupported OS");
                    }
                });
            };
            this._getTtyProcess = tty => {
                return new Promise((resolve, reject) => {
                    let pid = tty._pid;
                    switch(require("os").type()) {
                        case "Linux":
                        case "Darwin":
                            require("child_process").exec(`ps -o comm --no-headers --sort=+pid -g ${pid} | tail -1`, (e, proc) => {
                                if (e !== null) {
                                    reject(e);
                                } else {
                                    resolve(proc.trim());
                                }
                            });
                            break;
                        default:
                            reject("Unsupported OS");
                    }
                });
            };
            this._nextTickUpdateTtyCWD = false;
            this._nextTickUpdateProcess = false;
            this._tick = setInterval(() => {
                if (this._nextTickUpdateTtyCWD && this._disableCWDtracking === false) {
                    this._nextTickUpdateTtyCWD = false;
                    this._getTtyCWD(this.tty).then(cwd => {
                        if (this.tty._cwd === cwd) return;
                        this.tty._cwd = cwd;
                        if (this.renderer) {
                            this.renderer.send("terminal_channel-"+this.port, "New cwd", cwd);
                        }
                    }).catch(e => {
                        if (!this._closed) {
                            console.log("Error while tracking TTY working directory: ", e);
                            this._disableCWDtracking = true;
                            try {
                                this.renderer.send("terminal_channel-"+this.port, "Fallback cwd", opts.cwd || process.env.PWD);
                            } catch(e) {
                                // renderer closed
                            }
                        }
                    });
                }

                if (this.renderer && this._nextTickUpdateProcess) {
                    this._nextTickUpdateProcess = false;
                    this._getTtyProcess(this.tty).then(process => {
                        if (this.tty._process === process) return;
                        this.tty._process = process;
                        if (this.renderer) {
                            this.renderer.send("terminal_channel-"+this.port, "New process", process);
                        }
                    }).catch(e => {
                        if (!this._closed) {
                            console.log("Error while retrieving TTY subprocess: ", e);
                            try {
                                this.renderer.send("terminal_channel-"+this.port, "New process", "");
                            } catch(e) {
                                // renderer closed
                            }
                        }
                    });
                }
            }, 1000);

            this.tty = this.Pty.spawn(opts.shell || "bash", (opts.params.length > 0 ? opts.params : (process.platform === "win32" ? [] : ["--login"])), {
                name: opts.env.TERM || "xterm-256color",
                cols: 80,
                rows: 24,
                cwd: opts.cwd || process.env.PWD,
                env: opts.env || process.env
            });

            this.tty.onExit((code, signal) => {
                this._closed = true;
                this.onclosed(code, signal);
            });

            this.wss = new this.Websocket({
                port: this.port,
                clientTracking: true,
                verifyClient: info => {
                    if (this.wss.clients.length >= 1) {
                        return false;
                    } else {
                        return true;
                    }
                }
            });
            this.Ipc.on("terminal_channel-"+this.port, (e, ...args) => {
                switch(args[0]) {
                    case "Renderer startup":
                        this.renderer = e.sender;
                        if (!this._disableCWDtracking && this.tty._cwd) {
                            this.renderer.send("terminal_channel-"+this.port, "New cwd", this.tty._cwd);
                        }
                        if (this._disableCWDtracking) {
                            this.renderer.send("terminal_channel-"+this.port, "Fallback cwd", opts.cwd || process.env.PWD);
                        }
                        break;
                    case "Resize":
                        let cols = args[1];
                        let rows = args[2];
                        try {
                            this.tty.resize(Number(cols), Number(rows));
                        } catch (error) {
                            //Keep going, it'll work anyways.
                        }
                        this.onresized(cols, rows);
                        break;
                    default:
                        return;
                }
            });
            this.wss.on("connection", ws => {
                this.onopened(this.tty._pid);
                ws.on("close", (code, reason) => {
                    this.ondisconnected(code, reason);
                });
                ws.on("message", msg => {
                    this.tty.write(msg);
                });
                this.tty.onData(data => {
                    this._nextTickUpdateTtyCWD = true;
                    this._nextTickUpdateProcess = true;
                    try {
                        ws.send(data);
                    } catch (e) {
                        // Websocket closed
                    }
                });
            });

            this.close = () => {
                this.tty.kill();
                this._closed = true;
            };
        } else {
            throw "Unknown purpose";
        }
    }
}

module.exports = {
    Terminal
};

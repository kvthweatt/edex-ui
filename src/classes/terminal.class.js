class Terminal {
    constructor(opts) {
        console.log('[TERMINAL] Constructor called with opts:', opts);
        
        if (opts.role === "client") {
            console.log('[TERMINAL] Client mode - checking dependencies');
            if (!opts.parentId) throw "Missing options";

            // Try multiple sources for XTerm Terminal class, including factory approach
            this.xTerm = window.XTerminal || 
                        (window.XTermFactory && window.XTermFactory.Terminal) ||
                        (window.XTermClasses && window.XTermClasses.Terminal) || 
                        window.Terminal;
            
            // Enhanced fallback detection with direct assignment
            if (!this.xTerm && window.Terminal) {
                this.xTerm = window.Terminal;
            }
            
            // If we still don't have it, try to use factory function directly
            if (!this.xTerm && window.createTerminal) {
                console.log('[TERMINAL] Using factory function approach instead of constructor');
                this.useFactoryPattern = true;
            }
            
            // Ensure we have the actual constructor function, not a wrapped reference
            if (this.xTerm && typeof this.xTerm === 'function') {
                // Test if it's a proper constructor
                try {
                    // This should not throw for a proper constructor
                    const TestClass = this.xTerm;
                    if (TestClass.prototype && TestClass.prototype.constructor === TestClass) {
                        console.log('[TERMINAL] XTerm constructor validated successfully');
                    }
                } catch (error) {
                    console.warn('[TERMINAL] XTerm constructor validation failed:', error);
                }
            }
            
            // Load addon classes with fallbacks
            const AttachAddon = window.AttachAddon || (window.XTermClasses && window.XTermClasses.AttachAddon);
            const FitAddon = window.FitAddon || (window.XTermClasses && window.XTermClasses.FitAddon);
            const LigaturesAddon = window.LigaturesAddon || (window.XTermClasses && window.XTermClasses.LigaturesAddon);
            const WebglAddon = window.WebglAddon || (window.XTermClasses && window.XTermClasses.WebglAddon);
            this.Ipc = window.electronAPI;
            
            console.log('[TERMINAL] Dependencies loaded:', {
                xTerm: typeof this.xTerm,
                AttachAddon: typeof AttachAddon,
                FitAddon: typeof FitAddon, 
                LigaturesAddon: typeof LigaturesAddon,
                WebglAddon: typeof WebglAddon,
                Ipc: typeof this.Ipc
            });
            
            // Debug the exact XTerm class we received
            console.log('[TERMINAL] XTerm class details:', {
                name: this.xTerm?.name,
                prototype: !!this.xTerm?.prototype,
                constructor: !!this.xTerm?.prototype?.constructor,
                toString: this.xTerm?.toString().substring(0, 100)
            });
            
            // Try to inspect the actual function
            if (this.xTerm) {
                console.log('[TERMINAL] XTerm function source (first 200 chars):', this.xTerm.toString().substring(0, 200));
            }
            
            if (!this.xTerm) {
                console.error('[TERMINAL] XTerminal class not available!');
                console.error('[TERMINAL] Available globals containing "Term":', Object.keys(window).filter(k => k.toLowerCase().includes('term')));
                console.error('[TERMINAL] Available XTermClasses:', window.XTermClasses ? Object.keys(window.XTermClasses) : 'undefined');
                console.error('[TERMINAL] Window object keys (sample):', Object.keys(window).slice(0, 20));
                throw new Error('XTerminal class not available - check that XTerm is properly loaded');
            }

            this.port = opts.port || 3000;
            this.cwd = "";
            this.oncwdchange = () => {};

            this._sendSizeToServer = () => {
                let cols = this.term.cols.toString();
                let rows = this.term.rows.toString();
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

            // Create XTerm instance using factory function if available, otherwise use constructor
            if (window.createTerminal && typeof window.createTerminal === 'function') {
                console.log('[TERMINAL] Using factory function to create XTerm instance');
                this.term = window.createTerminal(terminalConfig);
            } else {
                console.log('[TERMINAL] Using constructor to create XTerm instance');
                const XTerminalClass = this.xTerm;
                console.log('[TERMINAL] About to instantiate XTerm with class:', XTerminalClass?.name || 'unnamed');
                this.term = new XTerminalClass(terminalConfig);
            }
            
            console.log('[TERMINAL] About to create FitAddon, type:', typeof FitAddon);
            try {
                let fitAddon = new FitAddon();
                console.log('[TERMINAL] FitAddon created successfully');
                this.term.loadAddon(fitAddon);
                console.log('[TERMINAL] FitAddon loaded successfully');
            } catch (error) {
                console.error('[TERMINAL] Error creating/loading FitAddon:', error);
                throw error;
            }
            this.term.open(document.getElementById(opts.parentId));
            this.term.loadAddon(new WebglAddon());
            let ligaturesAddon = new LigaturesAddon();
            this.term.loadAddon(ligaturesAddon);
            this.term.attachCustomKeyEventHandler(e => {
                window.keyboard.keydownHandler(e);
                return true;
            });
            // Prevent soft-keyboard on touch devices #733
            document.querySelectorAll('.xterm-helper-textarea').forEach(textarea => textarea.setAttribute('readonly', 'readonly'))
            this.term.focus();

            this.Ipc.send("terminal_channel-"+this.port, "Renderer startup");
            this.Ipc.on("terminal_channel-"+this.port, (e, ...args) => {
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

            this.socket = new WebSocket("ws://"+sockHost+":"+sockPort);
            this.socket.onopen = () => {
                let attachAddon = new AttachAddon(this.socket);
                this.term.loadAddon(attachAddon);
                this.fit();
            };
            this.socket.onerror = e => {throw JSON.stringify(e)};
            this.socket.onclose = e => {
                if (this.onclose) {
                    this.onclose(e);
                }
            };

            this.lastSoundFX = Date.now();
            this.socket.addEventListener("message", e => {
                let d = Date.now();

                if (d - this.lastSoundFX > 30) {
                    if(window.passwordMode == "false")
                        window.audioManager.stdout.play();
                    this.lastSoundFX = d;
                }
                if (d - this.lastRefit > 10000) {
                    this.fit();
                }

                // See #397
                if (!window.settings.experimentalGlobeFeatures) return;
                let ips = e.data.match(/((25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)/g);
                if (ips !== null && ips.length >= 1) {
                    ips = ips.filter((val, index, self) => { return self.indexOf(val) === index; });
                    ips.forEach(ip => {
                        window.mods.globe.addTemporaryConnectedMarker(ip);
                    });
                }
            });

            let parent = document.getElementById(opts.parentId);
            parent.addEventListener("wheel", e => {
                this.term.scrollLines(Math.round(e.deltaY/10));
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
                    this.term.scrollLines(-Math.round(deltaY/10));
                }
            });
            parent.addEventListener("touchend", e => {
                this._lastTouch = null;
            });
            parent.addEventListener("touchcancel", e => {
                this._lastTouch = null;
            });

            document.querySelector(".xterm-helper-textarea").addEventListener("keydown", e => {
                if (e.key === "F11" && window.settings.allowWindowed) {
                    e.preventDefault();
                    window.toggleFullScreen();
                }
            });

            this.fit = () => {
                this.lastRefit = Date.now();
                let {cols, rows} = fitAddon.proposeDimensions();

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

                if (this.term.cols !== cols || this.term.rows !== rows) {
                    this.resize(cols, rows);
                }
            };

            this.resize = (cols, rows) => {
                this.term.resize(cols, rows);
                this._sendSizeToServer();
            };

            this.write = cmd => {
                this.socket.send(cmd);
            };

            this.writelr = cmd => {
                this.socket.send(cmd+"\r");
            };

            this.clipboard = {
                copy: () => {
                    if (!this.term.hasSelection()) return false;
                    document.execCommand("copy");
                    this.term.clearSelection();
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

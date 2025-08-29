// Immediate test to verify renderer is loading
console.log("[RENDERER] Script started loading");

// Enhanced error handling to catch silent failures
window.addEventListener('error', (event) => {
    console.error('[RENDERER ERROR]', event.error);
    const bootScreen = document.getElementById("boot_screen");
    if (bootScreen) {
        bootScreen.innerHTML += `<br/>ERROR: ${event.error.message}<br/>at ${event.filename}:${event.lineno}:${event.colno}`;
    }
});

window.addEventListener('unhandledrejection', (event) => {
    console.error('[RENDERER UNHANDLED PROMISE]', event.reason);
    const bootScreen = document.getElementById("boot_screen");
    if (bootScreen) {
        bootScreen.innerHTML += `<br/>PROMISE ERROR: ${event.reason}`;
    }
});

// Wait for DOM to be ready before accessing elements
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        console.log("[RENDERER] DOM loaded, initializing...");
        const bootScreen = document.getElementById("boot_screen");
        if (bootScreen) {
            bootScreen.innerHTML = "Renderer loading...<br/>";
            console.log("[RENDERER] Boot screen updated");
        } else {
            console.error("[RENDERER] Boot screen element not found!");
        }
    });
} else {
    console.log("[RENDERER] DOM already loaded");
    const bootScreen = document.getElementById("boot_screen");
    if (bootScreen) {
        bootScreen.innerHTML = "Renderer loading...<br/>";
        console.log("[RENDERER] Boot screen updated");
    } else {
        console.error("[RENDERER] Boot screen element not found!");
    }
}

// Disable eval()
window.eval = function () {
    throw new Error("eval() is disabled for security reasons.");
};
// Also disable global.eval if it exists
if (typeof global !== 'undefined') {
    global.eval = window.eval;
}
// Security helper :)
window._escapeHtml = text => {
    let map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, m => {return map[m];});
};
window._encodePathURI = uri => {
    return encodeURI(uri).replace(/#/g, "%23");
};
window._purifyCSS = str => {
    if (typeof str === "undefined") return "";
    if (typeof str !== "string") {
        str = str.toString();
    }
    return str.replace(/[<]/g, "");
};
window._delay = ms => {
    return new Promise((resolve, reject) => {
        setTimeout(resolve, ms);
    });
};

// Initiate basic error handling
window.onerror = (msg, path, line, col, error) => {
    document.getElementById("boot_screen").innerHTML += `${error} :  ${msg}<br/>==> at ${path}  ${line}:${col}`;
};

// Initialize directories and file paths (will be set asynchronously)
let settingsDir, themesDir, keyboardsDir, fontsDir;
let settingsFile, shortcutsFile, lastWindowStateFile;

// Helper function to join paths (replacing path.join)
const joinPath = (...parts) => parts.join('/').replace(/\/+/g, '/').replace(/\\/g, '/');

// Load config asynchronously
window.settings = {};
window.shortcuts = {};
window.lastWindowState = {};

// Initialize paths and load configuration
async function initializeConfig() {
    try {
        settingsDir = await window.electronAPI.getUserDataPath();
        themesDir = joinPath(settingsDir, 'themes');
        keyboardsDir = joinPath(settingsDir, 'keyboards');
        fontsDir = joinPath(settingsDir, 'fonts');
        
        // Load configuration files
        window.settings = await window.electronAPI.loadSettings();
        window.shortcuts = await window.electronAPI.loadShortcuts();
        window.lastWindowState = await window.electronAPI.loadWindowState();
        
        return true;
    } catch (error) {
        console.error('Failed to initialize config:', error);
        throw error;
    }
}

// Load CLI parameters and configuration asynchronously
async function loadCLIParameters() {
    try {
        const argv = await window.electronAPI.getCommandLineArgs();
        
        if (argv.includes("--nointro")) {
            window.settings.nointroOverride = true;
        } else {
            window.settings.nointroOverride = false;
        }
        if (argv.includes("--nocursor")) {
            window.settings.nocursorOverride = true;
        } else {
            window.settings.nocursorOverride = false;
        }
    } catch (error) {
        console.error('Failed to load CLI parameters:', error);
    }
}

// Retrieve theme override (hotswitch)
window.electronAPI.receive("getThemeOverride", async (theme) => {
    try {
        if (theme !== null) {
            window.settings.theme = theme;
            window.settings.nointroOverride = true;
            const themeData = await window.electronAPI.loadTheme(window.settings.theme);
            _loadTheme(themeData);
        } else {
            await loadThemeWithFallback();
        }
    } catch (error) {
        console.error('Failed to load theme:', error);
        const bootScreen = document.getElementById("boot_screen");
        if (bootScreen) bootScreen.innerHTML += `<br/>[RENDERER ERROR] Theme loading failed: ${error.message}<br/>`;
    }
});
window.electronAPI.send("getThemeOverride");

// Same for keyboard override/hotswitch
window.electronAPI.receive("getKbOverride", (layout) => {
    if (layout !== null) {
        window.settings.keyboard = layout;
        window.settings.nointroOverride = true;
    }
});
window.electronAPI.send("getKbOverride");

// Theme loading with fallback handling
async function loadThemeWithFallback() {
    let themeName = window.settings.theme;
    const fallbackThemes = ['tron-notype', 'matrix', 'apollo', 'cyborg'];
    
    // If theme name is missing or undefined, use fallback
    if (!themeName) {
        console.warn('No theme specified in settings, using fallback');
        themeName = fallbackThemes[0];
        window.settings.theme = themeName;
    }
    
    // Try to load the specified theme
    for (let i = 0; i < fallbackThemes.length + 1; i++) {
        try {
            let currentTheme = (i === 0) ? themeName : fallbackThemes[i - 1];
            console.log(`Attempting to load theme: ${currentTheme}`);
            const themeData = await window.electronAPI.loadTheme(currentTheme);
            _loadTheme(themeData);
            if (i > 0) {
                console.warn(`Fallback theme '${currentTheme}' loaded successfully after '${themeName}' failed`);
                const bootScreen = document.getElementById("boot_screen");
                if (bootScreen) bootScreen.innerHTML += `<br/>[RENDERER WARNING] Using fallback theme '${currentTheme}' instead of '${themeName}'<br/>`;
            }
            return;
        } catch (error) {
            console.error(`Failed to load theme '${(i === 0) ? themeName : fallbackThemes[i - 1]}':`, error);
            if (i === fallbackThemes.length) {
                // All fallback themes failed, create a minimal theme
                console.error('All theme fallbacks failed, creating minimal theme');
                const minimalTheme = {
                    colors: { r: 170, g: 207, b: 209, black: "#000000", light_black: "#05080d", grey: "#262828" },
                    cssvars: { font_main: "monospace", font_main_light: "monospace" },
                    terminal: { fontFamily: "monospace", foreground: "#aacfd1", background: "#05080d" },
                    injectCSS: ""
                };
                _loadTheme(minimalTheme);
                const bootScreen = document.getElementById("boot_screen");
                if (bootScreen) bootScreen.innerHTML += `<br/>[RENDERER ERROR] All themes failed, using minimal fallback<br/>`;
                return;
            }
        }
    }
}

// Load UI theme
window._loadTheme = theme => {

    if (document.querySelector("style.theming")) {
        document.querySelector("style.theming").remove();
    }

    // Load fonts
    let mainFont = new FontFace(theme.cssvars.font_main, `url("${joinPath(fontsDir, theme.cssvars.font_main.toLowerCase().replace(/ /g, '_')+'.woff2')}")`);
    let lightFont = new FontFace(theme.cssvars.font_main_light, `url("${joinPath(fontsDir, theme.cssvars.font_main_light.toLowerCase().replace(/ /g, '_')+'.woff2')}")`);
    let termFont = new FontFace(theme.terminal.fontFamily, `url("${joinPath(fontsDir, theme.terminal.fontFamily.toLowerCase().replace(/ /g, '_')+'.woff2')}")`);

    document.fonts.add(mainFont);
    document.fonts.load("12px "+theme.cssvars.font_main);
    document.fonts.add(lightFont);
    document.fonts.load("12px "+theme.cssvars.font_main_light);
    document.fonts.add(termFont);
    document.fonts.load("12px "+theme.terminal.fontFamily);

    document.querySelector("head").innerHTML += `<style class="theming">
    :root {
        --font_main: "${window._purifyCSS(theme.cssvars.font_main)}";
        --font_main_light: "${window._purifyCSS(theme.cssvars.font_main_light)}";
        --font_mono: "${window._purifyCSS(theme.terminal.fontFamily)}";
        --color_r: ${window._purifyCSS(theme.colors.r)};
        --color_g: ${window._purifyCSS(theme.colors.g)};
        --color_b: ${window._purifyCSS(theme.colors.b)};
        --color_black: ${window._purifyCSS(theme.colors.black)};
        --color_light_black: ${window._purifyCSS(theme.colors.light_black)};
        --color_grey: ${window._purifyCSS(theme.colors.grey)};

        /* Used for error and warning modals */
        --color_red: ${window._purifyCSS(theme.colors.red) || "red"};
        --color_yellow: ${window._purifyCSS(theme.colors.yellow) || "yellow"};
    }

    body {
        font-family: var(--font_main), sans-serif;
        cursor: ${(window.settings.nocursorOverride || window.settings.nocursor) ? "none" : "default"} !important;
    }

    * {
   	   ${(window.settings.nocursorOverride || window.settings.nocursor) ? "cursor: none !important;" : ""}
	}

    ${window._purifyCSS(theme.injectCSS || "")}
    </style>`;

    window.theme = theme;
    window.theme.r = theme.colors.r;
    window.theme.g = theme.colors.g;
    window.theme.b = theme.colors.b;
};

function initGraphicalErrorHandling() {
    window.edexErrorsModals = [];
    window.onerror = (msg, path, line, col, error) => {
        let errorModal = new Modal({
            type: "error",
            title: error,
            message: `${msg}<br/>        at ${path}  ${line}:${col}`
        });
        window.edexErrorsModals.push(errorModal);

        ipc.send("log", "error", `${error}: ${msg}`);
        ipc.send("log", "debug", `at ${path} ${line}:${col}`);
    };
}

function waitForFonts() {
    return new Promise(resolve => {
        if (document.readyState !== "complete" || document.fonts.status !== "loaded") {
            document.addEventListener("readystatechange", () => {
                if (document.readyState === "complete") {
                    if (document.fonts.status === "loaded") {
                        resolve();
                    } else {
                        document.fonts.onloadingdone = () => {
                            if (document.fonts.status === "loaded") resolve();
                        };
                    }
                }
            });
        } else {
            resolve();
        }
    });
}

// A proxy function used to add multithreading to systeminformation calls - see backend process manager @ _multithread.js
function initSystemInformationProxy() {
    // Simple nanoid implementation since we can't import it in renderer
    const nanoid = () => {
        return 'id_' + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    };

    window.si = new Proxy({}, {
        apply: () => {throw new Error("Cannot use sysinfo proxy directly as a function")},
        set: () => {throw new Error("Cannot set a property on the sysinfo proxy")},
        get: (target, prop, receiver) => {
            return function(...args) {
                let callback = (typeof args[args.length - 1] === "function") ? true : false;

                return new Promise((resolve, reject) => {
                    let id = nanoid();
                    window.electronAPI.receive("systeminformation-reply-"+id, (res) => {
                        if (callback) {
                            args[args.length - 1](res);
                        }
                        resolve(res);
                        // Clean up the listener after use
                        window.electronAPI.removeAllListeners("systeminformation-reply-"+id);
                    });
                    window.electronAPI.send("systeminformation-call", prop, id, ...args);
                });
            };
        }
    });
}

// Audio manager will be initialized in startApp function
window.audioManager = null;

// Initialize paths, load config, and start app
async function startApp() {
    // Add debugging info
    console.log('Starting eDEX-UI renderer...');
    const bootScreen = document.getElementById("boot_screen");
    if (bootScreen) {
        bootScreen.innerHTML = "[RENDERER DEBUG] Starting eDEX-UI renderer...<br/>";
        bootScreen.style.color = "#00ff00";
        bootScreen.style.fontFamily = "monospace";
        bootScreen.style.fontSize = "16px";
        bootScreen.style.padding = "20px";
    }
    
    try {
        if (bootScreen) bootScreen.innerHTML += "[RENDERER DEBUG] Loading configuration...<br/>";
        await initializeConfig();
        if (bootScreen) bootScreen.innerHTML += "[RENDERER DEBUG] Loading CLI parameters...<br/>";
        await loadCLIParameters();
        if (bootScreen) bootScreen.innerHTML += "[RENDERER DEBUG] Configuration loaded successfully!<br/>";
    } catch (error) {
        console.error('Failed to initialize:', error);
        // Show error on boot screen
        if (bootScreen) bootScreen.innerHTML += `<br/>[RENDERER ERROR] ${error.message}<br/>[RENDERER ERROR] Stack: ${error.stack}`;
        return;
    }
    
    // Initialize AudioManager after configuration is loaded
    try {
        if (bootScreen) bootScreen.innerHTML += "[RENDERER DEBUG] Initializing AudioManager...<br/>";
        window.audioManager = new AudioManager();
        if (bootScreen) bootScreen.innerHTML += "[RENDERER DEBUG] AudioManager initialized successfully!<br/>";
    } catch (error) {
        console.error('[RENDERER] Failed to initialize AudioManager:', error);
        if (bootScreen) bootScreen.innerHTML += `<br/>[RENDERER ERROR] AudioManager failed: ${error.message}<br/>`;
        // Create a no-op audio manager to prevent crashes
        window.audioManager = new Proxy({}, {
            get: () => ({ play: () => true })
        });
    }
    
    // Register keyboard shortcuts after configuration is loaded
    try {
        if (bootScreen) bootScreen.innerHTML += "[RENDERER DEBUG] Registering keyboard shortcuts...<br/>";
        await window.registerKeyboardShortcuts();
        if (bootScreen) bootScreen.innerHTML += "[RENDERER DEBUG] Keyboard shortcuts registered!<br/>";
    } catch (error) {
        console.error('[RENDERER] Failed to register shortcuts:', error);
        if (bootScreen) bootScreen.innerHTML += `<br/>[RENDERER ERROR] Shortcuts failed: ${error.message}<br/>`;
    }
    
    let i = 0;
    if (window.settings.nointro || window.settings.nointroOverride) {
        initGraphicalErrorHandling();
        initSystemInformationProxy();
        document.getElementById("boot_screen").remove();
        document.body.setAttribute("class", "");
        waitForFonts().then(initUI);
    } else {
        displayLine();
    }
}

// Start the application
startApp();

// Boot sequence counter
let bootLineIndex = 0;

// Startup boot log
async function displayLine() {
    let bootScreen = document.getElementById("boot_screen");
    let log, appVersion, platform;
    
    try {
        // Load boot log and system info asynchronously
        const assetsPath = joinPath(settingsDir, '..', '..', '..', 'assets', 'misc', 'boot_log.txt');
        log = (await window.electronAPI.readFileSync(assetsPath)).split('\n');
        appVersion = await window.electronAPI.getAppVersion();
        platform = await window.electronAPI.getPlatform();
    } catch (error) {
        console.error('Failed to load boot assets:', error);
        // Fallback to basic boot sequence
        log = ['Boot starting...', 'Boot Complete'];
        appVersion = 'Unknown';
        platform = 'unknown';
    }

    async function isArchUser() {
        if (platform !== "linux") return false;
        try {
            return (await window.electronAPI.fileExists("/etc/os-release")) &&
                   (await window.electronAPI.readFileSync("/etc/os-release")).includes("arch");
        } catch (e) {
            return false;
        }
    }

    if (typeof log[bootLineIndex] === "undefined") {
        setTimeout(displayTitleScreen, 300);
        return;
    }

    if (log[bootLineIndex] === "Boot Complete") {
        window.audioManager.granted.play();
    } else {
        window.audioManager.stdout.play();
    }
    bootScreen.innerHTML += log[bootLineIndex]+"<br/>";
    bootLineIndex++;

    switch(true) {
        case bootLineIndex === 2:
            bootScreen.innerHTML += `eDEX-UI Kernel version ${appVersion} boot at ${Date().toString()}; root:xnu-1699.22.73~1/RELEASE_X86_64`;
        case bootLineIndex === 4:
            setTimeout(displayLine, 500);
            break;
        case bootLineIndex > 4 && bootLineIndex < 25:
            setTimeout(displayLine, 30);
            break;
        case bootLineIndex === 25:
            setTimeout(displayLine, 400);
            break;
        case bootLineIndex === 42:
            setTimeout(displayLine, 300);
            break;
        case bootLineIndex > 42 && bootLineIndex < 82:
            setTimeout(displayLine, 25);
            break;
        case bootLineIndex === 83:
            if (await isArchUser())
                bootScreen.innerHTML += "btw i use arch<br/>";
            setTimeout(displayLine, 25);
            break;
        case bootLineIndex >= log.length-2 && bootLineIndex < log.length:
            setTimeout(displayLine, 300);
            break;
        default:
            setTimeout(displayLine, Math.pow(1 - (bootLineIndex/1000), 3)*25);
    }
}

// Show "logo" and background grid
async function displayTitleScreen() {
    let bootScreen = document.getElementById("boot_screen");
    if (bootScreen === null) {
        bootScreen = document.createElement("section");
        bootScreen.setAttribute("id", "boot_screen");
        bootScreen.setAttribute("style", "z-index: 9999999");
        document.body.appendChild(bootScreen);
    }
    bootScreen.innerHTML = "";
    window.audioManager.theme.play();

    await _delay(400);

    document.body.setAttribute("class", "");
    bootScreen.setAttribute("class", "center");
    bootScreen.innerHTML = "<h1>eDEX-UI</h1>";
    let title = document.querySelector("section > h1");

    await _delay(200);

    document.body.setAttribute("class", "solidBackground");

    await _delay(100);

    title.setAttribute("style", `background-color: rgb(${window.theme.r}, ${window.theme.g}, ${window.theme.b});border-bottom: 5px solid rgb(${window.theme.r}, ${window.theme.g}, ${window.theme.b});`);

    await _delay(300);

    title.setAttribute("style", `border: 5px solid rgb(${window.theme.r}, ${window.theme.g}, ${window.theme.b});`);

    await _delay(100);

    title.setAttribute("style", "");
    title.setAttribute("class", "glitch");

    await _delay(500);

    document.body.setAttribute("class", "");
    title.setAttribute("class", "");
    title.setAttribute("style", `border: 5px solid rgb(${window.theme.r}, ${window.theme.g}, ${window.theme.b});`);

    await _delay(1000);
    if (window.term) {
        bootScreen.remove();
        return true;
    }
    initGraphicalErrorHandling();
    initSystemInformationProxy();
    waitForFonts().then(() => {
        bootScreen.remove();
        initUI();
    });
}

// Returns the user's desired display name
async function getDisplayName() {
    let user = window.settings.username || null;
    if (user)
        return user;

    try {
        user = await window.electronAPI.getUsername();
    } catch (e) {}

    return user || null;
}

// Create the UI's html structure and initialize the terminal client and the keyboard
async function initUI() {
    document.body.innerHTML += `<section class="mod_column" id="mod_column_left">
        <h3 class="title"><p>PANEL</p><p>SYSTEM</p></h3>
    </section>
    <section id="main_shell" style="height:0%;width:0%;opacity:0;margin-bottom:30vh;" augmented-ui="bl-clip tr-clip exe">
        <h3 class="title" style="opacity:0;"><p>TERMINAL</p><p>MAIN SHELL</p></h3>
        <h1 id="main_shell_greeting"></h1>
    </section>
    <section class="mod_column" id="mod_column_right">
        <h3 class="title"><p>PANEL</p><p>NETWORK</p></h3>
    </section>`;

    await _delay(10);

    window.audioManager.expand.play();
    document.getElementById("main_shell").setAttribute("style", "height:0%;margin-bottom:30vh;");

    await _delay(500);

    document.getElementById("main_shell").setAttribute("style", "margin-bottom: 30vh;");
    document.querySelector("#main_shell > h3.title").setAttribute("style", "");

    await _delay(700);

    document.getElementById("main_shell").setAttribute("style", "opacity: 0;");
    document.body.innerHTML += `
    <section id="filesystem" style="width: 0px;" class="${window.settings.hideDotfiles ? "hideDotfiles" : ""} ${window.settings.fsListView ? "list-view" : ""}">
    </section>
    <section id="keyboard" style="opacity:0;">
    </section>`;
    window.keyboard = new Keyboard({
        layout: joinPath(keyboardsDir, window.settings.keyboard+".json"),
        container: "keyboard"
    });

    await _delay(10);

    document.getElementById("main_shell").setAttribute("style", "");

    await _delay(270);

    let greeter = document.getElementById("main_shell_greeting");

    getDisplayName().then(user => {
        if (user) {
            greeter.innerHTML += `Welcome back, <em>${user}</em>`;
        } else {
            greeter.innerHTML += "Welcome back";
        }
    });

    greeter.setAttribute("style", "opacity: 1;");

    document.getElementById("filesystem").setAttribute("style", "");
    document.getElementById("keyboard").setAttribute("style", "");
    document.getElementById("keyboard").setAttribute("class", "animation_state_1");
    window.audioManager.keyboard.play();

    await _delay(100);

    document.getElementById("keyboard").setAttribute("class", "animation_state_1 animation_state_2");

    await _delay(1000);

    greeter.setAttribute("style", "opacity: 0;");

    await _delay(100);

    document.getElementById("keyboard").setAttribute("class", "");

    await _delay(400);

    greeter.remove();

    // Initialize modules
    window.mods = {};

    // Left column
    window.mods.clock = new Clock("mod_column_left");
    window.mods.sysinfo = new Sysinfo("mod_column_left");
    window.mods.hardwareInspector = new HardwareInspector("mod_column_left");
    window.mods.cpuinfo = new Cpuinfo("mod_column_left");
    window.mods.ramwatcher = new RAMwatcher("mod_column_left");
    window.mods.toplist = new Toplist("mod_column_left");

    // Right column
    window.mods.netstat = new Netstat("mod_column_right");
    window.mods.globe = new LocationGlobe("mod_column_right");
    window.mods.conninfo = new Conninfo("mod_column_right");

    // Fade-in animations
    document.querySelectorAll(".mod_column").forEach(e => {
        e.setAttribute("class", "mod_column activated");
    });
    let i = 0;
    let left = document.querySelectorAll("#mod_column_left > div");
    let right = document.querySelectorAll("#mod_column_right > div");
    let x = setInterval(() => {
        if (!left[i] && !right[i]) {
            clearInterval(x);
        } else {
            window.audioManager.panels.play();
            if (left[i]) {
                left[i].setAttribute("style", "animation-play-state: running;");
            }
            if (right[i]) {
                right[i].setAttribute("style", "animation-play-state: running;");
            }
            i++;
        }
    }, 500);

    await _delay(100);

    // Initialize the terminal
    let shellContainer = document.getElementById("main_shell");
    shellContainer.innerHTML += `
        <ul id="main_shell_tabs">
            <li id="shell_tab0" onclick="window.focusShellTab(0);" class="active"><p>MAIN SHELL</p></li>
            <li id="shell_tab1" onclick="window.focusShellTab(1);"><p>EMPTY</p></li>
            <li id="shell_tab2" onclick="window.focusShellTab(2);"><p>EMPTY</p></li>
            <li id="shell_tab3" onclick="window.focusShellTab(3);"><p>EMPTY</p></li>
            <li id="shell_tab4" onclick="window.focusShellTab(4);"><p>EMPTY</p></li>
        </ul>
        <div id="main_shell_innercontainer">
            <pre id="terminal0" class="active"></pre>
            <pre id="terminal1"></pre>
            <pre id="terminal2"></pre>
            <pre id="terminal3"></pre>
            <pre id="terminal4"></pre>
        </div>`;
    window.term = {
        0: new Terminal({
            role: "client",
            parentId: "terminal0",
            port: window.settings.port || 3000
        })
    };
    window.currentTerm = 0;
    window.term[0].onprocesschange = p => {
        document.getElementById("shell_tab0").innerHTML = `<p>MAIN - ${p}</p>`;
    };
    // Prevent losing hardware keyboard focus on the terminal when using touch keyboard
    window.onmouseup = e => {
        if (window.keyboard.linkedToTerm) window.terminalBridge.focus(window.term[window.currentTerm].id);
    };
    // Terminal welcome message with async version info
    (async () => {
        try {
            const appVersion = await window.electronAPI.getAppVersion();
            const processVersions = await window.electronAPI.getProcessVersions();
            window.terminalBridge.writeln(window.term[0].id, "\033[1m"+`Welcome to eDEX-UI v${appVersion} - Electron v${processVersions.electron}`+"\033[0m");
        } catch (error) {
            console.error('Failed to load version info:', error);
            window.terminalBridge.writeln(window.term[0].id, "\033[1m"+`Welcome to eDEX-UI`+"\033[0m");
        }
    })();

    await _delay(100);

    window.fsDisp = new FilesystemDisplay({
        parentId: "filesystem"
    });

    await _delay(200);

    document.getElementById("filesystem").setAttribute("style", "opacity: 1;");

    // Resend terminal CWD to fsDisp if we're hot reloading
    if (window.performance.navigation.type === 1) {
        window.term[window.currentTerm].resendCWD();
    }

    await _delay(200);

    window.updateCheck = new UpdateChecker();
}

window.themeChanger = theme => {
    ipc.send("setThemeOverride", theme);
    setTimeout(() => {
        window.location.reload(true);
    }, 100);
};

window.remakeKeyboard = layout => {
    document.getElementById("keyboard").innerHTML = "";
    window.keyboard = new Keyboard({
        layout: path.join(keyboardsDir, layout+".json" || settings.keyboard+".json"),
        container: "keyboard"
    });
    ipc.send("setKbOverride", layout);
};

window.focusShellTab = number => {
    window.audioManager.folder.play();

    if (number !== window.currentTerm && window.term[number]) {
        window.currentTerm = number;

        document.querySelectorAll(`ul#main_shell_tabs > li:not(:nth-child(${number+1}))`).forEach(e => {
            e.setAttribute("class", "");
        });
        document.getElementById("shell_tab"+number).setAttribute("class", "active");

        document.querySelectorAll(`div#main_shell_innercontainer > pre:not(:nth-child(${number+1}))`).forEach(e => {
            e.setAttribute("class", "");
        });
        document.getElementById("terminal"+number).setAttribute("class", "active");

        window.term[number].fit();
        window.terminalBridge.focus(window.term[number].id);
        window.term[number].resendCWD();

        window.fsDisp.followTab();
    } else if (number > 0 && number <= 4 && window.term[number] !== null && typeof window.term[number] !== "object") {
        window.term[number] = null;

        document.getElementById("shell_tab"+number).innerHTML = "<p>LOADING...</p>";
        ipc.send("ttyspawn", "true");
        ipc.once("ttyspawn-reply", (e, r) => {
            if (r.startsWith("ERROR")) {
                document.getElementById("shell_tab"+number).innerHTML = "<p>ERROR</p>";
            } else if (r.startsWith("SUCCESS")) {
                let port = Number(r.substr(9));

                window.term[number] = new Terminal({
                    role: "client",
                    parentId: "terminal"+number,
                    port
                });

                window.term[number].onclose = e => {
                    delete window.term[number].onprocesschange;
                    document.getElementById("shell_tab"+number).innerHTML = "<p>EMPTY</p>";
                    document.getElementById("terminal"+number).innerHTML = "";
                    window.terminalBridge.dispose(window.term[number].id);
                    delete window.term[number];
                    window.useAppShortcut("PREVIOUS_TAB");
                };

                window.term[number].onprocesschange = p => {
                    document.getElementById("shell_tab"+number).innerHTML = `<p>#${number+1} - ${p}</p>`;
                };

                document.getElementById("shell_tab"+number).innerHTML = `<p>::${port}</p>`;
                setTimeout(() => {
                    window.focusShellTab(number);
                }, 500);
            }
        });
    }
};

// Settings editor
window.openSettings = async () => {
    if (document.getElementById("settingsEditor")) return;

    // Build lists of available keyboards, themes, monitors
    let keyboards = "", themes = "", monitors = "", ifaces = "";
    try {
        const kbFiles = await window.electronAPI.readDir(keyboardsDir);
        kbFiles.forEach(kb => {
            if (!kb.endsWith(".json")) return;
            kb = kb.replace(".json", "");
            if (kb === window.settings.keyboard) return;
            keyboards += `<option>${kb}</option>`;
        });
    } catch (e) {
        console.error('Failed to read keyboards directory:', e);
    }
    
    try {
        const themeFiles = await window.electronAPI.readDir(themesDir);
        themeFiles.forEach(th => {
            if (!th.endsWith(".json")) return;
            th = th.replace(".json", "");
            if (th === window.settings.theme) return;
            themes += `<option>${th}</option>`;
        });
    } catch (e) {
        console.error('Failed to read themes directory:', e);
    }
    const displays = await window.electronAPI.getAllDisplays();
    for (let i = 0; i < displays.length; i++) {
        if (i !== window.settings.monitor) monitors += `<option>${i}</option>`;
    }
    let nets = await window.si.networkInterfaces();
    nets.forEach(net => {
        if (net.iface !== window.mods.netstat.iface) ifaces += `<option>${net.iface}</option>`;
    });

    // Unlink the tactile keyboard from the terminal emulator to allow filling in the settings fields
    window.keyboard.detach();

    new Modal({
        type: "custom",
        title: `Settings <i>(v${await window.electronAPI.getAppVersion()})</i>`,
        html: `<table id="settingsEditor">
                    <tr>
                        <th>Key</th>
                        <th>Description</th>
                        <th>Value</th>
                    </tr>
                    <tr>
                        <td>shell</td>
                        <td>The program to run as a terminal emulator</td>
                        <td><input type="text" id="settingsEditor-shell" value="${window.settings.shell}"></td>
                    </tr>
                    <tr>
                        <td>shellArgs</td>
                        <td>Arguments to pass to the shell</td>
                        <td><input type="text" id="settingsEditor-shellArgs" value="${window.settings.shellArgs || ''}"></td>
                    </tr>
                    <tr>
                        <td>cwd</td>
                        <td>Working Directory to start in</td>
                        <td><input type="text" id="settingsEditor-cwd" value="${window.settings.cwd}"></td>
                    </tr>
                    <tr>
                        <td>env</td>
                        <td>Custom shell environment override</td>
                        <td><input type="text" id="settingsEditor-env" value="${window.settings.env}"></td>
                    </tr>
                    <tr>
                        <td>username</td>
                        <td>Custom username to display at boot</td>
                        <td><input type="text" id="settingsEditor-username" value="${window.settings.username}"></td>
                    </tr>
                    <tr>
                        <td>keyboard</td>
                        <td>On-screen keyboard layout code</td>
                        <td><select id="settingsEditor-keyboard">
                            <option>${window.settings.keyboard}</option>
                            ${keyboards}
                        </select></td>
                    </tr>
                    <tr>
                        <td>theme</td>
                        <td>Name of the theme to load</td>
                        <td><select id="settingsEditor-theme">
                            <option>${window.settings.theme}</option>
                            ${themes}
                        </select></td>
                    </tr>
                    <tr>
                        <td>termFontSize</td>
                        <td>Size of the terminal text in pixels</td>
                        <td><input type="number" id="settingsEditor-termFontSize" value="${window.settings.termFontSize}"></td>
                    </tr>
                    <tr>
                        <td>audio</td>
                        <td>Activate audio sound effects</td>
                        <td><select id="settingsEditor-audio">
                            <option>${window.settings.audio}</option>
                            <option>${!window.settings.audio}</option>
                        </select></td>
                    </tr>
                    <tr>
                        <td>audioVolume</td>
                        <td>Set default volume for sound effects (0.0 - 1.0)</td>
                        <td><input type="number" id="settingsEditor-audioVolume" value="${window.settings.audioVolume || '1.0'}"></td>
                    </tr>
                    <tr>
                        <td>disableFeedbackAudio</td>
                        <td>Disable recurring feedback sound FX (input/output, mostly)</td>
                        <td><select id="settingsEditor-disableFeedbackAudio">
                            <option>${window.settings.disableFeedbackAudio}</option>
                            <option>${!window.settings.disableFeedbackAudio}</option>
                        </select></td>
                    </tr>
                    <tr>
                        <td>port</td>
                        <td>Local port to use for UI-shell connection</td>
                        <td><input type="number" id="settingsEditor-port" value="${window.settings.port}"></td>
                    </tr>
                    <tr>
                        <td>pingAddr</td>
                        <td>IPv4 address to test Internet connectivity</td>
                        <td><input type="text" id="settingsEditor-pingAddr" value="${window.settings.pingAddr || "1.1.1.1"}"></td>
                    </tr>
                    <tr>
                        <td>clockHours</td>
                        <td>Clock format (12/24 hours)</td>
                        <td><select id="settingsEditor-clockHours">
                            <option>${(window.settings.clockHours === 12) ? "12" : "24"}</option>
                            <option>${(window.settings.clockHours === 12) ? "24" : "12"}</option>
                        </select></td>
                    <tr>
                        <td>monitor</td>
                        <td>Which monitor to spawn the UI in (defaults to primary display)</td>
                        <td><select id="settingsEditor-monitor">
                            ${(typeof window.settings.monitor !== "undefined") ? "<option>"+window.settings.monitor+"</option>" : ""}
                            ${monitors}
                        </select></td>
                    </tr>
                    <tr>
                        <td>nointro</td>
                        <td>Skip the intro boot log and logo${(window.settings.nointroOverride) ? " (Currently overridden by CLI flag)" : ""}</td>
                        <td><select id="settingsEditor-nointro">
                            <option>${window.settings.nointro}</option>
                            <option>${!window.settings.nointro}</option>
                        </select></td>
                    </tr>
                    <tr>
                        <td>nocursor</td>
                        <td>Hide the mouse cursor${(window.settings.nocursorOverride) ? " (Currently overridden by CLI flag)" : ""}</td>
                        <td><select id="settingsEditor-nocursor">
                            <option>${window.settings.nocursor}</option>
                            <option>${!window.settings.nocursor}</option>
                        </select></td>
                    </tr>
                    <tr>
                        <td>iface</td>
                        <td>Override the interface used for network monitoring</td>
                        <td><select id="settingsEditor-iface">
                            <option>${window.mods.netstat.iface}</option>
                            ${ifaces}
                        </select></td>
                    </tr>
                    <tr>
                        <td>allowWindowed</td>
                        <td>Allow using F11 key to set the UI in windowed mode</td>
                        <td><select id="settingsEditor-allowWindowed">
                            <option>${window.settings.allowWindowed}</option>
                            <option>${!window.settings.allowWindowed}</option>
                        </select></td>
                    </tr>
                    <tr>
                        <td>keepGeometry</td>
                        <td>Try to keep a 16:9 aspect ratio in windowed mode</td>
                        <td><select id="settingsEditor-keepGeometry">
                            <option>${(window.settings.keepGeometry === false) ? 'false' : 'true'}</option>
                            <option>${(window.settings.keepGeometry === false) ? 'true' : 'false'}</option>
                        </select></td>
                    </tr>
                    <tr>
                        <td>excludeThreadsFromToplist</td>
                        <td>Display threads in the top processes list</td>
                        <td><select id="settingsEditor-excludeThreadsFromToplist">
                            <option>${window.settings.excludeThreadsFromToplist}</option>
                            <option>${!window.settings.excludeThreadsFromToplist}</option>
                        </select></td>
                    </tr>
                    <tr>
                        <td>hideDotfiles</td>
                        <td>Hide files and directories starting with a dot in file display</td>
                        <td><select id="settingsEditor-hideDotfiles">
                            <option>${window.settings.hideDotfiles}</option>
                            <option>${!window.settings.hideDotfiles}</option>
                        </select></td>
                    </tr>
                    <tr>
                        <td>fsListView</td>
                        <td>Show files in a more detailed list instead of an icon grid</td>
                        <td><select id="settingsEditor-fsListView">
                            <option>${window.settings.fsListView}</option>
                            <option>${!window.settings.fsListView}</option>
                        </select></td>
                    </tr>
                    <tr>
                        <td>experimentalGlobeFeatures</td>
                        <td>Toggle experimental features for the network globe</td>
                        <td><select id="settingsEditor-experimentalGlobeFeatures">
                            <option>${window.settings.experimentalGlobeFeatures}</option>
                            <option>${!window.settings.experimentalGlobeFeatures}</option>
                        </select></td>
                    </tr>
                    <tr>
                        <td>experimentalFeatures</td>
                        <td>Toggle Chrome's experimental web features (DANGEROUS)</td>
                        <td><select id="settingsEditor-experimentalFeatures">
                            <option>${window.settings.experimentalFeatures}</option>
                            <option>${!window.settings.experimentalFeatures}</option>
                        </select></td>
                    </tr>
                </table>
                <h6 id="settingsEditorStatus">Loaded values from memory</h6>
                <br>`,
        buttons: [
            {label: "Open in External Editor", action:`window.electronAPI.shellOpenPath('${settingsFile}');window.electronAPI.minimizeWindow();`},
            {label: "Save to Disk", action: "window.writeSettingsFile()"},
            {label: "Reload UI", action: "window.location.reload(true);"},
            {label: "Restart eDEX", action: "window.electronAPI.appRelaunch();"}
        ]
    }, () => {
        // Link the keyboard back to the terminal
        window.keyboard.attach();

        // Focus back on the term
        window.terminalBridge.focus(window.term[window.currentTerm].id);
    });
};

window.writeFile = async (path) => {
    try {
        await window.electronAPI.writeFile(path, document.getElementById("fileEdit").value, "utf-8");
        document.getElementById("fedit-status").innerHTML = "<i>File saved.</i>";
    } catch (error) {
        document.getElementById("fedit-status").innerHTML = `<i>Error saving file: ${error.message}</i>`;
    }
};

window.writeSettingsFile = () => {
    window.settings = {
        shell: document.getElementById("settingsEditor-shell").value,
        shellArgs: document.getElementById("settingsEditor-shellArgs").value,
        cwd: document.getElementById("settingsEditor-cwd").value,
        env: document.getElementById("settingsEditor-env").value,
        username: document.getElementById("settingsEditor-username").value,
        keyboard: document.getElementById("settingsEditor-keyboard").value,
        theme: document.getElementById("settingsEditor-theme").value,
        termFontSize: Number(document.getElementById("settingsEditor-termFontSize").value),
        audio: (document.getElementById("settingsEditor-audio").value === "true"),
        audioVolume: Number(document.getElementById("settingsEditor-audioVolume").value),
        disableFeedbackAudio: (document.getElementById("settingsEditor-disableFeedbackAudio").value === "true"),
        pingAddr: document.getElementById("settingsEditor-pingAddr").value,
        clockHours: Number(document.getElementById("settingsEditor-clockHours").value),
        port: Number(document.getElementById("settingsEditor-port").value),
        monitor: Number(document.getElementById("settingsEditor-monitor").value),
        nointro: (document.getElementById("settingsEditor-nointro").value === "true"),
        nocursor: (document.getElementById("settingsEditor-nocursor").value === "true"),
        iface: document.getElementById("settingsEditor-iface").value,
        allowWindowed: (document.getElementById("settingsEditor-allowWindowed").value === "true"),
        forceFullscreen: window.settings.forceFullscreen,
        keepGeometry: (document.getElementById("settingsEditor-keepGeometry").value === "true"),
        excludeThreadsFromToplist: (document.getElementById("settingsEditor-excludeThreadsFromToplist").value === "true"),
        hideDotfiles: (document.getElementById("settingsEditor-hideDotfiles").value === "true"),
        fsListView: (document.getElementById("settingsEditor-fsListView").value === "true"),
        experimentalGlobeFeatures: (document.getElementById("settingsEditor-experimentalGlobeFeatures").value === "true"),
        experimentalFeatures: (document.getElementById("settingsEditor-experimentalFeatures").value === "true")
    };

    Object.keys(window.settings).forEach(key => {
        if (window.settings[key] === "undefined") {
            delete window.settings[key];
        }
    });

    window.electronAPI.writeSettings(window.settings).then(() => {
        document.getElementById("settingsEditorStatus").innerText = "New values written to settings.json file at "+new Date().toTimeString();
    }).catch(err => {
        document.getElementById("settingsEditorStatus").innerText = "Error writing settings: "+err.message;
    });
};

window.toggleFullScreen = async () => {
    try {
        const isFullScreen = await window.electronAPI.isWindowFullScreen();
        const useFullscreen = !isFullScreen;
        await window.electronAPI.setWindowFullScreen(useFullscreen);

        //Update settings
        window.lastWindowState["useFullscreen"] = useFullscreen;

        window.electronAPI.writeWindowState(window.lastWindowState).catch(err => {
            console.error('Failed to write window state:', err);
        });
    } catch (error) {
        console.error('Failed to toggle fullscreen:', error);
    }
};

// Display available keyboard shortcuts and custom shortcuts helper
window.openShortcutsHelp = async () => {
    if (document.getElementById("settingsEditor")) return;

    const shortcutsDefinition = {
        "COPY": "Copy selected buffer from the terminal.",
        "PASTE": "Paste system clipboard to the terminal.",
        "NEXT_TAB": "Switch to the next opened terminal tab (left to right order).",
        "PREVIOUS_TAB": "Switch to the previous opened terminal tab (right to left order).",
        "TAB_X": "Switch to terminal tab <strong>X</strong>, or create it if it hasn't been opened yet.",
        "SETTINGS": "Open the settings editor.",
        "SHORTCUTS": "List and edit available keyboard shortcuts.",
        "FUZZY_SEARCH": "Search for entries in the current working directory.",
        "FS_LIST_VIEW": "Toggle between list and grid view in the file browser.",
        "FS_DOTFILES": "Toggle hidden files and directories in the file browser.",
        "KB_PASSMODE": "Toggle the on-screen keyboard's \"Password Mode\", which allows you to safely<br>type sensitive information even if your screen might be recorded (disable visual input feedback).",
        "DEV_DEBUG": "Open Chromium Dev Tools, for debugging purposes.",
        "DEV_RELOAD": "Trigger front-end hot reload."
    };

    let appList = "";
    window.shortcuts.filter(e => e.type === "app").forEach(cut => {
        let action = (cut.action.startsWith("TAB_")) ? "TAB_X" : cut.action;

        appList += `<tr>
                        <td>${(cut.enabled) ? 'YES' : 'NO'}</td>
                        <td><input disabled type="text" maxlength=25 value="${cut.trigger}"></td>
                        <td>${shortcutsDefinition[action]}</td>
                    </tr>`;
    });

    let customList = "";
    window.shortcuts.filter(e => e.type === "shell").forEach(cut => {
        customList += `<tr>
                            <td>${(cut.enabled) ? 'YES' : 'NO'}</td>
                            <td><input disabled type="text" maxlength=25 value="${cut.trigger}"></td>
                            <td>
                                <input disabled type="text" placeholder="Run terminal command..." value="${cut.action}">
                                <input disabled type="checkbox" name="shortcutsHelpNew_Enter" ${(cut.linebreak) ? 'checked' : ''}>
                                <label for="shortcutsHelpNew_Enter">Enter</label>
                            </td>
                        </tr>`;
    });

    window.keyboard.detach();
    new Modal({
        type: "custom",
        title: `Available Keyboard Shortcuts <i>(v${await window.electronAPI.getAppVersion()})</i>`,
        html: `<h5>Using either the on-screen or a physical keyboard, you can use the following shortcuts:</h5>
                <details open id="shortcutsHelpAccordeon1">
                    <summary>Emulator shortcuts</summary>
                    <table class="shortcutsHelp">
                        <tr>
                            <th>Enabled</th>
                            <th>Trigger</th>
                            <th>Action</th>
                        </tr>
                        ${appList}
                    </table>
                </details>
                <br>
                <details id="shortcutsHelpAccordeon2">
                    <summary>Custom command shortcuts</summary>
                    <table class="shortcutsHelp">
                        <tr>
                            <th>Enabled</th>
                            <th>Trigger</th>
                            <th>Command</th>
                        <tr>
                       ${customList}
                    </table>
                </details>
                <br>`,
        buttons: [
            {label: "Open Shortcuts File", action:`window.electronAPI.shellOpenPath('${shortcutsFile}');window.electronAPI.minimizeWindow();`},
            {label: "Reload UI", action: "window.location.reload(true);"},
        ]
    }, () => {
        window.keyboard.attach();
        window.terminalBridge.focus(window.term[window.currentTerm].id);
    });

    let wrap1 = document.getElementById('shortcutsHelpAccordeon1');
    let wrap2 = document.getElementById('shortcutsHelpAccordeon2');

    wrap1.addEventListener('toggle', e => {
        wrap2.open = !wrap1.open;
    });

    wrap2.addEventListener('toggle', e => {
        wrap1.open = !wrap2.open;
    });
};

window.useAppShortcut = action => {
    switch(action) {
        case "COPY":
            window.term[window.currentTerm].clipboard.copy();
            return true;
        case "PASTE":
            window.term[window.currentTerm].clipboard.paste();
            return true;
        case "NEXT_TAB":
                if (window.term[window.currentTerm+1]) {
                    window.focusShellTab(window.currentTerm+1);
                } else if (window.term[window.currentTerm+2]) {
                    window.focusShellTab(window.currentTerm+2);
                } else if (window.term[window.currentTerm+3]) {
                    window.focusShellTab(window.currentTerm+3);
                } else if (window.term[window.currentTerm+4]) {
                    window.focusShellTab(window.currentTerm+4);
                } else {
                    window.focusShellTab(0);
                }
            return true;
        case "PREVIOUS_TAB":
                let i = window.currentTerm || 4;
                if (window.term[i] && i !== window.currentTerm) {
                    window.focusShellTab(i);
                } else if (window.term[i-1]) {
                    window.focusShellTab(i-1);
                } else if (window.term[i-2]) {
                    window.focusShellTab(i-2);
                } else if (window.term[i-3]) {
                    window.focusShellTab(i-3);
                } else if (window.term[i-4]) {
                    window.focusShellTab(i-4);
                }
            return true;
        case "TAB_1":
            window.focusShellTab(0);
            return true;
        case "TAB_2":
            window.focusShellTab(1);
            return true;
        case "TAB_3":
            window.focusShellTab(2);
            return true;
        case "TAB_4":
            window.focusShellTab(3);
            return true;
        case "TAB_5":
            window.focusShellTab(4);
            return true;
        case "SETTINGS":
            window.openSettings();
            return true;
        case "SHORTCUTS":
            window.openShortcutsHelp();
            return true;
        case "FUZZY_SEARCH":
            window.activeFuzzyFinder = new FuzzyFinder();
            return true;
        case "FS_LIST_VIEW":
            window.fsDisp.toggleListview();
            return true;
        case "FS_DOTFILES":
            window.fsDisp.toggleHidedotfiles();
            return true;
        case "KB_PASSMODE":
            window.keyboard.togglePasswordMode();
            return true;
        case "DEV_DEBUG":
            window.electronAPI.toggleDevTools();
            return true;
        case "DEV_RELOAD":
            window.location.reload(true);
            return true;
        default:
            console.warn(`Unknown "${action}" app shortcut action`);
            return false;
    }
};

// Global keyboard shortcuts - now handled through secure IPC
window.electronAPI.globalShortcutUnregisterAll();

window.registerKeyboardShortcuts = async () => {
    // Ensure shortcuts are loaded before trying to iterate
    if (!window.shortcuts || !Array.isArray(window.shortcuts)) {
        console.warn('Shortcuts not loaded yet, skipping keyboard shortcut registration');
        return;
    }
    window.shortcuts.forEach(async cut => {
        if (!cut.enabled) return;

        if (cut.type === "app") {
            if (cut.action === "TAB_X") {
                for (let i = 1; i <= 5; i++) {
                    let trigger = cut.trigger.replace("X", i);
                    let callback = () => { window.useAppShortcut(`TAB_${i}`) };
                    await window.electronAPI.globalShortcutRegister(trigger, callback);
                }
            } else {
                let callback = () => { window.useAppShortcut(cut.action); };
                await window.electronAPI.globalShortcutRegister(cut.trigger, callback);
            }
        } else if (cut.type === "shell") {
            let callback = () => {
                let fn = (cut.linebreak) ? "writelr" : "write";
                window.term[window.currentTerm][fn](cut.action);
            };
            await window.electronAPI.globalShortcutRegister(cut.trigger, callback);
        } else {
            console.warn(`${cut.trigger} has unknown type`);
        }
    });
};

// See #361
window.addEventListener("focus", () => {
    window.registerKeyboardShortcuts();
});

window.addEventListener("blur", () => {
    window.electronAPI.globalShortcutUnregisterAll();
});

// Prevent showing menu, exiting fullscreen or app with keyboard shortcuts
document.addEventListener("keydown", e => {
    if (e.key === "Alt") {
        e.preventDefault();
    }
    if (e.code.startsWith("Alt") && e.ctrlKey && e.shiftKey) {
        e.preventDefault();
    }
    if (e.key === "F11" && !settings.allowWindowed) {
        e.preventDefault();
    }
    if (e.code === "KeyD" && e.ctrlKey) {
        e.preventDefault();
    }
    if (e.code === "KeyA" && e.ctrlKey) {
        e.preventDefault();
    }
});

// Fix #265
window.addEventListener("keyup", async e => {
    const platform = await window.electronAPI.getPlatform();
    if (platform === "win32" && e.key === "F4" && e.altKey === true) {
        window.electronAPI.appQuit();
    }
});

// Fix double-tap zoom on touchscreens
window.electronAPI.setVisualZoomLevelLimits(1, 1);

// Resize terminal with window
window.onresize = () => {
    if (typeof window.currentTerm !== "undefined") {
        if (typeof window.term[window.currentTerm] !== "undefined") {
            window.term[window.currentTerm].fit();
        }
    }
};

// See #413
window.resizeTimeout = null;
window.electronAPI.onWindowResize(() => {
    if (window.settings.keepGeometry === false) return;
    clearTimeout(window.resizeTimeout);
    window.resizeTimeout = setTimeout(async () => {
        try {
            const isFullScreen = await window.electronAPI.isWindowFullScreen();
            if (isFullScreen) return false;
            
            const isMaximized = await window.electronAPI.isWindowMaximized();
            if (isMaximized) {
                await window.electronAPI.unmaximizeWindow();
                await window.electronAPI.setWindowFullScreen(true);
                return false;
            }

            const size = await window.electronAPI.getWindowSize();
            if (size[0] >= size[1]) {
                await window.electronAPI.setWindowSize(size[0], parseInt(size[0] * 9 / 16));
            } else {
                await window.electronAPI.setWindowSize(size[1], parseInt(size[1] * 9 / 16));
            }
        } catch (error) {
            console.error('Error in window resize handler:', error);
        }
    }, 100);
});

window.electronAPI.onWindowLeaveFullScreen(() => {
    window.electronAPI.setWindowSize(960, 540);
});

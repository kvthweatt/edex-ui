/**
 * Terminal Backend Interface Specification
 * 
 * This interface defines the minimal contract that any PTY backend must satisfy
 * to be used as a replacement for the vulnerable node-pty library.
 * 
 * Based on audit of actual usage in eDEX-UI codebase:
 * - terminal.class.js lines 310, 415, 423, 454, 470, 472, 484
 * - _boot.js usage in multi-terminal spawning
 */

export interface ITerminalBackend {
    /**
     * Spawn a new pseudo-terminal process
     * @param shell - Path to shell executable (e.g., 'powershell.exe', '/bin/bash')
     * @param args - Array of arguments to pass to shell
     * @param options - PTY options
     * @returns ITty instance representing the spawned process
     */
    spawn(shell: string, args: string[], options: IPtyOptions): ITty;
}

export interface IPtyOptions {
    /** Terminal name (e.g., 'xterm-256color') */
    name?: string;
    /** Initial columns */
    cols?: number;
    /** Initial rows */
    rows?: number;
    /** Working directory */
    cwd?: string;
    /** Environment variables */
    env?: { [key: string]: string };
}

export interface ITty {
    /** Process ID of the spawned shell */
    readonly _pid: number;
    
    /** Current working directory (tracked by eDEX-UI) */
    _cwd?: string;
    
    /** Current process name (tracked by eDEX-UI) */
    _process?: string;
    
    /**
     * Write data to the terminal
     * @param data - Data to write to terminal input
     */
    write(data: string | Buffer): void;
    
    /**
     * Resize the terminal
     * @param cols - New column count
     * @param rows - New row count
     */
    resize(cols: number, rows: number): void;
    
    /**
     * Kill the terminal process
     * @param signal - Signal to send (optional)
     */
    kill(signal?: string): void;
    
    /**
     * Register callback for terminal output data
     * @param callback - Function to call when data is received
     */
    onData(callback: (data: string) => void): void;
    
    /**
     * Register callback for process exit
     * @param callback - Function to call when process exits
     */
    onExit(callback: (code: number, signal: number) => void): void;
}

/**
 * SECURITY REQUIREMENTS:
 * 
 * Any implementation must:
 * 1. NOT require native compilation during npm install
 * 2. Use ConPTY on Windows 10+ (no legacy WinPTY)
 * 3. Have no known high/critical CVEs
 * 4. Be actively maintained with security updates
 * 5. Sanitize shell paths and arguments
 * 6. Run with minimal privileges
 * 
 * COMPATIBILITY REQUIREMENTS:
 * 
 * Must work on:
 * - Windows 10+ (ConPTY)
 * - Linux (unix98 ptys)
 * - macOS (unix98 ptys)
 */

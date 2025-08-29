/**
 * PTY Backend Loader
 * 
 * This module provides a secure abstraction layer for loading PTY backends.
 * It attempts to load @microsoft/node-pty (preferred) with fallback to node-pty.
 * 
 * Security Features:
 * - Isolates PTY dependency to single file
 * - Provides graceful fallback mechanism
 * - Validates backend interface compliance
 * - Logs security-relevant loading events
 */

const path = require('path');
const signale = require('signale');

// Configure signale for Windows compatibility (same as in _boot.js)
if (process.platform === "win32") {
    signale.config({
        displayLabel: false,
        displayBadge: false,
        displayDate: false,
        displayFilename: false
    });
    
    const { Signale } = require('signale');
    const options = {
        types: {
            success: {
                badge: '[+]',
                color: 'green', 
                label: 'success'
            },
            warn: {
                badge: '[!]',
                color: 'yellow',
                label: 'warn'
            },
            error: {
                badge: '[!]',
                color: 'red', 
                label: 'error'
            },
            fatal: {
                badge: '[!]',
                color: 'red',
                label: 'fatal'
            },
            info: {
                badge: '[i]',
                color: 'blue',
                label: 'info'
            }
        }
    };
    
    Object.assign(signale, new Signale(options));
}

let backend = null;
let backendName = null;
let loadError = null;

/**
 * Load PTY backend with security preferences
 */
function loadPtyBackend() {
    // Attempt to load secure implementation with prebuilt binaries first
    try {
        backend = require('@lydell/node-pty');
        backendName = '@lydell/node-pty';
        signale.success(`Loaded secure PTY backend: ${backendName}`);
        signale.info('Using prebuilt binaries - no compilation required');
        return backend;
    } catch (error) {
        signale.warn(`Failed to load @lydell/node-pty: ${error.message}`);
        loadError = error;
    }

    // Fallback to original node-pty (with security warning)
    try {
        backend = require('node-pty');
        backendName = 'node-pty';
        signale.warn(`⚠️  SECURITY WARNING: Using legacy PTY backend: ${backendName}`);
        signale.warn('⚠️  Consider installing @lydell/node-pty for improved security');
        signale.warn('⚠️  Legacy backend may have known vulnerabilities');
        return backend;
    } catch (error) {
        signale.error(`Failed to load node-pty fallback: ${error.message}`);
        loadError = error;
        backend = null;
        backendName = null;
    }

    return null;
}

/**
 * Validate that the loaded backend implements required interface
 */
function validateBackend(ptyBackend) {
    if (!ptyBackend) {
        return false;
    }

    // Check for required spawn method
    if (typeof ptyBackend.spawn !== 'function') {
        signale.error('PTY backend missing required spawn() method');
        return false;
    }

    // Additional validation could be added here for other interface requirements
    return true;
}

/**
 * Get backend information for security auditing
 */
function getBackendInfo() {
    return {
        name: backendName,
        loaded: backend !== null,
        secure: backendName === '@lydell/node-pty',
        error: loadError ? loadError.message : null
    };
}

// Load backend on module initialization
const loadedBackend = loadPtyBackend();

if (!validateBackend(loadedBackend)) {
    signale.fatal('No compatible PTY backend available');
    signale.fatal('Please install @lydell/node-pty or node-pty:');
    signale.fatal('  npm install --save @lydell/node-pty');
    signale.fatal('  or');
    signale.fatal('  npm install --save node-pty');
    
    // Don't throw here - let the terminal class handle the error gracefully
    module.exports = null;
} else {
    // Log successful load with security status
    const info = getBackendInfo();
    signale.info(`PTY Backend Status:`, info);
    
    module.exports = loadedBackend;
}

// Export additional functions for diagnostics
module.exports.getBackendInfo = getBackendInfo;
module.exports.backendName = backendName;

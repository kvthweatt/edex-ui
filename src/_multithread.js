const cluster = require("cluster");

if (cluster.isPrimary) {
    const electron = require("electron");
    const ipc = electron.ipcMain;
    const signale = require("signale");
    
    // Configure signale for Windows compatibility
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
                info: {
                    badge: '[i]',
                    color: 'blue',
                    label: 'info'
                }
            }
        };
        
        Object.assign(signale, new Signale(options));
    }
    // Also, leave a core available for the renderer process
    const osCPUs = require("os").cpus().length - 1;
    // See #904
    const numCPUs = (osCPUs > 7) ? 7 : osCPUs;

    const si = require("systeminformation");

    cluster.setupMaster({
        exec: require("path").join(__dirname, "_multithread.js")
    });

    let workers = [];
    cluster.on("fork", worker => {
        workers.push(worker.id);
    });

    for (let i = 0; i < numCPUs; i++) {
        cluster.fork();
    }

    signale.success("Multithreaded controller ready");

    var lastID = 0;

    function dispatch(type, id, arg) {
        let selectedID = lastID+1;
        if (selectedID > numCPUs-1) selectedID = 0;

        const worker = cluster.workers[workers[selectedID]];
        if (!worker) {
            signale.warn(`Worker ${workers[selectedID]} not available`);
            // Fallback to direct call
            if (queue[id] && !queue[id].isDestroyed()) {
                si[type](arg).then(res => {
                    queue[id].send("systeminformation-reply-"+id, res);
                    delete queue[id];
                }).catch(error => {
                    signale.warn(`Error in direct systeminformation.${type}:`, error.message);
                    delete queue[id];
                });
            }
            return;
        }

        worker.send(JSON.stringify({
            id,
            type,
            arg
        }));

        lastID = selectedID;
    }

    var queue = {};
    ipc.on("systeminformation-call", (e, type, id, ...args) => {
        if (!si[type]) {
            signale.warn("Illegal request for systeminformation");
            return;
        }

        if (args.length > 1 || workers.length <= 0) {
            si[type](...args).then(res => {
                if (e.sender) {
                    e.sender.send("systeminformation-reply-"+id, res);
                }
            });
        } else {
            queue[id] = e.sender;
            dispatch(type, id, args[0]);
        }
    });

    cluster.on("message", (worker, msg) => {
        msg = JSON.parse(msg);
        try {
            if (!queue[msg.id].isDestroyed()) {
                queue[msg.id].send("systeminformation-reply-"+msg.id, msg.res);
                delete queue[msg.id];
            }
        } catch(e) {
            // Window has been closed, ignore.
        }
    });
} else if (cluster.isWorker) {
    const signale = require("signale");
    
    // Configure signale for Windows compatibility in worker
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
                info: {
                    badge: '[i]',
                    color: 'blue',
                    label: 'info'
                }
            }
        };
        
        Object.assign(signale, new Signale(options));
    }
    
    const si = require("systeminformation");

    signale.info("Multithread worker started at "+process.pid);

    process.on("message", msg => {
        try {
            msg = JSON.parse(msg);
            
            // Check if the function exists
            if (!si[msg.type] || typeof si[msg.type] !== 'function') {
                signale.warn(`Unknown systeminformation function: ${msg.type}`);
                process.send(JSON.stringify({
                    id: msg.id,
                    error: `Unknown function: ${msg.type}`
                }));
                return;
            }
            
            // Call the function and handle both Promise and non-Promise returns
            const result = si[msg.type](msg.arg);
            
            if (result && typeof result.then === 'function') {
                // It's a Promise
                result.then(res => {
                    process.send(JSON.stringify({
                        id: msg.id,
                        res
                    }));
                }).catch(error => {
                    signale.warn(`Error in systeminformation.${msg.type}:`, error.message);
                    process.send(JSON.stringify({
                        id: msg.id,
                        error: error.message
                    }));
                });
            } else {
                // It's not a Promise, send result directly
                process.send(JSON.stringify({
                    id: msg.id,
                    res: result
                }));
            }
        } catch (error) {
            signale.warn(`Error processing systeminformation message:`, error.message);
            process.send(JSON.stringify({
                id: msg.id,
                error: error.message
            }));
        }
    });
}

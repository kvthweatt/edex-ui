class UpdateChecker {
    constructor() {
        this.init();
    }

    async init() {
        let https = require("https");
        let current = await window.electronAPI.getAppVersion();

        this._failed = false;
        this._willfail = false;
        this._fail = e => {
            this._failed = true;
            window.electronAPI.send("log", "note", "UpdateChecker: Could not fetch latest release from GitHub's API.");
            window.electronAPI.send("log", "debug", `Error: ${e}`);
        };

        https.get({
            protocol: "https:",
            host: "api.github.com",
            path: "/repos/GitSquared/edex-ui/releases/latest",
            headers: {
                "User-Agent": "eDEX-UI UpdateChecker"
            }
        }, res => {
            switch(res.statusCode) {
                case 200:
                    break;
                case 404:
                    this._fail("Got 404 (Not Found) response from server");
                    break;
                default:
                    this._willfail = true;
            }

            let rawData = "";

            res.on('data', chunk => {
                rawData += chunk;
            });

            res.on('end', () => {
                let d = rawData;
                if (this._failed === true) {
                    // Do nothing, it already failed
                } else if (this._willfail) {
                    this._fail(d.toString());
                } else {
                    try {
                        let release = JSON.parse(d.toString());
                        if (release.tag_name.slice(1) === current) {
                            window.electronAPI.send("log", "info", "UpdateChecker: Running latest version.");
                        } else if (Number(release.tag_name.slice(1).replace(/\./g, "")) < Number(current.replace("-pre", "").replace(/\./g, ""))) {
                            window.electronAPI.send("log", "info", "UpdateChecker: Running an unreleased, development version.");
                        } else {
                            new Modal({
                                type: "info",
                                title: "New version available",
                                message: `eDEX-UI <strong>${release.tag_name}</strong> is now available.<br/>Head over to <a href="#" onclick="window.electronAPI.shellOpenExternal('${release.html_url}')">github.com</a> to download the latest version.`
                            });
                            window.electronAPI.send("log", "info", `UpdateChecker: New version ${release.tag_name} available.`);
                        }
                    } catch(e) {
                        this._fail(e);
                    }
                }
            });
        }).on('error', e => {
            this._fail(e);
        });
    }
}

module.exports = {
    UpdateChecker
};

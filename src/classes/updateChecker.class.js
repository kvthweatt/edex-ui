class UpdateChecker {
    constructor() {
        this.init();
    }

    async init() {
        // Use fetch API instead of Node.js https module
        let current = await window.electronAPI.getAppVersion();

        this._failed = false;
        this._fail = e => {
            this._failed = true;
            window.electronAPI.send("log", "note", "UpdateChecker: Could not fetch latest release from GitHub's API.");
            window.electronAPI.send("log", "debug", `Error: ${e}`);
        };

        try {
            const response = await fetch('https://api.github.com/repos/GitSquared/edex-ui/releases/latest', {
                headers: {
                    'User-Agent': 'eDEX-UI UpdateChecker'
                }
            });

            if (response.status === 404) {
                this._fail("Got 404 (Not Found) response from server");
                return;
            }

            if (!response.ok) {
                this._fail(`HTTP ${response.status}: ${response.statusText}`);
                return;
            }

            const release = await response.json();
            
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
            this._fail(e.message || e);
        }
    }
}

module.exports = {
    UpdateChecker
};

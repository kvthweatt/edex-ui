console.log("TEST RENDERER: Script started");

// Test if basic DOM access works
if (document.getElementById("boot_screen")) {
    document.getElementById("boot_screen").innerHTML = "TEST RENDERER LOADED";
    console.log("TEST RENDERER: Boot screen found and updated");
} else {
    console.log("TEST RENDERER: Boot screen not found");
}

// Test if window.electronAPI is available
if (window.electronAPI) {
    console.log("TEST RENDERER: electronAPI is available");
} else {
    console.log("TEST RENDERER: electronAPI is NOT available");
}

console.log("TEST RENDERER: Script finished loading");

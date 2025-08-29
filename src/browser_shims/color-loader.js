// Browser-compatible color library loader for eDEX-UI
// This is a temporary shim to load the color library without require()

(function() {
    'use strict';
    
    // Simple fallback Color constructor for cases where the real library fails to load
    function FallbackColor(colorString) {
        this.hex = function() {
            return colorString;
        };
        
        this.grayscale = function() {
            return {
                mix: function(other, ratio) {
                    return {
                        hex: function() {
                            return colorString; // Simple fallback - return original color
                        }
                    };
                }
            };
        };
        
        // Add other methods that terminal.class.js might use
        const methods = ['lighten', 'darken', 'saturate', 'desaturate', 'whiten', 'blacken', 'fade', 'opaquer', 'rotate', 'mix', 'negate'];
        methods.forEach(method => {
            this[method] = function() {
                return new FallbackColor(colorString);
            };
        });
    }
    
    // Create a Color constructor wrapper 
    function ColorWrapper(colorString) {
        return new FallbackColor(colorString);
    }
    
    // Expose Color to window for terminal.class.js to use
    window.Color = ColorWrapper;
    
    console.log('[COLOR-LOADER] Browser Color fallback loaded');
})();

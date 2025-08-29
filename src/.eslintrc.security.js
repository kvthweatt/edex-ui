/**
 * Security-focused ESLint rules for eDEX-UI
 * 
 * These rules enforce security best practices and prevent
 * regression to vulnerable patterns.
 */

module.exports = {
  "rules": {
    // Prevent direct usage of vulnerable node-pty
    "no-restricted-imports": [
      "error", 
      {
        "paths": [
          {
            "name": "node-pty",
            "message": "Direct node-pty usage is forbidden. Use './ptyLoader' abstraction instead for security."
          }
        ],
        "patterns": [
          {
            "group": ["**/node-pty"],
            "message": "Direct node-pty usage is forbidden. Use './ptyLoader' abstraction instead."
          }
        ]
      }
    ],
    
    // Prevent require() of node-pty
    "no-restricted-syntax": [
      "error",
      {
        "selector": "CallExpression[callee.name='require'][arguments.0.value='node-pty']",
        "message": "Direct require('node-pty') is forbidden. Use require('./ptyLoader') instead for security."
      }
    ]
  },
  
  "overrides": [
    {
      // Allow ptyLoader itself to import backends
      "files": ["**/ptyLoader.js"],
      "rules": {
        "no-restricted-imports": "off",
        "no-restricted-syntax": "off"
      }
    }
  ]
};

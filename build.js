const fs = require('fs');

// Read the template env.js file
const envFile = fs.readFileSync('env.js', 'utf8');

// Replace the placeholder with actual environment variable
const updatedEnvFile = envFile.replace(
    '{{OPENROUTER_API_KEY}}',
    process.env.OPENROUTER_API_KEY || ''
);

// Write the updated content back to env.js
fs.writeFileSync('env.js', updatedEnvFile); 
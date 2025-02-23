const fs = require('fs');
const path = require('path');

// Read the template env.js file
const envFile = fs.readFileSync('env.js', 'utf8');

// Get the API key from environment variables
const apiKey = process.env.OPENROUTER_API_KEY;
if (!apiKey) {
    console.error('Error: OPENROUTER_API_KEY environment variable is not set');
    process.exit(1);
}

// Replace the placeholder with actual environment variable
const updatedEnvFile = envFile.replace(
    '{{OPENROUTER_API_KEY}}',
    apiKey
);

// Write the updated content back to env.js
fs.writeFileSync('env.js', updatedEnvFile);

console.log('Successfully updated env.js with environment variables'); 
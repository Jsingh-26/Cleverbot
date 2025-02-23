// Initialize environment variables
(function() {
    // Load environment variables
    const loadEnvironmentVariables = () => {
        try {
            // Development environment - use local values
            if (window.location.hostname === 'localhost') {
                return {
                    OPENROUTER_API_KEY: 'REDACTED_OPENROUTER_KEY',
                    API_URL: 'https://openrouter.ai/api/v1/chat/completions'
                };
            }
            
            // Production environment - these should be set in Netlify environment variables
            const netlifyKey = '{{OPENROUTER_API_KEY}}';
            // Check if Netlify has replaced the placeholder
            const apiKey = netlifyKey === '{{OPENROUTER_API_KEY}}' 
                ? 'REDACTED_OPENROUTER_KEY'  // Fallback to dev key
                : netlifyKey;
            
            return {
                OPENROUTER_API_KEY: apiKey,
                API_URL: 'https://openrouter.ai/api/v1/chat/completions'
            };
        } catch (error) {
            console.error('Error loading environment variables:', error);
            return null;
        }
    };

    // Set up window.ENV
    window.ENV = loadEnvironmentVariables();

    // Log environment status (masked)
    if (window.ENV) {
        const maskedKey = window.ENV.OPENROUTER_API_KEY.substring(0, 6) + '...' + 
                         window.ENV.OPENROUTER_API_KEY.slice(-4);
        console.log('Environment variables loaded:', {
            hasApiKey: !!window.ENV.OPENROUTER_API_KEY,
            keyPrefix: maskedKey,
            apiUrl: window.ENV.API_URL,
            environment: window.location.hostname === 'localhost' ? 'development' : 'production'
        });
    }
})(); 
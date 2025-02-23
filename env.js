// Initialize environment variables
(function() {
    // Load environment variables
    const loadEnvironmentVariables = () => {
        try {
            // Development environment - use local values
            if (window.location.hostname === 'localhost') {
                return {
                    OPENROUTER_API_KEY: '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',
                    API_URL: 'https://openrouter.ai/api/v1/chat/completions'
                };
            }
            
            // Production environment - these should be set in Netlify environment variables
            // Netlify replaces {{OPENROUTER_API_KEY}} with actual value during build
            return {
                OPENROUTER_API_KEY: '{{OPENROUTER_API_KEY}}',
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
                         window.ENV.OPENROUTER_API_KEY.substring(-4);
        console.log('Environment variables loaded:', {
            hasApiKey: !!window.ENV.OPENROUTER_API_KEY,
            keyPrefix: maskedKey,
            apiUrl: window.ENV.API_URL,
            environment: window.location.hostname === 'localhost' ? 'development' : 'production'
        });
    }
})(); 
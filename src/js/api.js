import { API_URL, API_KEY, MODELS } from './config.js';

// API module for OpenRouter
export class API {
    constructor() {
        this.API_URL = API_URL;
        this.API_KEY = API_KEY;
    }

    // Main API call method
    async sendMessage(message, modelId) {
        try {
            const response = await fetch(this.API_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.API_KEY}`,
                    'HTTP-Referer': window.location.href,
                    'X-Title': 'Cleverbot'
                },
                body: JSON.stringify({
                    model: modelId,
                    messages: [
                        { role: 'user', content: message }
                    ]
                })
            });

            if (!response.ok) {
                throw await this.handleErrorResponse(response);
            }

            const data = await response.json();
            return {
                success: true,
                message: data.choices[0].message.content,
                modelId: modelId
            };
        } catch (error) {
            return {
                success: false,
                error: this.formatError(error)
            };
        }
    }

    // Error handling methods
    async handleErrorResponse(response) {
        const errorData = await response.json().catch(() => ({}));
        const error = new Error(errorData.error?.message || 'Failed to get response from the model');
        error.status = response.status;
        error.statusText = response.statusText;
        return error;
    }

    formatError(error) {
        if (error.status === 429) {
            return new Error('Rate limit exceeded. Please try again later.');
        }
        if (error.status === 401) {
            return new Error('Invalid API key. Please check your configuration.');
        }
        if (error.status === 404) {
            return new Error('Selected model is currently unavailable.');
        }
        return error;
    }
}

// Export a singleton instance
export const api = new API();

// Utility function to handle API errors
const handleApiError = (error, modelIndex) => {
    const errorMessage = error.message || 'An unknown error occurred';
    console.error(`Error with model ${MODELS[modelIndex]}:`, errorMessage);
    return {
        success: false,
        error: errorMessage
    };
};

// Function to make API requests with retries
export const makeApiRequest = async (message, modelIndex, maxRetries = 3) => {
    if (!API_KEY) {
        console.error('API key is not configured. Check your environment variables.');
        return handleApiError(new Error('API key is not configured'), modelIndex);
    }

    let retries = 0;
    
    while (retries < maxRetries) {
        try {
            console.log(`Attempting request with model: ${MODELS[modelIndex]}`);
            
            const response = await fetch(API_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${API_KEY}`,
                    'HTTP-Referer': window.location.origin,
                    'X-Title': 'Cleverbot'
                },
                body: JSON.stringify({
                    model: MODELS[modelIndex],
                    messages: [
                        { role: 'user', content: message }
                    ],
                    stream: true,
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error?.message || `HTTP error! status: ${response.status}`);
            }

            console.log(`Successful response from model: ${MODELS[modelIndex]}`);
            return {
                success: true,
                response
            };
        } catch (error) {
            console.error(`Attempt ${retries + 1} failed for model ${MODELS[modelIndex]}:`, error.message);
            retries++;
            if (retries === maxRetries) {
                return handleApiError(error, modelIndex);
            }
            // Wait before retrying (exponential backoff)
            await new Promise(resolve => setTimeout(resolve, Math.pow(2, retries) * 1000));
        }
    }
};

// Function to process streaming response
export const processStream = async (response, onChunk) => {
    try {
        const reader = response.body.getReader();
        const textDecoder = new TextDecoder();

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = textDecoder.decode(value);
            const lines = chunk.split('\n');
            
            for (const line of lines) {
                if (line.startsWith('data: ')) {
                    try {
                        const data = JSON.parse(line.substring(6));
                        if (data.choices && data.choices[0].delta?.content) {
                            onChunk(data.choices[0].delta.content);
                        }
                    } catch (e) {
                        console.error('Error parsing stream chunk:', e);
                        if (line.includes('[DONE]')) {
                            console.log('Stream completed');
                            return;
                        }
                    }
                }
            }
        }
    } catch (error) {
        console.error('Error processing stream:', error);
        throw error;
    }
}; 
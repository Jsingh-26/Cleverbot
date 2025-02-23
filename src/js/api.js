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
    const modelId = MODELS[modelIndex];
    console.error(`Error with model ${modelId}:`, {
        error: errorMessage,
        modelIndex,
        modelId,
        status: error.status,
        statusText: error.statusText
    });
    return {
        success: false,
        error: errorMessage,
        modelId
    };
};

// Function to make API requests with retries
export const makeApiRequest = async (message, modelIndex, maxRetries = 3) => {
    if (!API_KEY) {
        console.error('API key is not configured. Check your environment variables.');
        return handleApiError(new Error('API key is not configured'), modelIndex);
    }

    const modelId = MODELS[modelIndex];
    console.log(`Starting request for model ${modelId}`, {
        modelIndex,
        messageLength: message.length,
        retryLimit: maxRetries
    });

    let retries = 0;
    
    while (retries < maxRetries) {
        try {
            console.log(`Attempt ${retries + 1} for model ${modelId}`);
            
            const response = await fetch(API_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${API_KEY}`,
                    'HTTP-Referer': window.location.origin,
                    'X-Title': 'Cleverbot'
                },
                body: JSON.stringify({
                    model: modelId,
                    messages: [
                        { role: 'user', content: message }
                    ],
                    stream: true,
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                console.error(`HTTP error for model ${modelId}:`, {
                    status: response.status,
                    statusText: response.statusText,
                    errorData
                });
                throw new Error(errorData.error?.message || `HTTP error! status: ${response.status}`);
            }

            console.log(`Successful response from model ${modelId}`);
            return {
                success: true,
                response,
                modelId
            };
        } catch (error) {
            console.error(`Attempt ${retries + 1} failed for model ${modelId}:`, {
                error: error.message,
                attempt: retries + 1,
                maxRetries
            });
            retries++;
            if (retries === maxRetries) {
                return handleApiError(error, modelIndex);
            }
            // Wait before retrying (exponential backoff)
            const delay = Math.pow(2, retries) * 1000;
            console.log(`Waiting ${delay}ms before retry...`);
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }
};

// Function to process streaming response
export const processStream = async (response, onChunk) => {
    try {
        const reader = response.body.getReader();
        const textDecoder = new TextDecoder();
        let accumulatedText = '';

        console.log('Starting to process stream');

        while (true) {
            const { done, value } = await reader.read();
            if (done) {
                console.log('Stream completed', {
                    totalLength: accumulatedText.length
                });
                break;
            }

            const chunk = textDecoder.decode(value);
            const lines = chunk.split('\n');
            
            for (const line of lines) {
                if (line.startsWith('data: ')) {
                    try {
                        const data = JSON.parse(line.substring(6));
                        if (data.choices && data.choices[0].delta?.content) {
                            const content = data.choices[0].delta.content;
                            accumulatedText += content;
                            onChunk(content);
                        }
                    } catch (e) {
                        console.error('Error parsing stream chunk:', {
                            error: e.message,
                            line: line.substring(0, 50) + '...' // Only log first 50 chars
                        });
                        if (line.includes('[DONE]')) {
                            console.log('Stream completed with [DONE] signal');
                            return;
                        }
                    }
                }
            }
        }
    } catch (error) {
        console.error('Error processing stream:', {
            error: error.message,
            stack: error.stack
        });
        throw error;
    }
}; 
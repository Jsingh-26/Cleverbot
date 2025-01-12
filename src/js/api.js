// API module for OpenRouter
export class API {
    constructor() {
        this.API_URL = 'https://openrouter.ai/api/v1/chat/completions';
        this.API_KEY = 'REDACTED_OPENROUTER_KEY';
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
import { makeApiRequest, processStream } from '../api.js';
import { MODELS } from '../config.js';

describe('API Module', () => {
    test('makeApiRequest should handle successful API calls', async () => {
        global.fetch = jest.fn(() =>
            Promise.resolve({
                ok: true,
                body: {
                    getReader: () => ({
                        read: () => Promise.resolve({ done: true })
                    })
                }
            })
        );

        const result = await makeApiRequest('Hello', 0);
        expect(result.success).toBe(true);
        expect(result.response).toBeDefined();
    });

    test('makeApiRequest should handle API errors', async () => {
        global.fetch = jest.fn(() =>
            Promise.resolve({
                ok: false,
                json: () => Promise.resolve({
                    error: { message: 'Test error' }
                })
            })
        );

        const result = await makeApiRequest('Hello', 0);
        expect(result.success).toBe(false);
        expect(result.error).toBeDefined();
    });
}); 
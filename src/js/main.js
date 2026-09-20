// Cleverbot entry point.
// Loaded as a module, so it runs deferred — the DOM is fully parsed by now.

import { sendMessage, messageHistory } from './app.js';
import { ui } from './ui.js';
import { fetchRankedModels } from './api.js';
import { setActiveModels, getModels, getModelInfo } from './config.js';
import './theme.js';

// Syntax highlighting setup (window.hljs comes from the CDN script).
if (window.hljs) {
    window.hljs.configure({
        ignoreUnescapedHTML: true,
        languages: ['javascript', 'python', 'bash', 'json', 'markdown']
    });
}

// Ask the server which supported models are currently live, then order the
// fallback chain best-first. Runs on every page load, so the "best" model
// tracks whatever is healthy right now.
(async () => {
    const ranked = await fetchRankedModels();
    if (ranked?.length) {
        setActiveModels(ranked);
        console.log('Live model order (best first):', getModels());
    } else {
        console.warn('Availability check failed; using static fallback order:', getModels());
    }
    const best = getModels()[0];
    console.log(`Best model right now: ${getModelInfo(best).name} (${best})`);
})();

// Expose for debugging in the browser console.
window.sendMessage = sendMessage;
window.messageHistory = messageHistory;
window.ui = ui;

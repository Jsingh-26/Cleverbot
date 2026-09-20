import React from 'react';
import ReactDOM from 'react-dom/client';
import { ConvexAuthProvider } from '@convex-dev/auth/react';
import { ConvexReactClient } from 'convex/react';
import App from './App';
import { fetchRankedModels } from './lib/api';
import { getModelInfo, getModels, setActiveModels } from './lib/config';
import './css/styles.css';
import 'highlight.js/styles/github.css';

const convexUrl = import.meta.env.VITE_CONVEX_URL;
if (!convexUrl) {
  console.warn(
    'VITE_CONVEX_URL is not set. Auth and saved history will not work until you configure Convex.',
  );
}

const convex = new ConvexReactClient(convexUrl || 'https://placeholder.convex.cloud');

void (async () => {
  const ranked = await fetchRankedModels();
  if (ranked?.length) {
    setActiveModels(ranked);
    console.log('Live model order (best first):', getModels());
  } else {
    console.warn('Availability check failed; using static fallback order:', getModels());
  }
  const best = getModels()[0];
  if (best) {
    console.log(`Best model right now: ${getModelInfo(best).name} (${best})`);
  }
})();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ConvexAuthProvider client={convex}>
      <App />
    </ConvexAuthProvider>
  </React.StrictMode>,
);

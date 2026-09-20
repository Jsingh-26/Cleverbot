import React from 'react';
import ReactDOM from 'react-dom/client';
import { ConvexAuthProvider } from '@convex-dev/auth/react';
import { ConvexReactClient } from 'convex/react';
import App from './App';
import './css/styles.css';
import 'highlight.js/styles/github.css';

const convexUrl = import.meta.env.VITE_CONVEX_URL;
if (!convexUrl) {
  console.warn(
    'VITE_CONVEX_URL is not set. Auth and saved history will not work until you configure Convex.',
  );
}

const convex = new ConvexReactClient(convexUrl || 'https://placeholder.convex.cloud');

// Model ranking is refreshed per chat in App (and again when images are attached).

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ConvexAuthProvider client={convex}>
      <App />
    </ConvexAuthProvider>
  </React.StrictMode>,
);

import { useCallback, useEffect, useState } from 'react';
import { useConvexAuth } from 'convex/react';
import type { Id } from '../convex/_generated/dataModel';
import { Sidebar } from './components/Sidebar';
import { ChatPane } from './components/ChatPane';
import { AuthOverlay } from './components/AuthOverlay';
import { refreshSessionModels } from './lib/api';
import { getModels } from './lib/config';

export default function App() {
  const { isAuthenticated } = useConvexAuth();
  const [activeThreadId, setActiveThreadId] = useState<Id<'threads'> | null>(null);
  const [guestEpoch, setGuestEpoch] = useState(0);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);
  const [modelEpoch, setModelEpoch] = useState(0);

  // Fresh live ranking on initial load and every new chat.
  useEffect(() => {
    void (async () => {
      const ids = await refreshSessionModels();
      console.log('Live model order for this chat (best first):', ids.length ? ids : getModels());
    })();
  }, [modelEpoch, guestEpoch]);

  useEffect(() => {
    if (isAuthenticated) setLoginOpen(false);
  }, [isAuthenticated]);

  const handleNewChat = useCallback(() => {
    setActiveThreadId(null);
    setModelEpoch((n) => n + 1);
    if (!isAuthenticated) {
      setGuestEpoch((n) => n + 1);
    }
    setSidebarOpen(false);
  }, [isAuthenticated]);

  const handleSelectThread = useCallback((id: Id<'threads'> | null) => {
    setActiveThreadId(id);
    setSidebarOpen(false);
  }, []);

  const openLogin = useCallback(() => setLoginOpen(true), []);
  const closeLogin = useCallback(() => setLoginOpen(false), []);

  return (
    <div className={`app-shell${sidebarOpen ? ' sidebar-open' : ''}`}>
      <button
        type="button"
        className="sidebar-toggle"
        aria-label="Toggle chat history"
        onClick={() => setSidebarOpen((v) => !v)}
      >
        ☰
      </button>
      <div className="sidebar-backdrop" onClick={() => setSidebarOpen(false)} aria-hidden="true" />
      <Sidebar
        activeThreadId={activeThreadId}
        onSelectThread={handleSelectThread}
        onNewChat={handleNewChat}
        onRequestLogin={openLogin}
      />
      <ChatPane
        key={isAuthenticated ? String(activeThreadId) : `guest-${guestEpoch}`}
        activeThreadId={activeThreadId}
        onThreadCreated={(id) => setActiveThreadId(id)}
        onRequestLogin={openLogin}
      />
      <AuthOverlay open={loginOpen} onClose={closeLogin} />
    </div>
  );
}

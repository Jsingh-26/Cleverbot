import { useCallback, useEffect, useState } from 'react';
import { useConvexAuth } from 'convex/react';
import type { Id } from '../convex/_generated/dataModel';
import { Sidebar } from './components/Sidebar';
import { ChatPane } from './components/ChatPane';
import { AuthOverlay } from './components/AuthOverlay';
import { refreshSessionModels } from './lib/api';

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
      await refreshSessionModels();
    })();
  }, [modelEpoch, guestEpoch]);

  useEffect(() => {
    if (isAuthenticated) setLoginOpen(false);
    else setSidebarOpen(false);
  }, [isAuthenticated]);

  useEffect(() => {
    if (!sidebarOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSidebarOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [sidebarOpen]);

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
    <div
      className={`app-shell${isAuthenticated ? ' app-shell--authed' : ' app-shell--guest'}${
        sidebarOpen ? ' sidebar-open' : ''
      }`}
    >
      {isAuthenticated && (
        <>
          <button
            type="button"
            className="sidebar-toggle"
            aria-label="Toggle chat history"
            aria-expanded={sidebarOpen}
            onClick={() => setSidebarOpen((v) => !v)}
          >
            ☰
          </button>
          <div
            className="sidebar-backdrop"
            onClick={() => setSidebarOpen(false)}
            aria-hidden="true"
          />
          <Sidebar
            activeThreadId={activeThreadId}
            onSelectThread={handleSelectThread}
            onNewChat={handleNewChat}
          />
        </>
      )}
      <ChatPane
        key={isAuthenticated ? String(activeThreadId) : `guest-${guestEpoch}`}
        activeThreadId={activeThreadId}
        onThreadCreated={(id) => setActiveThreadId(id)}
        onRequestLogin={openLogin}
        onNewChat={handleNewChat}
      />
      <AuthOverlay open={loginOpen} onClose={closeLogin} />
    </div>
  );
}

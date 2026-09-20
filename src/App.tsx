import { useCallback, useState } from 'react';
import { useConvexAuth } from 'convex/react';
import type { Id } from '../convex/_generated/dataModel';
import { Sidebar } from './components/Sidebar';
import { ChatPane } from './components/ChatPane';

export default function App() {
  const { isAuthenticated } = useConvexAuth();
  const [activeThreadId, setActiveThreadId] = useState<Id<'threads'> | null>(null);
  const [guestEpoch, setGuestEpoch] = useState(0);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleNewChat = useCallback(() => {
    setActiveThreadId(null);
    if (!isAuthenticated) {
      setGuestEpoch((n) => n + 1);
    }
    setSidebarOpen(false);
  }, [isAuthenticated]);

  const handleSelectThread = useCallback((id: Id<'threads'> | null) => {
    setActiveThreadId(id);
    setSidebarOpen(false);
  }, []);

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
      />
      <ChatPane
        key={isAuthenticated ? String(activeThreadId) : `guest-${guestEpoch}`}
        activeThreadId={activeThreadId}
        onThreadCreated={(id) => setActiveThreadId(id)}
      />
    </div>
  );
}

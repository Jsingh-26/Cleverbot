import { useConvexAuth, useMutation, useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import type { Id } from '../../convex/_generated/dataModel';

type Props = {
  activeThreadId: Id<'threads'> | null;
  onSelectThread: (id: Id<'threads'> | null) => void;
  onNewChat: () => void;
  onRequestLogin?: () => void;
};

export function Sidebar({ activeThreadId, onSelectThread, onNewChat, onRequestLogin }: Props) {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const threads = useQuery(api.threads.listThreads, isAuthenticated ? {} : 'skip');
  const deleteThread = useMutation(api.threads.deleteThread);

  return (
    <aside className="sidebar" aria-label="Chat history">
      <div className="sidebar-header">
        <div className="logo" role="heading" aria-level={1}>
          Cleverbot
        </div>
        <button type="button" className="new-chat-btn" onClick={onNewChat} disabled={isLoading}>
          New chat
        </button>
      </div>

      <div className="sidebar-body">
        {!isAuthenticated && !isLoading && (
          <div className="sidebar-cta sidebar-cta--hint">
            <p>
              {onRequestLogin ? (
                <>
                  <button type="button" className="auth-link sidebar-login-link" onClick={onRequestLogin}>
                    Log in
                  </button>
                  {' to save chats'}
                </>
              ) : (
                'Log in to save chats'
              )}
            </p>
          </div>
        )}

        {isAuthenticated && (
          <ul className="thread-list" role="list">
            {(threads ?? []).map((thread) => (
              <li key={thread._id}>
                <button
                  type="button"
                  className={`thread-item${activeThreadId === thread._id ? ' active' : ''}`}
                  onClick={() => onSelectThread(thread._id)}
                >
                  <span className="thread-title">{thread.title || 'New chat'}</span>
                </button>
                <button
                  type="button"
                  className="thread-delete"
                  aria-label={`Delete ${thread.title || 'chat'}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    void (async () => {
                      await deleteThread({ threadId: thread._id });
                      if (activeThreadId === thread._id) onSelectThread(null);
                    })();
                  }}
                >
                  ×
                </button>
              </li>
            ))}
            {threads && threads.length === 0 && (
              <li className="thread-empty">No saved chats yet. Send a message to start one.</li>
            )}
          </ul>
        )}
      </div>
    </aside>
  );
}

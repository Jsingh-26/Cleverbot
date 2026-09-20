import { useAuthActions } from '@convex-dev/auth/react';
import { useConvexAuth, useMutation, useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import type { Id } from '../../convex/_generated/dataModel';
import { AuthButton } from './AuthButton';

type Props = {
  activeThreadId: Id<'threads'> | null;
  onSelectThread: (id: Id<'threads'> | null) => void;
  onNewChat: () => void;
};

export function Sidebar({ activeThreadId, onSelectThread, onNewChat }: Props) {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const { signIn } = useAuthActions();
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
          <div className="sidebar-cta">
            <p>Sign in with Google to save chats</p>
            <button type="button" className="auth-button auth-button--signin" onClick={() => void signIn('google')}>
              Sign in with Google
            </button>
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

      <div className="sidebar-footer">
        <AuthButton />
      </div>
    </aside>
  );
}

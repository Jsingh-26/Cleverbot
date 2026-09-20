import { useMutation, useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import type { Id } from '../../convex/_generated/dataModel';

type Props = {
  activeThreadId: Id<'threads'> | null;
  onSelectThread: (id: Id<'threads'> | null) => void;
  onNewChat: () => void;
};

export function Sidebar({ activeThreadId, onSelectThread, onNewChat }: Props) {
  const threads = useQuery(api.threads.listThreads, {});
  const deleteThread = useMutation(api.threads.deleteThread);

  return (
    <aside className="sidebar" aria-label="Chat history">
      <div className="sidebar-header">
        <div className="logo" role="heading" aria-level={1}>
          Cleverbot
        </div>
        <button type="button" className="new-chat-btn" onClick={onNewChat}>
          New chat
        </button>
      </div>

      <div className="sidebar-body">
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
      </div>
    </aside>
  );
}

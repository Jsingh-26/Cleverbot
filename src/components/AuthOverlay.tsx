import { useEffect } from 'react';
import { AuthPanel } from './AuthPanel';

type Props = {
  open: boolean;
  onClose: () => void;
};

export function AuthOverlay({ open, onClose }: Props) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="auth-overlay" role="dialog" aria-modal="true" aria-label="Log in">
      <div className="auth-overlay-card">
        <div className="auth-overlay-header">
          <h2 className="auth-overlay-title">Log in to Cleverbot</h2>
          <button type="button" className="auth-overlay-close" onClick={onClose} aria-label="Close">
            ← Back
          </button>
        </div>
        <p className="auth-overlay-hint">Sign in with email to save your chats across devices.</p>
        <AuthPanel onSuccess={onClose} />
      </div>
    </div>
  );
}

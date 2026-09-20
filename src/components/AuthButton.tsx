import { useAuthActions } from '@convex-dev/auth/react';
import { useConvexAuth, useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { AuthPanel } from './AuthPanel';

export function AuthButton() {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const { signOut } = useAuthActions();
  const viewer = useQuery(api.users.viewer, isAuthenticated ? {} : 'skip');

  if (isLoading) {
    return <div className="auth-button auth-button--loading" aria-hidden="true" />;
  }

  if (!isAuthenticated) {
    return <AuthPanel compact />;
  }

  const label = viewer?.isAnonymous
    ? 'Anonymous'
    : viewer?.name || viewer?.email || 'Signed in';
  const initial = label.charAt(0).toUpperCase();

  return (
    <div className="auth-user">
      {viewer?.image ? (
        <img className="user-avatar-img" src={viewer.image} alt="" referrerPolicy="no-referrer" />
      ) : (
        <div className="user-avatar" title={label} aria-label={label}>
          {initial}
        </div>
      )}
      <div className="auth-user-meta">
        <span className="auth-user-label">{label}</span>
        <button type="button" className="auth-button auth-button--signout" onClick={() => void signOut()}>
          Sign out
        </button>
      </div>
    </div>
  );
}

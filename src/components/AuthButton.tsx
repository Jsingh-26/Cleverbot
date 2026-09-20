import { useAuthActions } from '@convex-dev/auth/react';
import { useConvexAuth, useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';

export function AuthButton() {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const { signIn, signOut } = useAuthActions();
  const viewer = useQuery(api.users.viewer, isAuthenticated ? {} : 'skip');

  if (isLoading) {
    return <div className="auth-button auth-button--loading" aria-hidden="true" />;
  }

  if (!isAuthenticated) {
    return (
      <button
        type="button"
        className="auth-button auth-button--signin"
        onClick={() => void signIn('google')}
      >
        Sign in with Google
      </button>
    );
  }

  const initial = (viewer?.name || viewer?.email || 'U').charAt(0).toUpperCase();

  return (
    <div className="auth-user">
      {viewer?.image ? (
        <img className="user-avatar-img" src={viewer.image} alt="" referrerPolicy="no-referrer" />
      ) : (
        <div className="user-avatar" title={viewer?.name || viewer?.email || 'Signed in'} aria-label="Signed in">
          {initial}
        </div>
      )}
      <button type="button" className="auth-button auth-button--signout" onClick={() => void signOut()}>
        Sign out
      </button>
    </div>
  );
}

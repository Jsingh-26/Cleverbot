import { useAuthActions } from '@convex-dev/auth/react';
import { useConvexAuth, useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';

type Props = {
  onRequestLogin: () => void;
};

export function HeaderAuth({ onRequestLogin }: Props) {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const { signOut } = useAuthActions();
  const viewer = useQuery(api.users.viewer, isAuthenticated ? {} : 'skip');

  if (isLoading) {
    return <div className="header-auth header-auth--loading" aria-hidden="true" />;
  }

  if (!isAuthenticated) {
    return (
      <button type="button" className="header-login-btn" onClick={onRequestLogin}>
        Log in
      </button>
    );
  }

  const email = viewer?.email || viewer?.name || 'account';

  return (
    <div className="header-auth">
      <span className="header-auth-label" title={email}>
        Logged in as {email}
      </span>
      <button type="button" className="header-signout-btn" onClick={() => void signOut()}>
        Sign out
      </button>
    </div>
  );
}

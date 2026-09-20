import { useAuthActions } from '@convex-dev/auth/react';
import { FormEvent, useState } from 'react';

type Mode = 'signIn' | 'signUp';

type Props = {
  onSuccess?: () => void;
};

/** Email/password form used inside the full-screen login overlay. */
export function AuthPanel({ onSuccess }: Props) {
  const { signIn } = useAuthActions();
  const [mode, setMode] = useState<Mode>('signIn');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onPasswordSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setBusy(true);
    const formData = new FormData(event.currentTarget);
    formData.set('flow', mode);
    try {
      await signIn('password', formData);
      onSuccess?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign-in failed. Check email and password.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-panel">
      <form className="auth-form" onSubmit={(e) => void onPasswordSubmit(e)}>
        <label className="auth-field">
          <span className="visually-hidden">Email</span>
          <input
            name="email"
            type="email"
            autoComplete="email"
            placeholder="Email"
            required
            disabled={busy}
          />
        </label>
        <label className="auth-field">
          <span className="visually-hidden">Password</span>
          <input
            name="password"
            type="password"
            autoComplete={mode === 'signUp' ? 'new-password' : 'current-password'}
            placeholder="Password (8+ characters)"
            minLength={8}
            required
            disabled={busy}
          />
        </label>
        <button type="submit" className="auth-button auth-button--signin" disabled={busy}>
          {mode === 'signIn' ? 'Sign in' : 'Create account'}
        </button>
      </form>
      <button
        type="button"
        className="auth-link"
        disabled={busy}
        onClick={() => {
          setError(null);
          setMode(mode === 'signIn' ? 'signUp' : 'signIn');
        }}
      >
        {mode === 'signIn' ? 'Need an account? Sign up' : 'Have an account? Sign in'}
      </button>
      {error && (
        <p className="auth-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

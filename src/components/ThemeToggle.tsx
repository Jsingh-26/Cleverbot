import { useEffect, useRef, useState } from 'react';
import type { ThemePreference } from '../hooks/useTheme';

type Props = {
  preference: ThemePreference;
  resolved: 'light' | 'dark';
  onChange: (theme: ThemePreference) => void;
};

const SunIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
    <circle cx="12" cy="12" r="5" />
    <line x1="12" y1="1" x2="12" y2="3" />
    <line x1="12" y1="21" x2="12" y2="23" />
    <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
    <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
    <line x1="1" y1="12" x2="3" y2="12" />
    <line x1="21" y1="12" x2="23" y2="12" />
    <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
    <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
  </svg>
);

const MoonIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
  </svg>
);

const SystemIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
    <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
  </svg>
);

export function ThemeToggle({ preference, resolved, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('click', onClick);
    return () => document.removeEventListener('click', onClick);
  }, []);

  return (
    <div className="theme-switcher" ref={rootRef}>
      <button
        type="button"
        className="theme-toggle"
        aria-label="Toggle theme menu"
        aria-expanded={open}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
      >
        {resolved === 'dark' ? <MoonIcon /> : <SunIcon />}
      </button>
      <div className={`theme-options${open ? ' show' : ''}`} role="menu" aria-label="Theme options">
        {(
          [
            { id: 'light', label: 'Light', icon: <SunIcon /> },
            { id: 'dark', label: 'Dark', icon: <MoonIcon /> },
            { id: 'system', label: 'System', icon: <SystemIcon /> },
          ] as const
        ).map((opt) => (
          <button
            key={opt.id}
            type="button"
            className={`theme-option${preference === opt.id ? ' active' : ''}`}
            role="menuitem"
            aria-pressed={preference === opt.id}
            onClick={(e) => {
              e.stopPropagation();
              onChange(opt.id);
              setOpen(false);
            }}
          >
            {opt.icon}
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}

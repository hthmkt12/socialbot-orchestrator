import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

/**
 * Global keyboard shortcuts for operator efficiency.
 *
 * Shortcuts (with Alt modifier to avoid conflicts with browser/input):
 *   Alt+N  → /runs (open runs page, where "New Run" button lives)
 *   Alt+D  → /social-dashboard
 *   Alt+R  → /runs
 *   Alt+A  → /approvals
 *   Alt+V  → /devices
 *   Alt+S  → /schedules
 *
 * Shortcuts are suppressed when focus is inside an input, textarea, or
 * contenteditable element.
 */
export function useKeyboardShortcuts() {
  const navigate = useNavigate();

  useEffect(() => {
    function handler(e: KeyboardEvent) {
      /* Skip when typing in form fields */
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if ((e.target as HTMLElement)?.isContentEditable) return;

      if (!e.altKey) return;
      if (e.ctrlKey || e.metaKey || e.shiftKey) return;

      switch (e.key.toLowerCase()) {
        case 'n':
        case 'r':
          e.preventDefault();
          navigate('/runs');
          break;
        case 'd':
          e.preventDefault();
          navigate('/social-dashboard');
          break;
        case 'a':
          e.preventDefault();
          navigate('/approvals');
          break;
        case 'v':
          e.preventDefault();
          navigate('/devices');
          break;
        case 's':
          e.preventDefault();
          navigate('/schedules');
          break;
        default:
          break;
      }
    }

    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [navigate]);
}

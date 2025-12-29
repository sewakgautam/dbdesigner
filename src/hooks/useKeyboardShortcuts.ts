// hooks/useKeyboardShortcuts.ts
import { useEffect } from 'react';

interface KeyboardShortcuts {
  onUndo?: () => void;
  onRedo?: () => void;
  onSave?: () => void;
  onDelete?: () => void;
  onSelectAll?: () => void;
  onCopy?: () => void;
  onPaste?: () => void;
  onZoomIn?: () => void;
  onZoomOut?: () => void;
  onResetZoom?: () => void;
  onNewTable?: () => void;
}

export const useKeyboardShortcuts = (shortcuts: KeyboardShortcuts) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const modifier = isMac ? e.metaKey : e.ctrlKey;

      // Prevent default for our shortcuts
      if (modifier) {
        switch (e.key.toLowerCase()) {
          case 'z':
            e.preventDefault();
            if (e.shiftKey && shortcuts.onRedo) {
              shortcuts.onRedo();
            } else if (shortcuts.onUndo) {
              shortcuts.onUndo();
            }
            break;
          case 'y':
            if (shortcuts.onRedo) {
              e.preventDefault();
              shortcuts.onRedo();
            }
            break;
          case 's':
            if (shortcuts.onSave) {
              e.preventDefault();
              shortcuts.onSave();
            }
            break;
          case 'a':
            if (shortcuts.onSelectAll) {
              e.preventDefault();
              shortcuts.onSelectAll();
            }
            break;
          case 'c':
            if (shortcuts.onCopy) {
              e.preventDefault();
              shortcuts.onCopy();
            }
            break;
          case 'v':
            if (shortcuts.onPaste) {
              e.preventDefault();
              shortcuts.onPaste();
            }
            break;
          case '=':
          case '+':
            if (shortcuts.onZoomIn) {
              e.preventDefault();
              shortcuts.onZoomIn();
            }
            break;
          case '-':
            if (shortcuts.onZoomOut) {
              e.preventDefault();
              shortcuts.onZoomOut();
            }
            break;
          case '0':
            if (shortcuts.onResetZoom) {
              e.preventDefault();
              shortcuts.onResetZoom();
            }
            break;
          case 'n':
            if (shortcuts.onNewTable) {
              e.preventDefault();
              shortcuts.onNewTable();
            }
            break;
        }
      }

      // Non-modifier shortcuts
      if (!modifier && !e.shiftKey && !e.altKey) {
        switch (e.key) {
          case 'Delete':
          case 'Backspace':
            if (shortcuts.onDelete && e.target === document.body) {
              e.preventDefault();
              shortcuts.onDelete();
            }
            break;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [shortcuts]);
};

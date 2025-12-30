// hooks/useHistory.ts
import { useState, useCallback } from 'react';
import { DiagramState } from '@/types/database';

export const useHistory = (initialState: DiagramState) => {
  const [past, setPast] = useState<DiagramState[]>([]);
  const [present, setPresent] = useState<DiagramState>(initialState);
  const [future, setFuture] = useState<DiagramState[]>([]);

  const canUndo = past.length > 0;
  const canRedo = future.length > 0;

  const setState = useCallback((newState: DiagramState) => {
    setPast(prev => [...prev, present]);
    setPresent(newState);
    setFuture([]);
  }, [present]);

  const undo = useCallback(() => {
    if (canUndo) {
      const previous = past[past.length - 1];
      const newPast = past.slice(0, past.length - 1);
      
      setPast(newPast);
      setPresent(previous);
      setFuture([present, ...future]);
    }
  }, [past, present, future, canUndo]);

  const redo = useCallback(() => {
    if (canRedo) {
      const next = future[0];
      const newFuture = future.slice(1);
      
      setPast([...past, present]);
      setPresent(next);
      setFuture(newFuture);
    }
  }, [past, present, future, canRedo]);

  const clearHistory = useCallback(() => {
    setPast([]);
    setFuture([]);
  }, []);

  return {
    state: present,
    setState,
    undo,
    redo,
    canUndo,
    canRedo,
    clearHistory
  };
};

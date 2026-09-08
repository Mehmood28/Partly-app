import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { AppState } from '../types';
import { SessionHistoryItem } from './types';

interface InternalHistoryEntry {
  state: AppState;
  label: string;
  privacySafeLabel?: string;
  timestamp: number;
}

export function useUndoRedo(
  state: AppState,
  setState: React.Dispatch<React.SetStateAction<AppState>>
) {
  const [undoStack, setUndoStack] = useState<InternalHistoryEntry[]>([]);
  const [redoStack, setRedoStack] = useState<InternalHistoryEntry[]>([]);
  const stateRef = useRef(state);

  const [lastBackupTimestamp, setLastBackupTimestamp] = useState<number | null>(() => {
    const saved = localStorage.getItem('last_backup_timestamp');
    return saved ? parseInt(saved, 10) : null;
  });

  const [actionsSinceBackup, setActionsSinceBackup] = useState<number>(() => {
    const saved = localStorage.getItem('actions_since_backup');
    return saved ? parseInt(saved, 10) : 0;
  });

  const lastSavedStateRef = useRef<AppState | null>(null);

  // Keep stateRef up to date with the latest state
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const recordBackup = useCallback(() => {
    const now = Date.now();
    setLastBackupTimestamp(now);
    setActionsSinceBackup(0);
    localStorage.setItem('last_backup_timestamp', now.toString());
    localStorage.setItem('actions_since_backup', '0');
  }, []);

  const incrementBackupActions = useCallback(() => {
    setActionsSinceBackup(prev => {
      const next = prev + 1;
      localStorage.setItem('actions_since_backup', next.toString());
      return next;
    });
  }, []);

  const saveStateToHistory = useCallback((label: string, privacySafeLabel?: string) => {
    if (stateRef.current === lastSavedStateRef.current) {
      return;
    }
    lastSavedStateRef.current = stateRef.current;
    const newEntry: InternalHistoryEntry = {
      state: stateRef.current,
      label: label || 'Action',
      privacySafeLabel,
      timestamp: Date.now(),
    };
    setUndoStack(prev => {
      if (prev.length > 0 && prev[prev.length - 1].state === stateRef.current) {
        return prev;
      }
      return [...prev.slice(-9), newEntry];
    });
    setRedoStack([]);
    incrementBackupActions();
  }, [incrementBackupActions]);

  const undo = useCallback(() => {
    if (undoStack.length === 0) return;
    const lastUndoEntry = undoStack[undoStack.length - 1];
    const redoEntry: InternalHistoryEntry = {
      state: stateRef.current,
      label: lastUndoEntry.label,
      privacySafeLabel: lastUndoEntry.privacySafeLabel,
      timestamp: lastUndoEntry.timestamp,
    };
    setRedoStack(prevRedo => [...prevRedo, redoEntry]);
    setState(lastUndoEntry.state);
    lastSavedStateRef.current = null;
    setUndoStack(prevStack => prevStack.slice(0, prevStack.length - 1));
  }, [undoStack, setState]);

  const redo = useCallback(() => {
    if (redoStack.length === 0) return;
    const lastRedoEntry = redoStack[redoStack.length - 1];
    const undoEntry: InternalHistoryEntry = {
      state: stateRef.current,
      label: lastRedoEntry.label,
      privacySafeLabel: lastRedoEntry.privacySafeLabel,
      timestamp: lastRedoEntry.timestamp,
    };
    setUndoStack(prevUndo => [...prevUndo.slice(-9), undoEntry]);
    setState(lastRedoEntry.state);
    lastSavedStateRef.current = null;
    setRedoStack(prevStack => prevStack.slice(0, prevStack.length - 1));
  }, [redoStack, setState]);

  const undoHistory: SessionHistoryItem[] = useMemo(
    () =>
      [...undoStack].reverse().map(e => ({
        label: e.label,
        privacySafeLabel: e.privacySafeLabel,
        timestamp: e.timestamp,
      })),
    [undoStack]
  );

  const redoHistory: SessionHistoryItem[] = useMemo(
    () =>
      [...redoStack].reverse().map(e => ({
        label: e.label,
        privacySafeLabel: e.privacySafeLabel,
        timestamp: e.timestamp,
      })),
    [redoStack]
  );

  return {
    stateRef,
    undoStack,
    redoStack,
    undoCount: undoStack.length,
    redoCount: redoStack.length,
    undoHistory,
    redoHistory,
    undo,
    redo,
    saveStateToHistory,
    lastBackupTimestamp,
    actionsSinceBackup,
    recordBackup,
  };
}

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { ClassDto } from '@handyin/types';
import { useAuth } from './auth';
import { api } from './api';

const STORAGE_PREFIX = 'handyin_current_class_';

interface CurrentClassContextValue {
  currentClassId: string | null;
  setCurrentClassId: (id: string | null) => void;
  classes: ClassDto[];
  refreshClasses: () => Promise<void>;
}

const CurrentClassContext = createContext<CurrentClassContextValue | null>(null);

export function CurrentClassProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [currentClassId, setCurrentClassIdState] = useState<string | null>(null);
  const [classes, setClasses] = useState<ClassDto[]>([]);

  const refreshClasses = useCallback(async () => {
    if (!user || user.role === 'ADMIN') {
      setClasses([]);
      return;
    }
    try {
      const d = await api.get<{ classes: ClassDto[] }>('/classes');
      setClasses(d.classes);
    } catch {
      setClasses([]);
    }
  }, [user]);

  useEffect(() => {
    if (!user) {
      setCurrentClassIdState(null);
      setClasses([]);
      return;
    }
    const stored = localStorage.getItem(STORAGE_PREFIX + user.id);
    setCurrentClassIdState(stored);
    void refreshClasses();
  }, [user?.id, refreshClasses]);

  const setCurrentClassId = useCallback(
    (id: string | null) => {
      setCurrentClassIdState(id);
      if (!user) return;
      if (id) localStorage.setItem(STORAGE_PREFIX + user.id, id);
      else localStorage.removeItem(STORAGE_PREFIX + user.id);
    },
    [user],
  );

  const value = useMemo(
    () => ({ currentClassId, setCurrentClassId, classes, refreshClasses }),
    [currentClassId, setCurrentClassId, classes, refreshClasses],
  );

  return <CurrentClassContext.Provider value={value}>{children}</CurrentClassContext.Provider>;
}

export function useCurrentClass(): CurrentClassContextValue {
  const ctx = useContext(CurrentClassContext);
  if (!ctx) throw new Error('useCurrentClass 必须在 CurrentClassProvider 内使用');
  return ctx;
}

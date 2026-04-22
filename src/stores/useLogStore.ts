import { create } from "zustand";

export type LogLevel = "info" | "warn" | "error" | "debug";

export type LogEntry = {
  id: number;
  level: LogLevel;
  message: string;
  createdAt: number;
};

type LogStore = {
  logs: LogEntry[];
  pushLog: (level: LogLevel, message: string) => void;
  clearLogs: () => void;
};

export const useLogStore = create<LogStore>((set) => ({
  logs: [],
  pushLog: (level, message) =>
    set((state) => ({
      logs: [
        ...state.logs,
        {
          id: Date.now() + state.logs.length,
          level,
          message,
          createdAt: Date.now(),
        },
      ],
    })),
  clearLogs: () => set({ logs: [] }),
}));

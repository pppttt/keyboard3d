import { useLogStore } from "@stores/useLogStore";

const fmt = (args: unknown[]) =>
  args
    .map((a) =>
      typeof a === "string" ? a : JSON.stringify(a, null, 2)
    )
    .join(" ");

export const logger = {
  info: (...a: unknown[]) =>
    useLogStore.getState().pushLog("info", fmt(a)),
  warn: (...a: unknown[]) =>
    useLogStore.getState().pushLog("warn", fmt(a)),
  error: (...a: unknown[]) =>
    useLogStore.getState().pushLog("error", fmt(a)),
  debug: (...a: unknown[]) =>
    useLogStore.getState().pushLog("debug", fmt(a)),
};

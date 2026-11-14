"use client";

import { useCallback, useEffect, useState } from "react";
import { getDefault, storage } from "@/lib/storage";
import type { StorageName, StorageSchema } from "@/types";

export type StorageStatus = "loading" | "ready";

/**
 * Reads a collection after mount (client only, so no hydration mismatch) and
 * stays in sync with writes from this tab and other tabs. It never writes on
 * its own: defaults live in memory until the user saves something.
 */
export function useStorage<K extends StorageName>(name: K) {
  const [data, setData] = useState<StorageSchema[K]>(() => getDefault(name));
  const [status, setStatus] = useState<StorageStatus>("loading");

  useEffect(() => {
    let active = true;
    const load = () =>
      storage.read(name).then((value) => {
        if (!active) return;
        setData(value);
        setStatus("ready");
      });
    void load();
    const unsubscribe = storage.subscribe(name, load);
    return () => { active = false; unsubscribe(); };
  }, [name]);

  const set = useCallback((value: StorageSchema[K]) => storage.write(name, value), [name]);
  const update = useCallback(
    (fn: (current: StorageSchema[K]) => StorageSchema[K]) => storage.update(name, fn),
    [name],
  );
  const reset = useCallback(() => storage.remove(name), [name]);

  return { data, status, isReady: status === "ready", set, update, reset };
}

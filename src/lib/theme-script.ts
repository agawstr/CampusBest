import { LEGACY_STORAGE_KEYS, STORAGE_KEYS } from "./storage-keys";

/**
 * Runs before first paint (inline in <head>) so the saved theme is applied
 * without a flash and without a hydration mismatch. It reads the new
 * campusbest_ settings and falls back to the legacy campusmate_ ones, because
 * on the very first load after the rename the copy-only migration hasn't run yet
 * (it runs lazily with the first storage read, after React mounts).
 */
export const THEME_INIT_SCRIPT = `(function(){try{var raw=localStorage.getItem(${JSON.stringify(STORAGE_KEYS.settings)});if(raw===null)raw=localStorage.getItem(${JSON.stringify(LEGACY_STORAGE_KEYS.settings)});var s=JSON.parse(raw||'{}');var t=s&&s.theme==='light'?'light':'dark';var a=s&&(s.accent==='ice'||s.accent==='mint'||s.accent==='violet')?s.accent:'silver';var r=document.documentElement;r.setAttribute('data-theme',t);r.setAttribute('data-accent',a);r.classList.toggle('dark',t==='dark');}catch(e){document.documentElement.setAttribute('data-theme','dark');document.documentElement.setAttribute('data-accent','silver');document.documentElement.classList.add('dark');}})();`;

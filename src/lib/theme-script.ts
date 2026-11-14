/**
 * Runs before first paint (inline in <head>) so the saved theme is applied
 * without a flash and without a hydration mismatch. Reads the same key and
 * shape the storage layer uses.
 */
export const THEME_INIT_SCRIPT = `(function(){try{var s=JSON.parse(localStorage.getItem('campusmate_settings')||'{}');var t=s&&s.theme==='light'?'light':'dark';var r=document.documentElement;r.setAttribute('data-theme',t);r.classList.toggle('dark',t==='dark');}catch(e){document.documentElement.setAttribute('data-theme','dark');document.documentElement.classList.add('dark');}})();`;

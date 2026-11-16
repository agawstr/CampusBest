export interface DownloadableFile { filename: string; content: string; mime: string }

/**
 * Starts a browser download of a text file. Throws if the browser can't even start one, so callers can stop
 * instead of assuming a file exists. (A page can't see whether the user later saves or cancels the file.)
 */
export function downloadTextFile(file: DownloadableFile): void {
  if (typeof document === "undefined" || typeof Blob === "undefined" || typeof URL === "undefined" || typeof URL.createObjectURL !== "function") {
    throw new Error("download unavailable");
  }
  const url = URL.createObjectURL(new Blob([file.content], { type: `${file.mime};charset=utf-8` }));
  try {
    const link = document.createElement("a");
    link.href = url;
    link.download = file.filename;
    link.rel = "noopener";
    document.body.appendChild(link);
    try { link.click(); } finally { link.remove(); }
  } catch (e) {
    URL.revokeObjectURL(url);
    throw e;
  }
  // Give the browser time to pick the blob up before releasing it.
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

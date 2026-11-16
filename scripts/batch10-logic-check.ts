// Phase 3 Batch 4 (PWA + optimization). Run from the project root:
//   TZ=Asia/Jakarta npx tsx scripts/batch10-logic-check.ts
// Tests the pure PWA logic, runs public/sw.js inside a Node `vm` sandbox with a fake Cache Storage,
// and checks that nothing in the PWA code can delete user data. It does NOT run a real browser.
export {}; // module, so scripts don't share globals under `tsc`
import * as fs from "node:fs";
import * as path from "node:path";
import * as vm from "node:vm";

const mem = new Map<string, string>();
(globalThis as any).window = {
  localStorage: {
    getItem: (k: string) => (mem.has(k) ? mem.get(k)! : null),
    setItem: (k: string, v: string) => { mem.set(k, String(v)); },
    removeItem: (k: string) => { mem.delete(k); },
    key: (i: number) => [...mem.keys()][i] ?? null,
    get length() { return mem.size; },
  },
  addEventListener: () => {},
};

let pass = 0, fail = 0;
const ok = (name: string, cond: boolean, extra?: unknown) => { if (cond) pass++; else { fail++; console.log("FAIL:", name, extra ?? ""); } };
const eq = (name: string, a: unknown, b: unknown) => ok(name, JSON.stringify(a) === JSON.stringify(b), { got: a, want: b });
const read = (p: string) => fs.readFileSync(path.join(process.cwd(), p), "utf8");
const exists = (p: string) => fs.existsSync(path.join(process.cwd(), p));

// ---------- fake Cache Storage + service worker sandbox ----------
class FakeCache {
  map = new Map<string, Response>();
  key(r: Request | string, ignoreSearch = false) {
    const u = new URL(typeof r === "string" ? r : r.url, "https://app.test");
    return ignoreSearch ? u.origin + u.pathname : u.href;
  }
  async put(r: Request | string, res: Response) { this.map.set(this.key(r), res.clone()); }
  // like the real Cache API, every match returns a fresh, unread copy
  async match(r: Request | string, o?: { ignoreSearch?: boolean }) {
    if (!o?.ignoreSearch) return this.map.get(this.key(r))?.clone();
    const want = this.key(r, true);
    for (const [k, v] of this.map) if (this.key(k, true) === want) return v.clone();
    return undefined;
  }
  async addAll(urls: string[]) {
    for (const u of urls) {
      const res = await (sandbox.fetch as any)(u);
      if (!res.ok) throw new TypeError("addAll failed for " + u);
      this.map.set(this.key(u), res.clone());
    }
  }
  async keys() { return [...this.map.keys()].map((k) => new Request(k)); }
  async delete(r: Request | string) { return this.map.delete(typeof r === "string" ? this.key(r) : this.key(r)); }
}
let stores = new Map<string, FakeCache>();
let online = true;
let failUrls = new Set<string>();
let fetchLog: string[] = [];
const fakeCaches = {
  open: async (n: string) => { if (!stores.has(n)) stores.set(n, new FakeCache()); return stores.get(n)!; },
  keys: async () => [...stores.keys()],
  delete: async (n: string) => stores.delete(n),
  match: async (r: Request | string, o?: { ignoreSearch?: boolean }) => {
    for (const c of stores.values()) { const m = await c.match(r, o); if (m) return m; }
    return undefined;
  },
};
const listeners: Record<string, ((e: any) => void)[]> = {};
let skipWaitingCalls = 0, claimCalls = 0;
const posted: any[] = [];
// a same-origin network response has type "basic"; the SW only caches those
const basic = (r: Response) => Object.defineProperty(r, "type", { value: "basic" });
const fakeFetch = async (r: Request | string) => {
  const url = new URL(typeof r === "string" ? r : r.url, "https://app.test");
  fetchLog.push(url.pathname);
  if (!online || failUrls.has(url.pathname)) throw new TypeError("Failed to fetch");
  return basic(new Response("<html>" + url.pathname + "</html>", { status: 200, headers: { "Content-Type": "text/html" } }));
};
const sandbox: any = {
  self: {
    location: { origin: "https://app.test" },
    addEventListener: (t: string, fn: any) => { (listeners[t] ||= []).push(fn); },
    skipWaiting: () => { skipWaitingCalls++; },
    clients: { claim: async () => { claimCalls++; } },
  },
  caches: fakeCaches, fetch: fakeFetch, Request, Response, URL, Promise, Set, setTimeout, clearTimeout, console,
};
vm.createContext(sandbox);
const swSource = read("public/sw.js");
vm.runInContext(swSource, sandbox);

async function dispatch(type: string, extra: Record<string, unknown> = {}) {
  let waitP: Promise<unknown> = Promise.resolve();
  let responded: Promise<Response> | undefined;
  const ev = { ...extra, waitUntil: (p: Promise<unknown>) => { waitP = p; }, respondWith: (p: Promise<Response> | Response) => { responded = Promise.resolve(p); } };
  for (const fn of listeners[type] ?? []) fn(ev);
  await waitP;
  return responded;
}
const navReq = (p: string) => Object.assign(new Request("https://app.test" + p), { }) as Request;
const mkReq = (p: string, init?: { method?: string; mode?: string; headers?: Record<string, string> }) => {
  const r = new Request("https://app.test" + p, { method: init?.method ?? "GET", headers: init?.headers });
  return new Proxy(r, { get: (t, k) => (k === "mode" ? init?.mode ?? "no-cors" : (t as any)[k] instanceof Function ? (t as any)[k].bind(t) : (t as any)[k]) }) as Request;
};
const text = async (r: Response | undefined) => (r ? r.text() : undefined);

async function main() {
  const pwa = await import("../src/lib/pwa");
  const pkg = JSON.parse(read("package.json"));

  // ---------- versions ----------
  ok("package.json version is 0.12.0, 0.12.1 or 0.12.2", ["0.12.0", "0.12.1", "0.12.2"].includes(pkg.version), pkg.version);
  ok("APP_VERSION matches package.json", pwa.APP_VERSION === pkg.version);
  ok("sw.js VERSION matches package.json", new RegExp(`const VERSION = "${pkg.version}"`).test(swSource));

  // ---------- manifest ----------
  const m = pwa.buildManifest() as any;
  eq("manifest name/short_name", [m.name, m.short_name], ["CampusBest", "CampusBest"]);
  eq("manifest display standalone", m.display, "standalone");
  ok("manifest start_url is an app route", m.start_url === "/dashboard" && read("src/lib/navigation.ts").includes(`href: "${m.start_url}"`));
  ok("manifest scope is /", m.scope === "/");
  ok("theme/background colors are hex", /^#[0-9A-Fa-f]{6}$/.test(m.theme_color) && /^#[0-9A-Fa-f]{6}$/.test(m.background_color));
  ok("manifest theme color matches the dark --background token or layout", read("src/app/layout.tsx").includes("THEME_COLOR") && m.theme_color === "#0B1020");
  const pngSize = (p: string) => { const b = fs.readFileSync(path.join(process.cwd(), p)); return b.slice(0, 8).toString("hex") === "89504e470d0a1a0a" ? [b.readUInt32BE(16), b.readUInt32BE(20)] : null; };
  for (const icon of m.icons) {
    const file = "public" + icon.src;
    const [w, h] = (icon.sizes as string).split("x").map(Number);
    ok(`icon exists ${icon.src}`, exists(file));
    eq(`icon real size ${icon.src}`, pngSize(file), [w, h]);
  }
  ok("has 192 and 512 'any' icons", ["192x192", "512x512"].every((s) => m.icons.some((i: any) => i.sizes === s && i.purpose === "any")));
  ok("has a 512 maskable icon", m.icons.some((i: any) => i.sizes === "512x512" && i.purpose === "maskable"));
  eq("apple-touch-icon is 180x180", pngSize("public/icons/apple-touch-icon.png"), [180, 180]);
  ok("favicon exists", exists("public/icons/favicon-32.png"));
  const navHrefs = read("src/lib/navigation.ts");
  ok("shortcut urls are real routes with icons", m.shortcuts.every((s: any) => navHrefs.includes(`href: "${s.url}"`) && s.icons.length > 0));
  ok("manifest route exists", exists("src/app/manifest.ts") && /buildManifest/.test(read("src/app/manifest.ts")));
  const layout = read("src/app/layout.tsx");
  ok("layout links manifest, apple icon, appleWebApp", layout.includes('"/manifest.webmanifest"') && layout.includes("apple-touch-icon.png") && layout.includes("appleWebApp"));
  ok("layout viewport keeps viewportFit cover + theme color", layout.includes('viewportFit: "cover"') && layout.includes("themeColor: THEME_COLOR"));

  // ---------- registration policy ----------
  ok("registers in production over a secure context", pwa.shouldRegisterServiceWorker({ nodeEnv: "production", hasServiceWorker: true, secure: true }));
  ok("never in development", !pwa.shouldRegisterServiceWorker({ nodeEnv: "development", hasServiceWorker: true, secure: true }));
  ok("not without API support or HTTPS", !pwa.shouldRegisterServiceWorker({ nodeEnv: "production", hasServiceWorker: false, secure: true }) && !pwa.shouldRegisterServiceWorker({ nodeEnv: "production", hasServiceWorker: true, secure: false }));
  const prov = read("src/providers/pwa-provider.tsx");
  ok("provider registers SW_URL with updateViaCache none", /register\(SW_URL/.test(prov) && prov.includes('updateViaCache: "none"'));
  ok("provider does NOT auto-skipWaiting; reload only after user asked", !/skipWaiting/.test(prov) && prov.includes("reloadingRef.current = true") && prov.includes('type: "SKIP_WAITING"'));
  ok("PwaProvider is mounted in AppProviders above pages", /<PwaProvider>[\s\S]*<FocusTimerProvider>/.test(read("src/providers/app-providers.tsx")));

  // ---------- install flow ----------
  const base = { userAgent: "", platform: "", maxTouchPoints: 0, standalone: false, hasPromptEvent: false };
  eq("installed when standalone", pwa.installMode({ ...base, standalone: true }), "installed");
  eq("prompt when beforeinstallprompt captured", pwa.installMode({ ...base, hasPromptEvent: true, userAgent: "Mozilla/5.0 (Linux; Android 14) Chrome/120" }), "prompt");
  eq("iPhone Safari -> ios guide", pwa.installMode({ ...base, userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Safari/605" }), "ios");
  eq("iPadOS posing as Mac -> ios guide", pwa.installMode({ ...base, userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15) Safari", platform: "MacIntel", maxTouchPoints: 5 }), "ios");
  eq("real Mac Safari is not iOS", pwa.isIosDevice({ userAgent: "Mozilla/5.0 (Macintosh)", platform: "MacIntel", maxTouchPoints: 0 }), false);
  eq("Firefox desktop -> manual (no false promise)", pwa.installMode({ ...base, userAgent: "Mozilla/5.0 (X11; Linux) Gecko/20100101 Firefox/120" }), "manual");
  eq("installed beats prompt", pwa.installMode({ ...base, standalone: true, hasPromptEvent: true }), "installed");
  ok("iOS guide has 3 steps; manual hint exists", pwa.IOS_INSTALL_STEPS.length === 3 && pwa.MANUAL_INSTALL_HINT.length > 20);
  ok("offline list has both supported and unsupported entries", pwa.OFFLINE_CAPABILITIES.some((c) => c.offline) && pwa.OFFLINE_CAPABILITIES.some((c) => !c.offline));
  ok("Settings page shows InstallCard; delete-all still present", read("src/app/settings/page.tsx").includes("<InstallCard />") && read("src/app/settings/page.tsx").includes("storage.clearAll()"));

  // ---------- static files ----------
  const offlineHtml = read("public/offline.html");
  ok("offline.html is self-contained and theme aware", !/<link[^>]+href=|<script[^>]+src=/.test(offlineHtml) && offlineHtml.includes("prefers-color-scheme:light"));
  ok("offline.html does not touch storage", !/localStorage|sessionStorage|indexedDB/.test(offlineHtml));
  const cfg = read("next.config.mjs");
  ok("next.config serves sw.js uncached", cfg.includes('source: "/sw.js"') && cfg.includes("no-cache, no-store, must-revalidate") && cfg.includes("Service-Worker-Allowed"));
  ok("no next-pwa / workbox dependency added", !Object.keys({ ...pkg.dependencies, ...pkg.devDependencies }).some((d) => /pwa|workbox|serwist/i.test(d)));
  eq("dependencies unchanged", Object.keys(pkg.dependencies).sort(), ["@radix-ui/react-dialog", "class-variance-authority", "clsx", "framer-motion", "lucide-react", "next", "react", "react-dom", "tailwind-merge"]);
  // every precache entry is a real file in /public (or the manifest route)
  const precache = [...swSource.match(/const PRECACHE_URLS = \[([\s\S]*?)\];/)![1].replace(/OFFLINE_URL/, '"/offline.html"').matchAll(/"([^"]+)"/g)].map((x) => x[1]);
  ok("sw OFFLINE_URL equals lib/pwa OFFLINE_URL", swSource.includes(`const OFFLINE_URL = "${pwa.OFFLINE_URL}"`));
  ok("precache entries exist", precache.every((u) => u === "/manifest.webmanifest" || exists("public" + u)), precache);
  ok("precache includes offline page and icons", precache.includes("/offline.html") && precache.includes("/icons/icon-192.png"));
  const warm = [...swSource.match(/const WARM_PAGES = \[([\s\S]*?)\];/)![1].matchAll(/"([^"]+)"/g)].map((x) => x[1]);
  ok("warm pages are real routes", warm.every((u) => navHrefs.includes(`href: "${u}"`)) && warm.includes("/dashboard"), warm);

  // ---------- service worker behavior (vm sandbox) ----------
  // seed user data to prove the worker lifecycle can't affect it
  mem.set("campusbest_tasks", JSON.stringify([{ id: "t1", title: "Tugas lama", status: "done" }]));
  mem.set("campusmate_subjects", JSON.stringify([{ id: "s1", name: "Kalkulus" }]));
  mem.set("campusbest_settings", JSON.stringify({ theme: "light", schemaVersion: 2 }));
  const before = JSON.stringify([...mem.entries()]);

  stores.set("campusbest-shell-v0.1.0", new FakeCache());
  stores.set("campusbest-shell-v0.10.0", new FakeCache());
  stores.set("some-other-app-cache", new FakeCache());
  (await fakeCaches.open("campusbest-pages")).put("/tasks", new Response("old tasks page"));
  failUrls = new Set(["/tasks"]);
  await dispatch("install");
  ok("install precached the shell", (await fakeCaches.keys()).includes(`campusbest-shell-v${pkg.version}`) && (await stores.get(`campusbest-shell-v${pkg.version}`)!.keys()).length === precache.length);
  ok("install: a failing warm page does not fail install, and keeps the older copy", (await text(await stores.get("campusbest-pages")!.match("/tasks"))) === "old tasks page" && (await stores.get("campusbest-pages")!.match("/dashboard")) !== undefined);
  eq("install did NOT skipWaiting (update waits for the user)", skipWaitingCalls, 0);

  // install must fail (old worker stays) when a required precache file is missing
  const savedStores = stores; stores = new Map(); failUrls = new Set(["/offline.html"]);
  let installFailed = false; try { await dispatch("install"); } catch { installFailed = true; }
  ok("install rejects if the offline page cannot be cached", installFailed);
  stores = savedStores; failUrls = new Set();

  await dispatch("activate");
  const names = await fakeCaches.keys();
  ok("activate removed old campusbest shell versions", !names.includes("campusbest-shell-v0.1.0") && !names.includes("campusbest-shell-v0.10.0"));
  ok("activate kept current shell, pages, and foreign caches", names.includes(`campusbest-shell-v${pkg.version}`) && names.includes("campusbest-pages") && names.includes("some-other-app-cache"));
  eq("activate claims clients", claimCalls, 1);
  await dispatch("message", { data: { type: "SKIP_WAITING" } });
  eq("SKIP_WAITING message triggers skipWaiting", skipWaitingCalls, 1);
  await dispatch("message", { data: { type: "SOMETHING_ELSE" } });
  await dispatch("message", { data: null });
  eq("other/empty messages ignored", skipWaitingCalls, 1);
  await dispatch("message", { data: { type: "GET_VERSION" }, source: { postMessage: (d: unknown) => posted.push(d) } });
  eq("GET_VERSION answers with the version", posted, [{ type: "VERSION", version: pkg.version }]);

  // fetch routing
  const handled = async (req: Request) => (await dispatch("fetch", { request: req })) !== undefined;
  ok("POST not intercepted", !(await handled(mkReq("/tasks", { method: "POST", mode: "navigate" }))));
  ok("cross-origin not intercepted", !(await handled(new Request("https://fonts.example/x.css"))));
  ok("RSC (?_rsc) not intercepted", !(await handled(mkReq("/tasks?_rsc=abc"))));
  ok("RSC header not intercepted", !(await handled(mkReq("/tasks", { headers: { RSC: "1" } }))));
  ok("unknown paths not intercepted", !(await handled(mkReq("/some/random.json"))));

  // navigation: online -> network, caches it
  fetchLog = [];
  const r1 = await dispatch("fetch", { request: mkReq("/visited", { mode: "navigate" }) });
  eq("online navigation served from network", await text(await r1), "<html>/visited</html>");
  ok("visited page stored in pages cache", (await stores.get("campusbest-pages")!.match("/visited")) !== undefined);
  // offline -> cached page; unvisited -> offline.html
  online = false;
  eq("offline: visited page comes from cache", await text(await dispatch("fetch", { request: mkReq("/visited", { mode: "navigate" }) })), "<html>/visited</html>");
  eq("offline: cached page matched with a query string", await text(await dispatch("fetch", { request: mkReq("/visited?tambah=1", { mode: "navigate" }) })), "<html>/visited</html>");
  const unvisited = await text(await dispatch("fetch", { request: mkReq("/statistics", { mode: "navigate" }) }));
  ok("offline: unvisited page -> offline fallback", unvisited === "<html>/offline.html</html>", unvisited);
  online = true;
  // redirects must never be cached or served for navigation
  sandbox.fetch = async () => Object.defineProperty(basic(new Response("r", { status: 200 })), "redirected", { value: true });
  await dispatch("fetch", { request: mkReq("/", { mode: "navigate" }) });
  ok("redirected responses are not cached", (await stores.get("campusbest-pages")!.match("/")) === undefined);
  sandbox.fetch = fakeFetch;
  // error responses are not cached
  sandbox.fetch = async () => basic(new Response("boom", { status: 500 }));
  await dispatch("fetch", { request: mkReq("/broken", { mode: "navigate" }) });
  ok("5xx responses are not cached", (await stores.get("campusbest-pages")!.match("/broken")) === undefined);
  sandbox.fetch = fakeFetch;

  // hashed assets: cache-first, immutable
  fetchLog = [];
  await dispatch("fetch", { request: mkReq("/_next/static/chunks/app-abc123.js") });
  await (await dispatch("fetch", { request: mkReq("/_next/static/chunks/app-abc123.js") }));
  eq("static chunk fetched once, then served from cache", fetchLog.filter((p) => p.includes("app-abc123")).length, 1);
  online = false;
  ok("static chunk available offline", (await text(await dispatch("fetch", { request: mkReq("/_next/static/chunks/app-abc123.js") }))) !== undefined);
  online = true;
  // icons / manifest static
  const ic = await dispatch("fetch", { request: mkReq("/icons/icon-192.png") });
  ok("icons served (cache or network)", (await ic)?.ok === true);

  // cache size bounds
  const pagesCache = await fakeCaches.open("campusbest-pages");
  for (let i = 0; i < 60; i++) await dispatch("fetch", { request: mkReq("/p" + i, { mode: "navigate" }) });
  await new Promise((r) => setTimeout(r, 20));
  ok("pages cache is trimmed to the limit", (await pagesCache.keys()).length <= 40);

  // an "update": new worker version activates and only deletes outdated shells
  stores.set("campusbest-assets", stores.get("campusbest-assets") ?? new FakeCache());
  await dispatch("activate");
  ok("update activation keeps pages and assets caches (so open pages keep their chunks)", (await fakeCaches.keys()).includes("campusbest-pages") && (await fakeCaches.keys()).includes("campusbest-assets"));

  eq("localStorage untouched by the whole worker lifecycle", JSON.stringify([...mem.entries()]), before);


  // ---------- real pasted samples (Classroom link blocks + SIAM with seconds), ids/names anonymized ----------
  const IMP = await import("../src/lib/import/sources");
  const U1 = "https://classroom.google.com/c/AAA/a/BBB/details", U2 = "https://classroom.google.com/c/AAA/a/CCC/details", U3 = "https://classroom.google.com/c/AAA/a/DDD/details";
  const classroomReal = `[assignment](${U1})\n[Susulan UTP - Video Penjelasan Laporan](${U1})\n[Praktikum PAPB - TIF F 2026](${U1})\n[Monday, Nov 9](${U1})\n\n1. [Modul Praktikum 10: Extreme Learning Machine](${U2})\n[Praktikum JST-F 2026](${U2})\n[Turned in](${U2})\n2. [assignment](${U3})\n[Praktikum 89: Backpropagation Part 1 & Part 2](${U3})\n[Praktikum JST-F 2026](${U3})\n[Turned in](${U3})`;
  const cr = IMP.runParser(IMP.getImportSource("google_classroom"), classroomReal, "2026-11-15");
  eq("classroom real: 3 tasks, not one per link line", cr.drafts.length, 3);
  eq("classroom real: titles skip the 'assignment' label", cr.drafts.map((d) => d.title), ["Susulan UTP - Video Penjelasan Laporan", "Modul Praktikum 10: Extreme Learning Machine", "Praktikum 89: Backpropagation Part 1 & Part 2"]);
  eq("classroom real: class line becomes the subject", cr.drafts.map((d) => d.subjectName), ["Praktikum PAPB - TIF F 2026", "Praktikum JST-F 2026", "Praktikum JST-F 2026"]);
  eq("classroom real: 'Turned in' is the status, url kept", [cr.drafts[1].sourceStatus, cr.drafts[2].sourceStatus, cr.drafts[1].url], ["Turned in", "Turned in", U2]);
  eq("classroom real: no stray issues", cr.issues.length, 0);
  const CL = await import("../src/lib/import/classroom");
  eq("date 'Monday, Nov 9' near Nov 15 2026 -> 2026-11-09", CL.readClassroomDate("Monday, Nov 9", "2026-11-15"), { isDate: true, key: "2026-11-09" });
  eq("date: a weekday that does not fit the year is not forced onto it", CL.readClassroomDate("Tuesday, Nov 9", "2026-11-15").key !== "2026-11-09", true);
  eq("date: year rolls over (Mon Jan 4 seen from Dec 2026 = 2027)", CL.readClassroomDate("Monday, Jan 4", "2026-12-28").key, "2027-01-04");
  eq("date: no today -> no invented year", CL.readClassroomDate("Monday, Nov 9").key, "");
  eq("date: Feb 29 only in leap years", [CL.readClassroomDate("Thursday, Feb 29", "2024-03-01").key, CL.readClassroomDate("Wednesday, Feb 29", "2026-03-01").key], ["2024-02-29", ""]);
  eq("date without weekday is not invented", CL.readClassroomDate("Nov 9", "2026-11-15"), { isDate: true, key: "" });
  eq("a normal title is not a date", CL.readClassroomDate("Modul 9 - DataStore Room").isDate, false);
  eq("classroom real: due date line filled the deadline", CL.parseClassroom(classroomReal, "2026-11-15").drafts[0].deadline, "2026-11-09");
  const siamReal = "Hari\tJam\tMata Kuliah\tKelas\tDosen\tRuang\tAction\nSenin\t07:00:00 - 08:40:00\t(CIF65318) Jaringan Saraf Tiruan\tF\tDosen Satu, S.Kom., M.Kom.\tLab Pembelajaran Gedung G - G1.5\t\nRabu\t16:00:00 - 17:40:00\t(CIF60048) Machine Learning Operations (MLOps)\tA\tDosen Dua, S.T.\tGedung F FILKOM - F3.17\t\nJumat\t12:30:00 - 14:10:00\t(CIF65115) Pengembangan Aplikasi Perangkat Bergerak\tF\tDosen Tiga\tLab Pembelajaran Gedung G - G1.2";
  const sr = IMP.runScheduleParser(IMP.SCHEDULE_SOURCES[0], siamReal);
  eq("siam real: 3 rows, no issues, format 1", [sr.drafts.length, sr.issues.length, sr.format], [3, 0, 1]);
  eq("siam real: times drop the seconds", sr.drafts.map((d) => [d.dayOfWeek, d.startTime, d.endTime]), [[1, "07:00", "08:40"], [3, "16:00", "17:40"], [5, "12:30", "14:10"]]);
  eq("siam real: '(CODE) Name' splits code and name; '(MLOps)' stays in the name", sr.drafts.map((d) => [d.subjectCode, d.subjectName]), [["CIF65318", "Jaringan Saraf Tiruan"], ["CIF60048", "Machine Learning Operations (MLOps)"], ["CIF65115", "Pengembangan Aplikasi Perangkat Bergerak"]]);
  eq("siam real: room keeps the full text", sr.drafts[0].room, "Lab Pembelajaran Gedung G - G1.5");

  // ---------- subject chooser in the import previews is a short sheet, not the native full-screen list ----------
  const importUiFiles = ["import-item-card", "import-view", "schedule-import-item-card", "schedule-import-view"].map((n) => read(`src/components/import/${n}.tsx`));
  ok("import previews use SubjectPicker for subjects (no <option> list of subjects left)", importUiFiles.every((t) => !/SubjectOptions/.test(t)) && importUiFiles.filter((t) => /<SubjectPicker/.test(t)).length === 4);
  const picker = read("src/components/ui/option-picker.tsx");
  ok("OptionPicker caps the list height, has search for long lists, keeps disabled/mixed entries", /max-h-\[45dvh\]/.test(picker) && /SEARCH_FROM = 8/.test(picker) && /disabled=\{o\.disabled\}/.test(picker));
  ok("OptionPicker touches no storage", !/localStorage|sessionStorage|indexedDB|storage\./.test(picker));

  // ---------- nothing in the PWA code can delete user data ----------
  const pwaFiles = ["public/sw.js", "src/lib/pwa.ts", "src/providers/pwa-provider.tsx", "src/components/settings/install-card.tsx", "public/offline.html", "src/app/manifest.ts"];
  for (const f of pwaFiles) {
    const s = read(f);
    ok(`${f}: no storage access at all`, !/localStorage|sessionStorage|indexedDB|StorageAdapter|getStorageAdapter|clearAll|removeItem|\.clear\(\)|openDatabase/.test(s.replace(/\/\*[\s\S]*?\*\/|^\s*\/\/.*$/gm, "")));
    ok(`${f}: no Clear-Site-Data / storage manager eviction`, !/Clear-Site-Data|navigator\.storage\.(clear|estimate\(\)\.then\(.*delete)/.test(s));
  }
  ok("sw.js deletes caches only with the campusbest- prefix", /n\.startsWith\(PREFIX\)/.test(swSource) && (swSource.match(/caches\.delete/g) ?? []).length === 1);
  ok("next.config has no Clear-Site-Data header", !/Clear-Site-Data/i.test(cfg));
  const callers = fs.readdirSync(path.join(process.cwd(), "src"), { recursive: true }).map(String).filter((f) => /\.(ts|tsx)$/.test(f)).filter((f) => /clearAll\(/.test(read("src/" + f)));
  eq("storage.clearAll() is only defined in storage.ts and called only from Settings > Hapus data", callers.sort(), ["app/settings/page.tsx", "lib/storage.ts"]);
  const keysSrc = read("src/lib/storage-keys.ts");
  ok("storage keys and adapter untouched", keysSrc.includes('STORAGE_PREFIX = "campusbest_"') && keysSrc.includes('LEGACY_STORAGE_PREFIX = "campusmate_"') && ["subjects", "tasks", "schedules", "events", "notes", "focus_sessions", "settings"].every((k) => keysSrc.includes(`"${k}"`)));

  // ---------- old data still reads (with the real storage layer) ----------
  const { storage } = await import("../src/lib/storage");
  const tasks = await storage.read("tasks");
  eq("existing tasks readable after SW lifecycle", tasks.map((t) => t.title), ["Tugas lama"]);
  const subjects = await storage.read("subjects"); // legacy copy-only migration
  eq("legacy campusmate_ subjects still migrate", subjects.map((s) => s.name), ["Kalkulus"]);
  ok("legacy key still present", mem.has("campusmate_subjects"));
  const settings = await storage.read("settings");
  ok("settings readable (theme light)", (settings as any).theme === "light");

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}
main();

"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { BookOpen, ClipboardCheck, ListChecks, NotebookPen, Search, X } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { useStorage } from "@/hooks/use-storage";
import { isTaskDone } from "@/lib/domain";
import { NAV_ITEMS } from "@/lib/navigation";
import { cn } from "@/lib/utils";

interface SearchHit {
  id: string;
  label: string;
  sub?: string;
  href: string;
  group: "Halaman" | "Tugas" | "Mata kuliah" | "Catatan" | "Ujian & Event";
  done?: boolean;
}

export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const tasks = useStorage("tasks").data;
  const subjects = useStorage("subjects").data;
  const notes = useStorage("notes").data;
  const events = useStorage("events").data;

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    if (open) {
      setQuery("");
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  const results = useMemo<SearchHit[]>(() => {
    const q = query.trim().toLowerCase();
    const hits: SearchHit[] = [];

    for (const item of NAV_ITEMS) {
      if (!q || item.label.toLowerCase().includes(q) || item.description.toLowerCase().includes(q)) {
        hits.push({ id: `nav-${item.key}`, label: item.label, sub: item.description, href: item.href, group: "Halaman" });
      }
    }

    if (q) {
      for (const t of tasks) {
        if (t.title.toLowerCase().includes(q) || (t.description && t.description.toLowerCase().includes(q))) {
          hits.push({ id: `task-${t.id}`, label: t.title, sub: t.deadline ? `Deadline ${t.deadline}` : undefined, href: "/tasks", group: "Tugas", done: isTaskDone(t) });
        }
      }
      for (const s of subjects) {
        if (s.name.toLowerCase().includes(q) || (s.code && s.code.toLowerCase().includes(q)) || (s.lecturer && s.lecturer.toLowerCase().includes(q))) {
          hits.push({ id: `subj-${s.id}`, label: s.name, sub: [s.code, s.lecturer].filter(Boolean).join(" · ") || undefined, href: "/subjects", group: "Mata kuliah" });
        }
      }
      for (const n of notes) {
        if (n.title.toLowerCase().includes(q) || n.content.toLowerCase().includes(q)) {
          hits.push({ id: `note-${n.id}`, label: n.title, sub: n.content.slice(0, 60) || undefined, href: "/notes", group: "Catatan" });
        }
      }
      for (const e of events) {
        if (e.title.toLowerCase().includes(q) || (e.location && e.location.toLowerCase().includes(q))) {
          hits.push({ id: `ev-${e.id}`, label: e.title, sub: [e.date, e.location].filter(Boolean).join(" · ") || undefined, href: "/exams", group: "Ujian & Event" });
        }
      }
    }

    return hits.slice(0, 12);
  }, [query, tasks, subjects, notes, events]);

  function go(href: string) {
    setOpen(false);
    router.push(href);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Cari cepat (Ctrl+K)"
        title="Cari cepat (Ctrl+K)"
        className="glass-item inline-flex h-10 items-center gap-2 rounded-control px-3 text-sm text-muted transition-[color,background-color,transform] duration-fast ease-smooth hover:bg-fg/10 hover:text-fg active:scale-[0.97]"
      >
        <Search className="h-4 w-4 shrink-0" aria-hidden />
        <span className="hidden sm:inline">Cari…</span>
        <kbd className="hidden rounded border border-fg/15 bg-fg/[0.06] px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-muted sm:inline">Ctrl K</kbd>
      </button>

      <Modal open={open} onOpenChange={setOpen} title="Cari cepat" description="Lompat ke halaman atau cari tugas, mata kuliah, catatan, dan event.">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden />
          <input
            ref={inputRef}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && results[0]) {
                e.preventDefault();
                go(results[0].href);
              }
            }}
            placeholder="Ketik judul tugas, MK, catatan, atau halaman…"
            aria-label="Kata kunci pencarian"
            className="h-11 w-full rounded-control border border-fg/15 bg-surface/60 pl-10 pr-10 text-sm text-fg placeholder:text-muted/70 transition-colors duration-fast focus-visible:border-accent/60 [&::-webkit-search-cancel-button]:hidden"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              aria-label="Hapus pencarian"
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-muted hover:text-fg"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        <div className="mt-3 max-h-72 overflow-y-auto pr-0.5">
          {results.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted">Tidak ada hasil untuk &ldquo;{query}&rdquo;.</p>
          ) : (
            <ul className="space-y-1">
              {results.map((hit) => (
                <li key={hit.id}>
                  <button
                    type="button"
                    onClick={() => go(hit.href)}
                    className="flex w-full items-center gap-3 rounded-control px-3 py-2.5 text-left text-sm transition-colors duration-fast hover:bg-fg/[0.08]"
                  >
                    <span className="text-muted" aria-hidden>
                      {hit.group === "Tugas" ? <ListChecks className="h-4 w-4" /> :
                        hit.group === "Mata kuliah" ? <BookOpen className="h-4 w-4" /> :
                          hit.group === "Catatan" ? <NotebookPen className="h-4 w-4" /> :
                            hit.group === "Ujian & Event" ? <ClipboardCheck className="h-4 w-4" /> :
                              <Search className="h-4 w-4" />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className={cn("block truncate font-medium", hit.done && "text-muted line-through")}>{hit.label}</span>
                      {hit.sub && <span className="block truncate text-xs text-muted">{hit.sub}</span>}
                    </span>
                    <span className="shrink-0 rounded-full bg-fg/10 px-2 py-0.5 text-[10px] font-medium text-muted">{hit.group}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Modal>
    </>
  );
}

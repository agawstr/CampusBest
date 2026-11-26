"use client";

import { useId, useMemo, useState } from "react";
import { Check, ChevronDown, Search } from "lucide-react";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { cn } from "@/lib/utils";

export interface PickerOption { value: string; label: string; disabled?: boolean }

interface OptionPickerProps {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  options: readonly PickerOption[];
  /** Shown on the button while `value` matches no option. */
  placeholder?: string;
  /** Sheet heading, e.g. "Pilih mata kuliah". */
  title: string;
  ariaLabel?: string;
  invalid?: boolean;
  className?: string;
}

const SEARCH_FROM = 8;

/**
 * A select that opens a short, scrollable bottom sheet (about half the screen) instead of the native
 * full-screen list. Shows a search box when there are many options.
 */
export function OptionPicker({ id, value, onChange, options, placeholder = "Pilih…", title, ariaLabel, invalid, className }: OptionPickerProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const listId = useId();
  const selected = options.find((o) => o.value === value);
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? options.filter((o) => o.label.toLowerCase().includes(q)) : options;
  }, [options, query]);

  const close = (next: boolean) => { setOpen(next); if (!next) setQuery(""); };

  return (
    <>
      <button
        type="button"
        id={id}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        aria-invalid={invalid || undefined}
        onClick={() => setOpen(true)}
        className={cn(
          "flex h-11 w-full items-center justify-between gap-2 rounded-control border border-fg/15 bg-surface/60 px-3.5 text-left text-sm text-fg transition-colors duration-fast focus-visible:border-accent/60 aria-[invalid=true]:border-danger/70",
          className,
        )}
      >
        <span className={cn("min-w-0 flex-1 truncate", !selected && "text-muted/70")}>{selected ? selected.label : placeholder}</span>
        <ChevronDown className="h-4 w-4 shrink-0 text-muted" aria-hidden />
      </button>

      <BottomSheet open={open} onOpenChange={close} title={title}>
        {options.length > SEARCH_FROM && (
          <div className="relative mb-3">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Cari…"
              aria-label="Cari"
              className="h-11 w-full rounded-control border border-fg/15 bg-surface/60 pl-10 pr-3.5 text-base text-fg placeholder:text-muted/70 focus-visible:border-accent/60 sm:text-sm"
            />
          </div>
        )}
        <ul id={listId} role="listbox" aria-label={title} className="max-h-[45dvh] space-y-1 overflow-y-auto overscroll-contain pr-1">
          {shown.length === 0 && <li className="px-3 py-3 text-sm text-muted">Tidak ada yang cocok.</li>}
          {shown.map((o) => {
            const active = o.value === value;
            return (
              <li key={o.value} role="presentation">
                <button
                  type="button"
                  role="option"
                  aria-selected={active}
                  disabled={o.disabled}
                  onClick={() => { onChange(o.value); close(false); }}
                  className={cn(
                    "flex min-h-11 w-full items-center justify-between gap-3 rounded-control px-3 py-2 text-left text-sm transition-colors duration-fast disabled:opacity-50",
                    active ? "bg-accent/15 font-semibold text-accent" : "hover:bg-fg/5",
                  )}
                >
                  <span className="min-w-0 break-words">{o.label}</span>
                  {active && <Check className="h-4 w-4 shrink-0" aria-hidden />}
                </button>
              </li>
            );
          })}
        </ul>
      </BottomSheet>
    </>
  );
}

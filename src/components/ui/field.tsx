"use client";

import { forwardRef, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

const controlClass =
  "w-full rounded-control border border-fg/15 bg-surface/60 px-3.5 text-sm text-fg placeholder:text-muted/70 transition-colors duration-fast focus-visible:border-accent/60 disabled:cursor-not-allowed disabled:opacity-50 aria-[invalid=true]:border-danger/70";

interface FieldProps {
  label: string;
  htmlFor?: string;
  error?: string;
  hint?: ReactNode;
  className?: string;
  children: ReactNode;
}

/** Label + control + error/hint. Pass the same id to the control and to `htmlFor`. */
export function Field({ label, htmlFor, error, hint, className, children }: FieldProps) {
  return (
    <div className={className}>
      <label htmlFor={htmlFor} className="mb-1.5 block text-sm font-medium">{label}</label>
      {children}
      {error ? (
        <p role="alert" className="mt-1.5 text-xs text-danger">{error}</p>
      ) : hint ? (
        <p className="mt-1.5 text-xs text-muted">{hint}</p>
      ) : null}
    </div>
  );
}

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => <input ref={ref} className={cn(controlClass, "h-11", className)} {...props} />,
);
Input.displayName = "Input";

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => <textarea ref={ref} className={cn(controlClass, "min-h-24 resize-y py-2.5", className)} {...props} />,
);
Textarea.displayName = "Textarea";

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className, ...props }, ref) => <select ref={ref} className={cn(controlClass, "h-11", className)} {...props} />,
);
Select.displayName = "Select";

interface Option<T extends string> { value: T; label: string }

/** Pick-one buttons for short fixed lists (priority, status) inside forms. */
export function SegmentedControl<T extends string>({
  label, value, onChange, options,
}: { label: string; value: T; onChange: (value: T) => void; options: readonly Option<T>[] }) {
  return (
    <div role="radiogroup" aria-label={label} className="grid grid-flow-col auto-cols-fr gap-1 rounded-control border border-fg/10 bg-surface/60 p-1">
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(option.value)}
            className={cn(
              "h-9 rounded-[10px] px-2 text-sm font-medium transition-colors duration-fast",
              active ? "btn-metal text-accent-fg shadow-soft" : "text-muted hover:text-fg",
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

/** Filter pills. Scrolls sideways on narrow screens instead of wrapping. */
export function ChipGroup<T extends string>({
  label, value, onChange, options,
}: { label: string; value: T; onChange: (value: T) => void; options: readonly Option<T>[] }) {
  return (
    <div role="group" aria-label={label} className="-mx-1 flex gap-2 overflow-x-auto px-1 py-1">
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(option.value)}
            className={cn(
              "h-9 shrink-0 rounded-full border px-3.5 text-sm font-medium transition-colors duration-fast",
              active ? "border-accent/40 bg-accent/15 text-accent" : "border-fg/10 text-muted hover:bg-fg/[0.06] hover:text-fg",
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

"use client";

import { useId, useMemo, useState, type FormEvent } from "react";
import { Calculator, GraduationCap, Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Field, Input, SegmentedControl } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { useStorage } from "@/hooks/use-storage";
import {
  calculateGpa, projectGpa, QUICK_TERM_PRESETS, validateGpaTerm,
  type GpaTermFormErrors, type GpaTermFormValues,
} from "@/lib/gpa";
import { generateId } from "@/lib/id";
import { cn } from "@/lib/utils";
import { useToast } from "@/providers/toast-provider";
import type { GpaTerm, GpaTermKind } from "@/types";

const KIND_OPTIONS: readonly { value: GpaTermKind; label: string }[] = [
  { value: "regular", label: "Semester Reguler" },
  { value: "short", label: "Semester Pendek" },
];

const EMPTY_FORM: GpaTermFormValues = { label: "", kind: "regular", ips: "", sks: "" };

export function GpaPanel() {
  const settingsStore = useStorage("settings");
  const { toast } = useToast();
  const uid = useId();

  const terms = settingsStore.data.gpaTerms ?? [];
  const summary = useMemo(() => calculateGpa(terms), [terms]);

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<GpaTerm | null>(null);
  const [values, setValues] = useState<GpaTermFormValues>(EMPTY_FORM);
  const [errors, setErrors] = useState<GpaTermFormErrors>({});

  // Target IPK simulator
  const [simSks, setSimSks] = useState("20");
  const [simIps, setSimIps] = useState("3.75");
  const projected = useMemo(
    () => projectGpa(summary, Number(simIps.replace(",", ".")), Number(simSks)),
    [summary, simIps, simSks],
  );

  function openCreate(preset?: { label: string; kind: GpaTermKind }) {
    setEditing(null);
    setValues(preset ? { label: preset.label, kind: preset.kind, ips: "", sks: preset.kind === "short" ? "6" : "20" } : EMPTY_FORM);
    setErrors({});
    setOpen(true);
  }

  function openEdit(term: GpaTerm) {
    setEditing(term);
    setValues({ label: term.label, kind: term.kind, ips: term.ips.toFixed(2), sks: String(term.sks) });
    setErrors({});
    setOpen(true);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const res = validateGpaTerm(values);
    if (!res.ok) { setErrors(res.errors); return; }
    try {
      await settingsStore.update((s) => {
        const list = s.gpaTerms ?? [];
        if (editing) {
          return {
            ...s,
            gpaTerms: list.map((t) => (t.id === editing.id ? { ...t, label: res.label, kind: values.kind, ips: res.ips, sks: res.sks } : t)),
          };
        }
        return {
          ...s,
          gpaTerms: [...list, { id: generateId(), label: res.label, kind: values.kind, ips: res.ips, sks: res.sks }],
        };
      });
      toast({ title: editing ? "IPS diperbarui" : "Semester ditambahkan", variant: "success" });
      setOpen(false);
    } catch {
      toast({ title: "Gagal menyimpan", description: "Penyimpanan browser tidak bisa diakses.", variant: "error" });
    }
  }

  async function handleDelete(term: GpaTerm) {
    try {
      await settingsStore.update((s) => ({ ...s, gpaTerms: (s.gpaTerms ?? []).filter((t) => t.id !== term.id) }));
      toast({ title: `${term.label} dihapus` });
    } catch {
      toast({ title: "Gagal menghapus", variant: "error" });
    }
  }

  const existingLabels = new Set(terms.map((t) => t.label.toLowerCase()));
  const nextPresets = QUICK_TERM_PRESETS.filter((p) => !existingLabels.has(p.label.toLowerCase())).slice(0, 4);

  return (
    <div className="space-y-4">
      {/* Hero IPK */}
      <Card raised className="glass-hero !shadow-hero p-5 md:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="eyebrow text-accent">IPK Kumulatif</p>
            <p className="text-silver mt-2 text-5xl font-bold tabular-nums leading-none tracking-tight sm:text-6xl">
              {summary.totalSks > 0 ? summary.ipk.toFixed(2) : "0.00"}
            </p>
            <p className="mt-2 text-xs text-muted">
              Dihitung berbobot SKS: Σ(IPS × SKS) ÷ Total SKS
            </p>
          </div>
          <Button onClick={() => openCreate()}>
            <Plus className="h-4 w-4" aria-hidden />
            Catat semester
          </Button>
        </div>

        <dl className="mt-5 grid grid-cols-3 gap-3 border-t border-fg/10 pt-4 text-sm">
          <div>
            <dt className="eyebrow">Total SKS</dt>
            <dd className="mt-0.5 text-xl font-semibold tabular-nums">{summary.totalSks}</dd>
          </div>
          <div>
            <dt className="eyebrow">Reguler</dt>
            <dd className="mt-0.5 text-xl font-semibold tabular-nums">{summary.regularCount}</dd>
          </div>
          <div>
            <dt className="eyebrow">Sem. Pendek</dt>
            <dd className="mt-0.5 text-xl font-semibold tabular-nums">{summary.shortCount}</dd>
          </div>
        </dl>
      </Card>

      {/* Quick presets */}
      {nextPresets.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted">Tambah cepat:</span>
          {nextPresets.map((p) => (
            <button
              key={p.label}
              type="button"
              onClick={() => openCreate(p)}
              className="glass-item inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-xs font-medium text-fg/90 transition-colors duration-fast hover:bg-fg/10"
            >
              <Plus className="h-3 w-3 text-muted" aria-hidden />
              {p.label}
            </button>
          ))}
        </div>
      )}

      {/* List of recorded terms */}
      {terms.length === 0 ? (
        <Card>
          <EmptyState
            icon={GraduationCap}
            title="Belum ada catatan IPS"
            description="Catat IPS dan SKS dari Semester 1 sampai sekarang (termasuk Semester Pendek / Antara) untuk melihat IPK kumulatifmu."
            action={<Button onClick={() => openCreate({ label: "Semester 1", kind: "regular" })}><Plus className="h-4 w-4" aria-hidden />Catat Semester 1</Button>}
          />
        </Card>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {terms.map((term) => (
            <li key={term.id}>
              <Card surface="item" className="flex h-full flex-col p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <span
                      className={cn(
                        "inline-block rounded-full px-2 py-0.5 text-[11px] font-medium",
                        term.kind === "short" ? "bg-activity/15 text-activity" : "bg-accent/15 text-accent",
                      )}
                    >
                      {term.kind === "short" ? "Semester Pendek" : "Reguler"}
                    </span>
                    <h3 className="mt-1.5 truncate font-semibold">{term.label}</h3>
                  </div>
                  <div className="flex shrink-0 gap-0.5">
                    <Button variant="ghost" size="icon" className="h-8 w-8" aria-label={`Edit ${term.label}`} onClick={() => openEdit(term)}>
                      <Pencil className="h-3.5 w-3.5" aria-hidden />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 hover:text-danger" aria-label={`Hapus ${term.label}`} onClick={() => void handleDelete(term)}>
                      <Trash2 className="h-3.5 w-3.5" aria-hidden />
                    </Button>
                  </div>
                </div>
                <div className="mt-auto flex items-baseline justify-between pt-4">
                  <p className="text-silver text-3xl font-bold tabular-nums leading-none">{term.ips.toFixed(2)}</p>
                  <p className="text-xs font-medium text-muted tabular-nums">{term.sks} SKS</p>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}

      {/* Target Simulator */}
      {summary.totalSks > 0 && (
        <Card>
          <div className="flex items-center gap-2">
            <Calculator className="h-4 w-4 text-accent" aria-hidden />
            <h3 className="text-[0.95rem] font-semibold tracking-tight">Simulasi target semester berikutnya</h3>
          </div>
          <p className="mt-1 text-xs text-muted">Coba lihat proyeksi IPK kalau semester ini kamu dapat IPS tertentu.</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <Field label="Target IPS" htmlFor={`${uid}-sim-ips`}>
              <Input id={`${uid}-sim-ips`} inputMode="decimal" value={simIps} onChange={(e) => setSimIps(e.target.value)} placeholder="3.75" />
            </Field>
            <Field label="SKS semester ini" htmlFor={`${uid}-sim-sks`}>
              <Input id={`${uid}-sim-sks`} inputMode="numeric" value={simSks} onChange={(e) => setSimSks(e.target.value)} placeholder="20" />
            </Field>
            <div className="glass-item flex flex-col justify-center rounded-control px-4 py-2.5">
              <span className="eyebrow">Proyeksi IPK</span>
              <span className="text-silver mt-1 text-2xl font-bold tabular-nums leading-none">
                {projected !== null ? projected.toFixed(2) : "—"}
              </span>
            </div>
          </div>
        </Card>
      )}

      <Modal
        open={open}
        onOpenChange={setOpen}
        title={editing ? "Edit catatan semester" : "Catat IPS semester"}
        description="Masukkan nama semester (mis. Semester 1 atau Semester Pendek 2–3), IPS, dan jumlah SKS."
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>Batal</Button>
            <Button type="submit" form={`${uid}-gpa-form`}>{editing ? "Simpan" : "Tambah"}</Button>
          </>
        }
      >
        <form id={`${uid}-gpa-form`} onSubmit={handleSubmit} noValidate className="space-y-4">
          <div>
            <p className="mb-1.5 text-sm font-medium">Jenis semester</p>
            <SegmentedControl<GpaTermKind>
              label="Jenis semester"
              value={values.kind}
              onChange={(kind) => setValues((v) => ({ ...v, kind }))}
              options={KIND_OPTIONS}
            />
          </div>
          <Field label="Nama semester" htmlFor={`${uid}-label`} error={errors.label}>
            <Input
              id={`${uid}-label`}
              value={values.label}
              onChange={(e) => setValues((v) => ({ ...v, label: e.target.value }))}
              placeholder={values.kind === "short" ? "Contoh: Semester Pendek 4–5" : "Contoh: Semester 5"}
              aria-invalid={Boolean(errors.label)}
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="IPS (0.00 – 4.00)" htmlFor={`${uid}-ips`} error={errors.ips}>
              <Input
                id={`${uid}-ips`}
                inputMode="decimal"
                value={values.ips}
                onChange={(e) => setValues((v) => ({ ...v, ips: e.target.value }))}
                placeholder="3.82"
                aria-invalid={Boolean(errors.ips)}
              />
            </Field>
            <Field label="Jumlah SKS" htmlFor={`${uid}-sks`} error={errors.sks}>
              <Input
                id={`${uid}-sks`}
                inputMode="numeric"
                value={values.sks}
                onChange={(e) => setValues((v) => ({ ...v, sks: e.target.value }))}
                placeholder={values.kind === "short" ? "6" : "20"}
                aria-invalid={Boolean(errors.sks)}
              />
            </Field>
          </div>
        </form>
      </Modal>
    </div>
  );
}

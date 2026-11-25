import type { GpaTerm, GpaTermKind } from "@/types";

export interface GpaSummary {
  ipk: number;
  totalSks: number;
  weightedPoints: number;
  regularCount: number;
  shortCount: number;
}

export function calculateGpa(terms: readonly GpaTerm[]): GpaSummary {
  let totalSks = 0;
  let weightedPoints = 0;
  let regularCount = 0;
  let shortCount = 0;

  for (const t of terms) {
    if (!Number.isFinite(t.ips) || !Number.isFinite(t.sks) || t.sks <= 0) continue;
    totalSks += t.sks;
    weightedPoints += t.ips * t.sks;
    if (t.kind === "short") shortCount++;
    else regularCount++;
  }

  return {
    ipk: totalSks > 0 ? weightedPoints / totalSks : 0,
    totalSks,
    weightedPoints,
    regularCount,
    shortCount,
  };
}

export function projectGpa(current: GpaSummary, nextIps: number, nextSks: number): number | null {
  if (!Number.isFinite(nextIps) || !Number.isFinite(nextSks) || nextSks <= 0 || nextIps < 0 || nextIps > 4) {
    return null;
  }
  const totalSks = current.totalSks + nextSks;
  if (totalSks <= 0) return null;
  return (current.weightedPoints + nextIps * nextSks) / totalSks;
}

export interface GpaTermFormValues {
  label: string;
  kind: GpaTermKind;
  ips: string;
  sks: string;
}

export interface GpaTermFormErrors {
  label?: string;
  ips?: string;
  sks?: string;
}

export function validateGpaTerm(values: GpaTermFormValues): { ok: true; ips: number; sks: number; label: string } | { ok: false; errors: GpaTermFormErrors } {
  const errors: GpaTermFormErrors = {};
  const label = values.label.trim();
  const ips = Number(values.ips.replace(",", "."));
  const sks = Number(values.sks);

  if (!label) errors.label = "Nama semester wajib diisi.";
  if (!values.ips.trim() || !Number.isFinite(ips) || ips < 0 || ips > 4) {
    errors.ips = "IPS harus angka antara 0,00 sampai 4,00.";
  }
  if (!values.sks.trim() || !Number.isInteger(sks) || sks < 1 || sks > 40) {
    errors.sks = "SKS harus bilangan bulat 1–40.";
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return { ok: true, label, ips: Math.round(ips * 100) / 100, sks };
}

export const QUICK_TERM_PRESETS: readonly { label: string; kind: GpaTermKind }[] = [
  { label: "Semester 1", kind: "regular" },
  { label: "Semester 2", kind: "regular" },
  { label: "Semester Pendek 2–3", kind: "short" },
  { label: "Semester 3", kind: "regular" },
  { label: "Semester 4", kind: "regular" },
  { label: "Semester Pendek 4–5", kind: "short" },
  { label: "Semester 5", kind: "regular" },
  { label: "Semester 6", kind: "regular" },
];

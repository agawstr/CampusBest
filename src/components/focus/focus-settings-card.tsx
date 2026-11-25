"use client";

import { useEffect, useState, type ChangeEvent } from "react";
import { Volume2, VolumeX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Input, SegmentedControl } from "@/components/ui/field";
import { useStorage } from "@/hooks/use-storage";
import {
  FOCUS_LIMITS, FOCUS_PRESETS, LONG_BREAK_EVERY, presetOf, validateFocusSettings,
  type FocusPresetKey, type FocusSettingsErrors, type FocusSettingsInput,
} from "@/lib/focus";
import { playFocusChime } from "@/lib/sound";
import type { FocusSettings } from "@/types";

const OPTIONS: readonly { value: FocusPresetKey; label: string }[] = [
  ...FOCUS_PRESETS.map((p) => ({ value: p.key as FocusPresetKey, label: p.label })),
  { value: "custom", label: "Kustom" },
];

const toInput = (s: FocusSettings): FocusSettingsInput => ({
  focusMinutes: String(s.focusMinutes),
  shortBreakMinutes: String(s.shortBreakMinutes),
  longBreakMinutes: String(s.longBreakMinutes),
});

interface Props {
  settings: FocusSettings;
  /** Resolves true when saved. */
  onSave: (next: FocusSettings) => Promise<boolean>;
  /** Heading of the card. Default "Durasi" (Focus page); Settings passes "Timer fokus". */
  title?: string;
}

export function FocusSettingsCard({ settings, onSave, title = "Durasi" }: Props) {
  const settingsStore = useStorage("settings");
  const soundEnabled = settingsStore.data.focusSound !== false;
  const [customOpen, setCustomOpen] = useState(false);
  const [values, setValues] = useState<FocusSettingsInput>(() => toInput(settings));
  const [errors, setErrors] = useState<FocusSettingsErrors>({});
  const [saving, setSaving] = useState(false);

  // Follow what is saved (another tab, or a preset just picked).
  useEffect(() => { setValues(toInput(settings)); setErrors({}); }, [settings.focusMinutes, settings.shortBreakMinutes, settings.longBreakMinutes]); // eslint-disable-line react-hooks/exhaustive-deps

  const preset = presetOf(settings);
  const selected: FocusPresetKey = customOpen || preset === "custom" ? "custom" : preset;

  async function choose(next: FocusPresetKey) {
    if (next === "custom") { setCustomOpen(true); return; }
    const hit = FOCUS_PRESETS.find((p) => p.key === next);
    if (!hit) return;
    setCustomOpen(false);
    await onSave(hit.settings);
  }

  async function submit() {
    const result = validateFocusSettings(values);
    if (!result.ok) { setErrors(result.errors); return; }
    setErrors({});
    setSaving(true);
    const saved = await onSave(result.settings);
    setSaving(false);
    if (saved && presetOf(result.settings) !== "custom") setCustomOpen(false);
  }

  const set = (key: keyof FocusSettingsInput) => (e: ChangeEvent<HTMLInputElement>) =>
    setValues((v) => ({ ...v, [key]: e.target.value }));

  return (
    <Card animate={false}>
      <h2 className="font-semibold tracking-tight">{title}</h2>
      <p className="mt-0.5 text-xs text-muted">
        Tersimpan di perangkat ini. Sesi yang sedang berjalan tidak berubah; durasi baru dipakai mulai sesi berikutnya.
      </p>
      <div className="mt-4">
        <SegmentedControl label="Pilih preset durasi" value={selected} onChange={(v) => void choose(v)} options={OPTIONS} />
      </div>

      {selected === "custom" ? (
        <div className="mt-4 space-y-3">
          <div className="grid grid-cols-3 gap-3">
            <Field label="Fokus" htmlFor="focus-minutes" error={errors.focusMinutes}>
              <Input id="focus-minutes" inputMode="numeric" value={values.focusMinutes} onChange={set("focusMinutes")} aria-invalid={!!errors.focusMinutes} />
            </Field>
            <Field label="Istirahat" htmlFor="short-break-minutes" error={errors.shortBreakMinutes}>
              <Input id="short-break-minutes" inputMode="numeric" value={values.shortBreakMinutes} onChange={set("shortBreakMinutes")} aria-invalid={!!errors.shortBreakMinutes} />
            </Field>
            <Field label="Panjang" htmlFor="long-break-minutes" error={errors.longBreakMinutes}>
              <Input id="long-break-minutes" inputMode="numeric" value={values.longBreakMinutes} onChange={set("longBreakMinutes")} aria-invalid={!!errors.longBreakMinutes} />
            </Field>
          </div>
          <p className="text-xs text-muted">
            Dalam menit: fokus {FOCUS_LIMITS.focusMinutes.min}–{FOCUS_LIMITS.focusMinutes.max}, istirahat {FOCUS_LIMITS.shortBreakMinutes.min}–{FOCUS_LIMITS.shortBreakMinutes.max}, istirahat panjang {FOCUS_LIMITS.longBreakMinutes.min}–{FOCUS_LIMITS.longBreakMinutes.max}.
          </p>
          <Button size="sm" onClick={() => void submit()} disabled={saving}>Simpan durasi</Button>
        </div>
      ) : null}

      <p className="mt-4 text-sm text-muted">
        Sekarang: fokus {settings.focusMinutes} mnt, istirahat {settings.shortBreakMinutes} mnt, istirahat panjang {settings.longBreakMinutes} mnt setiap {LONG_BREAK_EVERY} sesi fokus selesai.
      </p>

      <div className="mt-4 flex items-center justify-between gap-3 border-t border-fg/10 pt-4">
        <div>
          <p className="text-sm font-medium">Suara notifikasi</p>
          <p className="text-xs text-muted">Bunyi lonceng lembut saat sesi selesai.</p>
        </div>
        <Button
          variant={soundEnabled ? "secondary" : "ghost"}
          size="sm"
          aria-pressed={soundEnabled}
          onClick={() => {
            const next = !soundEnabled;
            void settingsStore.update((s) => ({ ...s, focusSound: next }));
            if (next) playFocusChime("focus");
          }}
        >
          {soundEnabled ? <Volume2 className="h-4 w-4" aria-hidden /> : <VolumeX className="h-4 w-4" aria-hidden />}
          {soundEnabled ? "Aktif" : "Mati"}
        </Button>
      </div>
    </Card>
  );
}

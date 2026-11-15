"use client";

import { useState } from "react";
import { Check, Moon, Sun, X } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import { Modal } from "@/components/ui/modal";
import { runStorageSelfTest, storage, type SelfTestResult } from "@/lib/storage";
import { cn } from "@/lib/utils";
import { useTheme } from "@/providers/theme-provider";
import { useToast } from "@/providers/toast-provider";

export default function SettingsPage() {
  const { theme, setTheme } = useTheme();
  const { toast } = useToast();
  const [results, setResults] = useState<SelfTestResult[] | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const themes = [
    { value: "dark", label: "Gelap", icon: Moon },
    { value: "light", label: "Terang", icon: Sun },
  ] as const;

  return (
    <>
      <PageHeader title="Settings" description="Tema, tampilan, dan data aplikasi." />
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <h2 className="text-base font-semibold">Tema</h2>
          <p className="mt-1 text-sm text-muted">Pilihanmu tersimpan dan dipakai lagi saat halaman dibuka ulang.</p>
          <div className="mt-4 grid grid-cols-2 gap-2" role="radiogroup" aria-label="Tema">
            {themes.map(({ value, label, icon: Icon }) => (
              <button
                key={value}
                role="radio"
                aria-checked={theme === value}
                onClick={() => setTheme(value)}
                className={cn(
                  "flex h-12 items-center justify-center gap-2 rounded-control border text-sm font-semibold transition-colors duration-fast",
                  theme === value ? "border-accent/50 bg-accent/15 text-accent" : "border-fg/10 text-muted hover:text-fg",
                )}
              >
                <Icon className="h-4 w-4" aria-hidden /> {label}
              </button>
            ))}
          </div>
        </Card>

        <Card delay={0.05}>
          <h2 className="text-base font-semibold">Penyimpanan lokal</h2>
          <p className="mt-1 text-sm text-muted">Uji dasar membaca dan menulis. Data kuliahmu tidak disentuh.</p>
          <Button className="mt-4" variant="secondary" onClick={async () => setResults(await runStorageSelfTest())}>
            Jalankan uji penyimpanan
          </Button>
          {results && (
            <ul className="mt-4 space-y-2 text-sm">
              {results.map((r) => (
                <li key={r.name} className="flex items-center gap-2">
                  {r.passed ? <Check className="h-4 w-4 text-success" aria-hidden /> : <X className="h-4 w-4 text-danger" aria-hidden />}
                  <span>{r.name}</span>
                  <span className="sr-only">{r.passed ? "lulus" : "gagal"}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card delay={0.1}>
          <h2 className="text-base font-semibold">Pratinjau komponen</h2>
          <p className="mt-1 text-sm text-muted">Coba komponen dasar yang dipakai di seluruh aplikasi.</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button size="sm" onClick={() => setModalOpen(true)}>Buka modal</Button>
            <Button size="sm" variant="secondary" onClick={() => setSheetOpen(true)}>Buka bottom sheet</Button>
            <Button size="sm" variant="ghost" onClick={() => toast({ title: "Tersimpan", description: "Pengaturan diperbarui.", variant: "success" })}>
              Tampilkan toast
            </Button>
          </div>
        </Card>

        <Card delay={0.15}>
          <h2 className="text-base font-semibold">Hapus semua data</h2>
          <p className="mt-1 text-sm text-muted">Menghapus mata kuliah, tugas, jadwal, event, catatan, sesi fokus, dan pengaturan dari perangkat ini, termasuk data lama dari versi CampusMate.</p>
          <Button className="mt-4" variant="danger" onClick={() => setConfirmOpen(true)}>Hapus data</Button>
        </Card>
      </div>

      <Modal open={modalOpen} onOpenChange={setModalOpen} title="Contoh modal" description="Modal dipakai untuk form dan konfirmasi singkat."
        footer={<Button onClick={() => setModalOpen(false)}>Selesai</Button>} />
      <BottomSheet open={sheetOpen} onOpenChange={setSheetOpen} title="Contoh bottom sheet" description="Geser ke bawah untuk menutup.">
        <Button className="w-full" onClick={() => setSheetOpen(false)}>Tutup</Button>
      </BottomSheet>
      <ConfirmationDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        destructive
        title="Hapus semua data?"
        description="Tindakan ini tidak bisa dibatalkan. Tema akan kembali ke mode gelap."
        confirmLabel="Hapus data"
        onConfirm={async () => {
          await storage.clearAll();
          document.documentElement.setAttribute("data-theme", "dark");
          document.documentElement.classList.add("dark");
          toast({ title: "Data dihapus", variant: "success" });
        }}
      />
    </>
  );
}

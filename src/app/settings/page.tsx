"use client";

import { useState } from "react";
import { AboutCard } from "@/components/settings/about-card";
import { AppearanceCard } from "@/components/settings/appearance-card";
import { BackupCard } from "@/components/settings/backup-card";
import { InstallCard } from "@/components/settings/install-card";
import { StorageCard } from "@/components/settings/storage-card";
import { FocusSettingsCard } from "@/components/focus/focus-settings-card";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import { useStorage } from "@/hooks/use-storage";
import { countData, describeCounts } from "@/lib/settings";
import { storage } from "@/lib/storage";
import { useFocusTimer } from "@/providers/focus-timer-provider";
import { useToast } from "@/providers/toast-provider";

export default function SettingsPage() {
  const { toast } = useToast();
  const { settings: focusSettings, saveSettings } = useFocusTimer();
  const [confirmOpen, setConfirmOpen] = useState(false);

  const subjects = useStorage("subjects");
  const tasks = useStorage("tasks");
  const schedules = useStorage("schedules");
  const events = useStorage("events");
  const notes = useStorage("notes");
  const focusSessions = useStorage("focusSessions");
  const summary = describeCounts(countData({
    subjects: subjects.data, tasks: tasks.data, schedules: schedules.data,
    events: events.data, notes: notes.data, focusSessions: focusSessions.data,
  }));

  return (
    <>
      <PageHeader title="Settings" description="Tampilan, timer fokus, dan data aplikasi." />
      <div className="grid items-start gap-4 lg:grid-cols-2">
        <div className="space-y-4">
          <AppearanceCard />
          <FocusSettingsCard title="Timer fokus" settings={focusSettings} onSave={saveSettings} />
          <StorageCard />
        </div>

        <div className="space-y-4">
          <InstallCard />
          <AboutCard />
          <BackupCard />
          <Card delay={0.15}>
            <h2 className="text-base font-semibold">Hapus semua data</h2>
            <p className="mt-1 text-sm text-muted">Menghapus mata kuliah, tugas, jadwal, event, catatan, sesi fokus, dan pengaturan dari perangkat ini, termasuk data lama dari versi CampusMate. Tidak bisa dibatalkan, jadi ekspor cadangan dulu kalau datamu penting.</p>
            <p className="mt-2 text-sm">
              {summary ? <>Yang tersimpan sekarang: <span className="font-medium">{summary}</span>.</> : <span className="text-muted">Belum ada data yang tersimpan.</span>}
            </p>
            <Button className="mt-4" variant="danger" onClick={() => setConfirmOpen(true)}>Hapus data</Button>
          </Card>
        </div>
      </div>

      <ConfirmationDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        destructive
        title="Hapus semua data?"
        description={`${summary ? `Yang akan hilang: ${summary}. ` : ""}Tindakan ini tidak bisa dibatalkan. Tema akan kembali ke mode gelap.`}
        confirmLabel="Hapus data"
        onConfirm={async () => {
          try {
            await storage.clearAll();
            document.documentElement.setAttribute("data-theme", "dark");
            document.documentElement.classList.add("dark");
            toast({ title: "Data dihapus", variant: "success" });
          } catch {
            toast({ title: "Gagal menghapus data", description: "Penyimpanan browser tidak bisa diakses. Coba lagi ya.", variant: "error" });
          }
        }}
      />
    </>
  );
}

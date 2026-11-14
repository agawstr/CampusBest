"use client";

import { BookOpen, CalendarCheck, ListChecks, NotebookPen, Timer } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { StatCard } from "@/components/ui/stat-card";
import { useStorage } from "@/hooks/use-storage";
import { isTaskDone } from "@/lib/domain";

export default function DashboardPage() {
  const tasks = useStorage("tasks").data;
  const subjects = useStorage("subjects").data;
  const notes = useStorage("notes").data;
  const sessions = useStorage("focusSessions").data;
  const openTasks = tasks.filter((t) => !isTaskDone(t)).length;

  return (
    <>
      <PageHeader title="Dashboard" description="Ringkasan kuliah, tugas, dan jadwalmu hari ini." />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Tugas aktif" value={openTasks} hint="Belum selesai" icon={ListChecks} delay={0} />
        <StatCard label="Mata kuliah" value={subjects.length} hint="Semester ini" icon={BookOpen} delay={0.05} />
        <StatCard label="Catatan" value={notes.length} hint="Tersimpan" icon={NotebookPen} delay={0.1} />
        <StatCard label="Sesi fokus" value={sessions.length} hint="Total sesi" icon={Timer} delay={0.15} />
      </div>
      <Card className="mt-4" delay={0.2}>
        <EmptyState
          icon={CalendarCheck}
          title="Belum ada agenda hari ini"
          description="Setelah kamu menambahkan jadwal dan tugas, agenda hari ini akan muncul di sini."
        />
      </Card>
    </>
  );
}

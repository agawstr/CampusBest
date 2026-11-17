"use client";

import { useEffect, useState } from "react";
import { SegmentedControl } from "@/components/ui/field";
import { ActivitiesPanel } from "./activities-panel";
import { CourseSchedulePanel } from "./course-schedule-panel";

export type ScheduleTab = "kuliah" | "lain";
const TAB_PARAM = "tab";
const TAB_OPTIONS: { value: ScheduleTab; label: string }[] = [
  { value: "kuliah", label: "Kuliah" },
  { value: "lain", label: "Kegiatan Lain" },
];

/**
 * Schedule page shell: two tabs. "Kuliah" is the unchanged class schedule (course-schedule-panel.tsx);
 * "Kegiatan Lain" is the new activities panel. The tab can be opened from a link with `?tab=lain`
 * (the dashboard does this). The panels mount only after the tab is known, so a `?tambah=1` flag is
 * consumed by the right panel exactly once.
 */
export function ScheduleView() {
  const [tab, setTab] = useState<ScheduleTab | null>(null);

  useEffect(() => {
    setTab(new URLSearchParams(window.location.search).get(TAB_PARAM) === "lain" ? "lain" : "kuliah");
  }, []);

  function change(next: ScheduleTab) {
    setTab(next);
    const url = new URL(window.location.href);
    if (next === "lain") url.searchParams.set(TAB_PARAM, "lain"); else url.searchParams.delete(TAB_PARAM);
    window.history.replaceState(window.history.state, "", url.pathname + url.search + url.hash);
  }

  if (tab === null) return <div className="glass-item h-[120px] animate-pulse rounded-card" aria-hidden />;

  const tabs = (
    <div className="mb-4 sm:w-80">
      <SegmentedControl<ScheduleTab> label="Jenis jadwal" value={tab} onChange={change} options={TAB_OPTIONS} />
    </div>
  );
  return tab === "kuliah" ? <CourseSchedulePanel tabs={tabs} /> : <ActivitiesPanel tabs={tabs} />;
}

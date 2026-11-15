import {
  BarChart3, BookOpen, CalendarClock, CalendarDays, ClipboardCheck,
  ClipboardPaste, LayoutDashboard, ListChecks, NotebookPen, Settings, Timer, type LucideIcon,
} from "lucide-react";

export interface NavItem {
  key: string;
  href: string;
  label: string;
  icon: LucideIcon;
  /** Shown directly in the mobile bottom bar; others go under "More". */
  primary: boolean;
  description: string;
  /** Copy for placeholder pages that are not built yet. */
  placeholder?: { title: string; description: string };
}

export const NAV_ITEMS: NavItem[] = [
  { key: "dashboard", href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, primary: true,
    description: "Ringkasan kuliah, tugas, dan jadwalmu hari ini." },
  { key: "calendar", href: "/calendar", label: "Calendar", icon: CalendarDays, primary: true,
    description: "Lihat semua agenda dan tenggat dalam satu kalender.",
    placeholder: { title: "Kalender belum aktif", description: "Agenda, ujian, dan tenggat akan tampil di sini." } },
  { key: "tasks", href: "/tasks", label: "Tasks", icon: ListChecks, primary: true,
    description: "Kelola tugas berdasarkan mata kuliah dan prioritas.",
    placeholder: { title: "Belum ada daftar tugas", description: "Tugas kuliah akan dikelola di halaman ini." } },
  { key: "schedule", href: "/schedule", label: "Schedule", icon: CalendarClock, primary: true,
    description: "Jadwal kuliah mingguan.",
    placeholder: { title: "Jadwal belum tersedia", description: "Jadwal kuliah mingguanmu akan muncul di sini." } },
  { key: "subjects", href: "/subjects", label: "Subjects", icon: BookOpen, primary: false,
    description: "Daftar mata kuliah, dosen, dan SKS.",
    placeholder: { title: "Belum ada mata kuliah", description: "Mata kuliah yang kamu tambahkan akan tampil di sini." } },
  { key: "exams", href: "/exams", label: "Exams", icon: ClipboardCheck, primary: false,
    description: "Pantau jadwal ujian dan persiapannya.",
    placeholder: { title: "Belum ada jadwal ujian", description: "Ujian mendatang dan hitung mundurnya akan tampil di sini." } },
  { key: "notes", href: "/notes", label: "Notes", icon: NotebookPen, primary: false,
    description: "Catatan kuliah yang terhubung ke mata kuliah.",
    placeholder: { title: "Belum ada catatan", description: "Catatan kuliahmu akan tersimpan di sini." } },
  { key: "focus", href: "/focus", label: "Focus", icon: Timer, primary: false,
    description: "Timer fokus untuk sesi belajar.",
    placeholder: { title: "Timer fokus belum aktif", description: "Sesi belajar dan riwayat fokusmu akan tampil di sini." } },
  { key: "import", href: "/import", label: "Import", icon: ClipboardPaste, primary: false,
    description: "Impor tugas dari Google Classroom dan BRONE." },
  { key: "statistics", href: "/statistics", label: "Statistics", icon: BarChart3, primary: false,
    description: "Grafik progres belajar dan produktivitas.",
    placeholder: { title: "Belum ada statistik", description: "Statistik muncul setelah kamu mulai mencatat aktivitas." } },
  { key: "settings", href: "/settings", label: "Settings", icon: Settings, primary: false,
    description: "Tema, tampilan, dan data aplikasi." },
];

export const PRIMARY_NAV = NAV_ITEMS.filter((i) => i.primary);
export const SECONDARY_NAV = NAV_ITEMS.filter((i) => !i.primary);

export function isActivePath(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

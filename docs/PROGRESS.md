# CampusBest — Progres Pengembangan

Terakhir diperbarui: setelah Batch 3 (Phase 2: Class Schedule + Calendar). Batch 4 belum dimulai.

## 1. Teknologi dan struktur
- Next.js 15 (App Router), React 19, TypeScript strict, Tailwind 3.4 (CSS variable RGB), Radix Dialog, class-variance-authority, clsx + tailwind-merge, Lucide, Framer Motion, font Plus Jakarta Sans.
- Data: LocalStorage lewat `StorageAdapter` (bisa diganti ke IndexedDB/Supabase dengan `setStorageAdapter()`).
- Tidak ada: library chart, library tanggal, library form, test runner, ESLint (dimatikan saat build), backend.

```
src/
  app/            layout, template (transisi halaman), 10 route (dashboard, calendar, tasks, schedule,
                  subjects, exams, notes, focus, statistics, settings)
  components/
    ui/           button, card, modal, bottom-sheet, confirmation-dialog, empty-state, stat-card, field (Field, Input, Textarea, Select, SegmentedControl, ChipGroup)
    tasks/        tasks-view, task-item, task-form-modal
    subjects/     subjects-view, subject-card, subject-form-modal
    schedule/     schedule-view, schedule-item-card, schedule-form-modal
    calendar/     calendar-view, calendar-entry-row
    layout/       app-shell, sidebar, header, logo, theme-toggle, page-header, mobile-bottom-navigation
    shared/       placeholder-page
  providers/      theme, toast, app-providers
  hooks/          use-storage
  lib/            brand, storage-keys, storage, normalize, domain, date, id, navigation, tokens, theme-script, utils, tasks, subjects, schedule, calendar
  types/          models.ts, index.ts (StorageSchema)
scripts/          batch2-logic-check.ts, batch3-logic-check.ts (uji logika murni, jalankan dengan `npx tsx`)
docs/             dokumen ini + HANDOFF.md
```

Navigasi: `lib/navigation.ts` (`NAV_ITEMS`) adalah sumber tunggal. Mobile: 4 item utama + "More" (bottom sheet). Tablet: icon rail. Desktop: sidebar yang bisa diciutkan.

## 2. Fitur yang sudah selesai
- App shell responsif, tema Dark/Light tanpa flash, transisi halaman, toast, modal, bottom sheet, dialog konfirmasi, empty state.
- Dashboard: 4 kartu statistik dari storage + empty state agenda.
- Settings: pilih tema, uji penyimpanan, pratinjau komponen, hapus semua data.
- Layer penyimpanan: baca/tulis, sinkron antar tab, normalisasi, migrasi.
- Tasks (`/tasks`): daftar, tambah/edit/hapus, centang selesai/belum, judul, deskripsi, mata kuliah, tanggal + jam deadline, prioritas, status (Belum mulai/Dikerjakan/Selesai), filter status dan prioritas, pencarian (judul, deskripsi, nama/kode mata kuliah), urut deadline atau prioritas, empty state (belum ada tugas, dan tidak ada hasil filter).
- Subjects (`/subjects`): daftar kartu, tambah/edit/hapus, nama, kode, dosen, SKS, semester, warna, jumlah tugas terkait (aktif/selesai), empty state. Hapus mata kuliah TIDAK menghapus tugas terkait.
- Schedule (`/schedule`): tampilan mingguan (Senin-Minggu atau Minggu-Sabtu sesuai `weekStartsOn`; 7 kolom di layar >= 1536px, daftar per hari di bawahnya), navigasi minggu sebelumnya/berikutnya/"Minggu ini", tambah/edit/hapus (dengan konfirmasi), pilih mata kuliah dari Subjects, hari atau tanggal, jam mulai/selesai, ruangan, mode Online/Offline, pengulangan Mingguan/2 mingguan/Sekali. Tiap kartu menampilkan jam, mata kuliah, kode, dosen, mode + ruangan. Empty state (juga yang mengarahkan ke Subjects bila belum ada mata kuliah). Bagian "Perlu tanggal" untuk jadwal none/biweekly yang tidak punya tanggal valid.
- Calendar (`/calendar`): kalender bulanan, navigasi bulan, tombol "Hari ini", penanda hari ini, titik indikator per jenis (Kuliah = biru, Event = hijau, Deadline tugas = kuning), pilih tanggal untuk melihat daftar aktivitas, empty state per tanggal, tampilan Agenda (daftar hari yang berisi di bulan itu). Data dibaca langsung dari `schedules`, `tasks`, dan `events`; tidak ada penyimpanan kalender.
- Halaman Exams, Notes, Focus, Statistics masih placeholder. Dashboard belum diubah (Batch 5).

## 3. Perubahan Batch 1
1. Rebranding CampusMate -> CampusBest (nama, tagline "Your Campus Bestie.", deskripsi "Your friendly companion for a more organized campus life."). Sumber tunggal: `lib/brand.ts`.
2. Prefix LocalStorage `campusmate_` -> `campusbest_` + migrasi otomatis copy-only (lihat bagian 5).
3. Model data baru: Task (`completed`, `deadline`, `deadlineTime`), Subject (`semester`), ScheduleItem (`mode`, `recurrence`), CampusEvent (`category`, `location`).
4. `schemaVersion` 2 + normalisasi saat baca.
5. Utilitas: `generateId()`, helper tanggal lokal, `isTaskDone()`, `getTaskDeadline()`.
6. Antrean per koleksi pada `storage.update` (API tidak berubah).
7. Perbaikan keamanan data setelah Batch 1: nilai enum tak dikenal (mis. status "archived") dipulihkan saat disimpan.

## 3b. Perubahan Batch 2 (Tasks + Subjects)
Baru:
- `lib/tasks.ts`: filter, pencarian, pengurutan, label deadline, konversi form <-> record (`createTask`, `applyTaskEdit`, `toggleTaskDone`, `validateTaskForm`, `fieldsToPreserve`).
- `lib/subjects.ts`: palet warna, hitung tugas per mata kuliah, form <-> record (`createSubject`, `applySubjectEdit`, `validateSubjectForm`).
- `components/ui/field.tsx`: Field, Input, Textarea, Select, SegmentedControl, ChipGroup (dipakai ulang oleh batch berikutnya).
- `components/tasks/{tasks-view,task-item,task-form-modal}.tsx`, `components/subjects/{subjects-view,subject-card,subject-form-modal}.tsx`.
Diubah:
- `app/tasks/page.tsx`, `app/subjects/page.tsx` (tetap server component dengan metadata, isi di komponen client).
- `lib/storage.ts`: hanya menambah `storage.getCoercedRaw()` (lihat perbaikan lanjutan di bawah).
- `lib/domain.ts`: tambah `TASK_PRIORITY_LABELS`, `TASK_STATUS_KIND_LABELS`, tipe `TaskStatusKind`.
- `components/ui/modal.tsx`: tambah `max-h` + `overflow-y-auto` pada konten supaya form panjang bisa di-scroll di layar kecil (tidak ada perubahan lain).
- `package.json`: versi 0.3.0. Tidak ada dependency baru. API storage tidak diubah.

Keputusan desain Batch 2:
- Status di UI dikelompokkan lewat `taskStatusKind()`: `done` dan `completed` = "Selesai". Centang menulis `completed` + `completedAt`; membuka lagi menulis `todo` dan menghapus `completedAt`. Task lama berstatus `done` yang tidak diubah statusnya lewat form tetap `done`.
- Pengurutan: tugas selesai selalu di bawah. Tugas tanpa deadline (atau deadline rusak) di bawah tugas ber-deadline. Deadline tanpa jam dianggap berakhir pukul 23:59 hari itu.
- Mengosongkan deadline di form juga mengosongkan `dueDate` lama (kalau tidak, normalisasi akan memunculkannya lagi).
- Setiap simpan lewat `{ ...recordLama, ...perubahan, updatedAt }`, jadi field tak dikenal terjaga dan `updatedAt` selalu naik.
- Hapus mata kuliah: hanya `subjects` yang ditulis. `tasks` tidak disentuh. Tugas yang menunjuk id yang sudah hilang tampil tanpa label mata kuliah, dan di form dianggap "Tanpa mata kuliah" (id lama baru hilang kalau tugasnya disimpan ulang).
- Model `Subject` tidak punya field ruangan (ruangan ada di `ScheduleItem`, Batch 3), jadi ruangan tidak ada di form Subjects. SKS (`credits`) dan semester ada, masing-masing opsional, bilangan bulat 1-24 dan 1-14.

Perbaikan lanjutan Batch 2 (keamanan data, status/prioritas tak dikenal):
- Masalah: aturan pemulihan di storage (Batch 1) hanya memulihkan nilai asli bila `updatedAt` tidak berubah, sedangkan edit lewat form wajib menaikkan `updatedAt`. Akibatnya mengedit judul saja pada tugas berstatus "archived"/berprioritas "urgent" menuliskan nilai tampilan ("todo"/"medium"). Mencentang tugas (toggle) juga menimpa prioritas tak dikenal.
- Solusi: form mencatat field mana yang benar-benar diklik pengguna (`TaskFormTouched`). Untuk field yang TIDAK disentuh, nilai asli dari storage dibawa ulang (`fieldsToPreserve` -> parameter `preserved` pada `applyTaskEdit`/`toggleTaskDone`). Field yang disentuh selalu disimpan sesuai pilihan pengguna, termasuk bila pilihannya sama dengan nilai tampilan (mis. klik "Belum mulai" pada status "archived" menyimpan "todo").
- Checkbox selesai adalah perubahan status yang disengaja, jadi hanya prioritas tak dikenal yang dibawa ulang.
- Tambahan API storage (hanya menambah, tidak mengubah yang ada): `storage.getCoercedRaw(name, id, field)`, read-only, mengembalikan nilai asli field yang dinormalisasi dari pembacaan terakhir. Dipanggil di dalam `update()` sehingga nilainya selalu segar. Mekanisme pemulihan Batch 1 (`restoreCoerced`) tidak diubah.
- Aturan untuk batch berikutnya: kode yang mengedit record dengan field enum (schedules: `mode`, `recurrence`, `dayOfWeek`; events: `type`, `category`) harus memakai pola yang sama (lacak field yang disentuh, bawa ulang nilai asli lewat `getCoercedRaw`), bukan hanya menaikkan `updatedAt`.

## 3c. Perubahan Batch 3 (Class Schedule + Calendar)
Baru:
- `lib/schedule.ts`: aturan kemunculan (`occursOn`, `scheduleOnDate`, `buildWeek`, `needsDate`), label, form <-> record (`createSchedule`, `applyScheduleEdit`, `validateScheduleForm`, `scheduleFieldsToPreserve`).
- `lib/calendar.ts`: `entriesForDate` (gabungan jadwal + deadline tugas + event), `monthGrid`, `shiftMonth`, `entriesByDate`, `kindsPresent`, `agendaForMonth`, `defaultSelectionFor`.
- `components/schedule/{schedule-view,schedule-item-card,schedule-form-modal}.tsx`, `components/calendar/{calendar-view,calendar-entry-row}.tsx`.
- `scripts/batch3-logic-check.ts` (132 pemeriksaan) dan `scripts/batch2-logic-check.ts` (83, dipindah ke repo; kedua file diberi `export {}` supaya `tsc` tidak menganggap variabelnya global bersama).
Diubah: `types/models.ts` (+`ScheduleItem.date?`), `lib/normalize.ts` (+`date: optStr(raw.date)` di `normalizeSchedule`), `app/schedule/page.tsx`, `app/calendar/page.tsx` (tetap server component + metadata), `package.json` (0.4.0), `README.md`, dokumen ini dan HANDOFF.md.
Tidak diubah: API storage (tidak ada method baru), key storage (tidak ada koleksi baru untuk kalender), `schemaVersion` (tetap 2, karena field baru opsional dan aditif), komponen UI bersama.

Perubahan model dan dampaknya:
- `ScheduleItem.date?: string` ("YYYY-MM-DD", opsional). Record lama tanpa `date` tetap valid dan berperilaku sama: Phase 1 (tanpa `recurrence`) dibaca `weekly` dan tampil tiap minggu di `dayOfWeek`-nya. Membaca tidak menulis apa pun.
- Aturan kemunculan (satu-satunya tempat: `occursOn()`):
  - `weekly` (dan nilai recurrence tak dikenal, yang ditampilkan sebagai weekly): tiap minggu pada `dayOfWeek`. `date` diabaikan.
  - `none`: tepat pada `date`. Tanpa `date` valid, tidak muncul di mana pun.
  - `biweekly`: tiap 14 hari dihitung dari `date` (anchor), tidak pernah sebelum anchor. Harinya ikut hari dari anchor (bukan `dayOfWeek`), jadi data yang tidak konsisten tidak menggeser jadwal. Selisih hari dihitung lewat UTC (`diffInDays`), aman terhadap DST.
- Form: untuk none/biweekly pengguna memilih tanggal, `dayOfWeek` yang disimpan diturunkan dari tanggal itu (supaya pembaca lama tetap benar). Untuk weekly pengguna memilih hari dan `date` dihapus. Mengganti none -> weekly mempertahankan harinya.
- Record none/biweekly tanpa tanggal valid (data tidak biasa) tidak dihapus dan tidak ditebak; muncul di bagian "Perlu tanggal" di /schedule agar bisa dilengkapi.
- `date` yang bentuknya salah (mis. "2026-02-30") dibiarkan apa adanya di storage (tidak dihapus saat koleksi disimpan), tapi dianggap "tidak ada tanggal" oleh logika.

Preservasi enum (pola Tasks, diterapkan ke Schedule):
- Form mencatat `ScheduleFormTouched { mode, recurrence, dayOfWeek, date }`. Untuk field yang tidak disentuh, nilai asli dari `storage.getCoercedRaw("schedules", id, field)` (dipanggil di dalam `update()`) dibawa ulang lewat `scheduleFieldsToPreserve` -> parameter `preserved` pada `applyScheduleEdit`.
- `dayOfWeek` juga dianggap disentuh bila `date` atau `recurrence` disentuh (karena nilainya diturunkan dari keduanya).
- Bila recurrence tak dikenal tidak disentuh, `date` ikut dibiarkan seperti tersimpan.
- Pilihan yang disengaja selalu tersimpan, termasuk bila sama dengan nilai tampilan (mis. klik "Offline" pada mode "hybrid" menyimpan "offline").
- `dayOfWeek` berupa string "3" (legacy) tetap "3" selama tidak disentuh.

Keputusan desain lain:
- Hapus mata kuliah tidak menyentuh `schedules`. Jadwalnya tetap muncul dengan nama "Mata kuliah dihapus" (warna netral). Saat diedit, mata kuliah wajib dipilih ulang (form menjelaskannya).
- Kalender menampilkan tugas selesai juga (dicoret, "Selesai"). Titik indikator muncul untuk semua aktivitas.
- Urutan aktivitas di satu hari: yang punya jam dulu menurut jam mulai (deadline tugas memakai jam deadline), lalu yang seharian; seri: Kuliah, Event, Tugas, lalu judul.
- Kalender sudah membaca koleksi `events` (judul, kategori, lokasi, jam, mata kuliah) walau UI pembuatnya baru ada di Batch 4.
- Hari pertama minggu/bulan mengikuti `settings.weekStartsOn`. Navigasi minggu memakai offset dari minggu ini.

## 4. File penting
Baru: `lib/brand.ts`, `lib/storage-keys.ts`, `lib/domain.ts`, `lib/normalize.ts`, `lib/id.ts`, `lib/date.ts`.
Diubah: `lib/storage.ts` (ditulis ulang), `lib/theme-script.ts`, `types/models.ts`, `app/layout.tsx`, `app/dashboard/page.tsx`, `app/settings/page.tsx`, `components/layout/{logo,sidebar,mobile-bottom-navigation}.tsx`, `package.json`, `README.md`.

## 5. Penyimpanan: aturan yang harus dijaga
- Key: `campusbest_{subjects,tasks,schedules,events,notes,focus_sessions,settings}`, flag `campusbest_migration_v1`. Definisi di `lib/storage-keys.ts`.
- Migrasi: berjalan sekali pada baca/tulis pertama. Menyalin string mentah `campusmate_*` ke `campusbest_*` hanya jika key baru belum ada. Key lama tidak pernah diubah/dihapus kecuali lewat "Hapus semua data". Flag ditulis hanya jika semua salinan sukses.
- Theme script membaca `campusbest_settings`, fallback ke `campusmate_settings`.
- Membaca tidak pernah menulis. Field tak dikenal dipertahankan. Entri non-objek disimpan terpisah dan ditambahkan kembali saat menulis. JSON rusak dicadangkan ke `<key>__corrupt`.
- Enum tak dikenal (status/priority/mode/recurrence/dayOfWeek/type/category): tampil dengan nilai aman di memori, tapi nilai aslinya dipulihkan saat disimpan selama record tidak diedit. Syarat: kode yang mengedit record WAJIB menaikkan `updatedAt`.
- Pakai `isTaskDone()` dan `getTaskDeadline()`, jangan bandingkan langsung ke `"done"` / `dueDate`.
- Tanggal = `YYYY-MM-DD` lokal, jam = `HH:mm`. Jangan pakai `toISOString()` untuk kunci tanggal. `dayOfWeek` 0 = Minggu.
- Tulisan baru untuk Task memakai `deadline`; `dueDate` hanya dibaca untuk kompatibilitas.

## 6. Status pengujian
Terverifikasi (lingkungan tanpa jaringan, tanpa `node_modules`):
- Batch 1: `tsc` strict untuk `lib/*` lolos; skrip uji perilaku storage lolos (migrasi, normalisasi, antrean update, enum tak dikenal, dll.).
- Batch 2: `tsc` strict untuk `lib/*` dan `types/*` lolos (satu-satunya error: modul pihak ketiga yang tidak terpasang). Skrip uji perilaku (tsx, localStorage tiruan, TZ Asia/Jakarta): 83 pemeriksaan lolos (66 awal, dengan satu ekspektasi lama yang sengaja diganti karena mengunci perilaku yang keliru, + 17 untuk perbaikan lanjutan), mencakup filter, pencarian, pengurutan, label deadline (terlambat/hari ini/besok), validasi form, create/edit/toggle, field tak dikenal dan `updatedAt`, `dueDate` lama, status `done` lama, status/prioritas tak dikenal tetap utuh setelah tulis, entri orphan, migrasi dari `campusmate_tasks`, hapus mata kuliah tidak mengubah isi `campusbest_tasks` sedikit pun, 20 tulis paralel. Perbaikan lanjutan: edit judul/deskripsi/deadline tidak mengubah status/prioritas tak dikenal (juga pada edit berturut-turut), pilihan manual tersimpan, klik pada nilai yang sama dengan nilai tampilan tetap tersimpan, checkbox mempertahankan prioritas tak dikenal, tugas normal tidak berubah perilakunya. Dicek juga dengan mematikan mekanisme preservasi sementara: 8 pemeriksaan gagal seperti seharusnya, lalu kode dikembalikan.
- Semua file TSX diperiksa dengan pemeriksaan tipe berbasis shim: tidak ada error impor/ekspor atau nama props pada kode baru. Ini BUKAN pengganti typecheck sungguhan, karena tipe React/Next/Radix/Lucide/Framer tidak tersedia.

- Batch 3 (lingkungan yang sama, tanpa jaringan dan tanpa `node_modules`): `tsc` strict untuk `lib/*` dan kedua skrip uji lolos tanpa error. `scripts/batch3-logic-check.ts`: 132 pemeriksaan lolos di TZ Asia/Jakarta, America/New_York, Europe/London, Pacific/Auckland, America/Sao_Paulo. `batch2-logic-check.ts` tetap 83 lolos (regresi, Jakarta dan New York). Cakupan: aturan none/weekly/biweekly (termasuk lintas tahun dan DST), data Phase 1/legacy, CRUD lewat `storage` (tambah, edit, ganti recurrence, geser anchor, hapus, 20 tulis paralel), baca ulang dari JSON mentah (simulasi refresh), field tak dikenal, `updatedAt`, enum tak dikenal (mode/recurrence/dayOfWeek) pada edit biasa, edit berturut-turut, pilihan manual, string "3", saudara yang tidak ikut berubah, entri orphan, `date` rusak, migrasi `campusmate_schedules`, gabungan kalender (jadwal + deadline + event), urutan, grid bulan (4/5/6 baris, awal Senin/Minggu, tahun kabisat), navigasi bulan, agenda, hapus mata kuliah. Mutasi sengaja (preservasi dimatikan, paritas 14 hari diganti 7, hari tidak diturunkan dari tanggal) membuat 11, 7, dan 4 pemeriksaan gagal, lalu kode dikembalikan dan semua lolos lagi.
- Semua file TSX baru dicek dengan shim tipe (bukan typecheck sungguhan). Satu-satunya keluhan berasal dari shim itu sendiri (parameter event tak bertipe karena `Input` dishim sebagai any, ikon di toast-provider yang tidak ada di daftar shim), bukan dari kode. Tidak ada error impor/ekspor atau nama props pada kode Batch 3.

BELUM terverifikasi:
- Baseline Batch 1, 2, dan 3: `npm install`, `npm run typecheck` (seluruh project), `npm run build`. Baseline Batch 1 tidak pernah dijalankan penuh sebelum Batch 2 dimulai.
- Tampilan di browser (dark/light, mobile/tablet/desktop), perilaku modal/form (fokus, keyboard, date/time picker bawaan browser), animasi, dan toast.
- Nama ikon Lucide yang dipakai di kode baru belum dicek terhadap lucide-react 0.460 yang terpasang. Batch 2: `Plus, Pencil, Trash2, Check, Clock, Search, SearchX, X, ListChecks, BookOpen, User`. Batch 3 (tambahan): `CalendarClock, CalendarDays, ChevronLeft, ChevronRight, MapPin, Repeat, Video, GraduationCap, ClipboardList`.
- Batch 3 di browser: tata letak 7 kolom (`2xl:`), grid bulan di layar kecil (tinggi sel 56px), kontras warna titik indikator di light mode (kuning memakai `bg-amber-500` bawaan Tailwind), perilaku input tanggal/jam, fokus modal, dan tombol navigasi minggu/bulan belum pernah dilihat.

Batasan yang diketahui:
- Antrean `update` hanya melindungi satu tab; antar tab masih bisa saling menimpa.
- Pemulihan enum bergantung pada `updatedAt`; `theme`/`weekStartsOn` di settings tidak dipulihkan.
- Task berstatus/prioritas tak dikenal tampil sebagai "todo"/"medium" di UI. Nilai aslinya dipertahankan saat diedit atau dicentang selama pengguna tidak mengubah field itu; baru berubah bila pengguna memilihnya sendiri.
- Field non-enum yang tidak valid (mis. `credits: "abc"`, `deadlineTime: "25:00"`) dinormalisasi menjadi kosong; saat record itu diedit lewat form, nilai tidak valid tersebut hilang. Belum ada mekanisme preservasi untuk field ini.
- Membuka kembali tugas selesai selalu menjadi "Belum mulai" (status "Dikerjakan" sebelumnya tidak diingat).
- Kalau LocalStorage tidak tersedia, adapter menulis diam-diam tanpa error, jadi UI tetap menampilkan toast sukses. Toast error hanya muncul bila penulisan melempar error (mis. kuota penuh).
- Kategori event lama ditebak dari judul (hanya di memori sampai disimpan).
- `recurrence: "none"` (sekali saja) belum punya field tanggal.
- Tasks belum bisa difilter per mata kuliah (tidak diminta di Batch 2).
- Batch 3: jadwal `weekly` tidak punya tanggal mulai/akhir, jadi muncul di semua minggu (termasuk masa lalu atau di luar semester). `biweekly` baru mulai dari anchor-nya.
- Batch 3: belum ada deteksi jadwal yang bentrok jam.
- Batch 3: pilihan tanggal/bulan yang sedang dilihat tidak disimpan di URL. "Hari ini" dihitung saat render, jadi lewat tengah malam baru terbarui setelah ada interaksi.
- Batch 3: mengedit jadwal dengan `date` rusak lewat form menggantinya dengan tanggal yang diisi pengguna (aturan wajib tanggal untuk none/biweekly).
- Batch 3: koleksi `events` belum bisa diisi lewat UI (Batch 4), jadi event di kalender baru teruji lewat data uji.

## 7. Menjalankan lokal
```bash
npm install
npm run dev          # http://localhost:3000
npm run typecheck
npm run build
```
Uji migrasi manual: di DevTools Console set `localStorage.setItem("campusmate_tasks", '[{"id":"1","title":"Tes","status":"done"}]')`, hapus key `campusbest_*`, reload; data harus muncul dan key `campusmate_tasks` tetap ada.

## 8. Tahapan berikutnya (pembagian batch resmi)
Spesifikasi tiap batch dikirim pemilik proyek satu per satu. Jangan mulai batch berikutnya sebelum batch sebelumnya dilaporkan dan disetujui.
- **Batch 2: Tasks + Subjects** (halaman `/tasks` dan `/subjects`). SELESAI dikodekan; belum diverifikasi build/browser (lihat bagian 6).
- **Batch 3: Class Schedule + Calendar** (halaman `/schedule` dan `/calendar`). SELESAI dikodekan; belum diverifikasi build/browser (lihat bagian 6).
- **Batch 4: Exams & Events** (halaman `/exams`, event kampus, kategori UTS/UAS/Quiz/dll).
- **Batch 5: Dashboard Integration + Testing** (hubungkan Dashboard ke semua fitur, pengujian menyeluruh).
- **Phase 3:** menurut daftar terbaru pemilik proyek: Notes, Focus Timer, Statistics, Settings, Export/Import, PWA, optimasi. Di luar Phase 2. Notes/Focus tetap placeholder sampai ada spesifikasi.

Catatan: Notes dan Focus tetap placeholder sampai ada instruksi. Jangan mulai Batch 4 sebelum Batch 3 disetujui.

Catatan untuk Batch 4: kalender sudah menampilkan `events` lewat `entriesForDate`. Form Events harus memakai pola preservasi yang sama untuk `type` dan `category` (lacak field yang disentuh + `storage.getCoercedRaw("events", id, field)`). Saat mengubah kategori, `type` ikut diturunkan lewat `eventTypeFromCategory`, jadi anggap `type` disentuh bila `category` disentuh.

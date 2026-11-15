# CampusBest — Progres Pengembangan

Terakhir diperbarui: setelah Batch 5 (Phase 2: Dashboard Integration + pengujian akhir). Phase 2 selesai dikodekan. Phase 3 belum dimulai.

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
    events/       events-view, event-item, event-form-modal
    dashboard/    dashboard-view, quick-actions, today-schedule-card, upcoming-tasks-card, upcoming-events-card, task-progress-card, section-header
    layout/       app-shell, sidebar, header, logo, theme-toggle, page-header, mobile-bottom-navigation
    shared/       placeholder-page
  providers/      theme, toast, app-providers
  hooks/          use-storage, use-now, use-open-from-query
  lib/            brand, storage-keys, storage, normalize, domain, date, id, navigation, tokens, theme-script, utils, tasks, subjects, schedule, calendar, events
  types/          models.ts, index.ts (StorageSchema)
scripts/          batch2..batch5-logic-check.ts, run-logic-checks.sh (uji logika murni, jalankan dengan `npx tsx`)
docs/             dokumen ini + HANDOFF.md
```

Navigasi: `lib/navigation.ts` (`NAV_ITEMS`) adalah sumber tunggal. Mobile: 4 item utama + "More" (bottom sheet). Tablet: icon rail. Desktop: sidebar yang bisa diciutkan.

## 2. Fitur yang sudah selesai
- App shell responsif, tema Dark/Light tanpa flash, transisi halaman, toast, modal, bottom sheet, dialog konfirmasi, empty state.
- Dashboard (`/dashboard`): lihat Batch 5 di bawah (sapaan, 6 kartu statistik, jadwal hari ini, tugas terdekat, ujian & event mendatang, aksi cepat, progres tugas).
- Settings: pilih tema, uji penyimpanan, pratinjau komponen, hapus semua data.
- Layer penyimpanan: baca/tulis, sinkron antar tab, normalisasi, migrasi.
- Tasks (`/tasks`): daftar, tambah/edit/hapus, centang selesai/belum, judul, deskripsi, mata kuliah, tanggal + jam deadline, prioritas, status (Belum mulai/Dikerjakan/Selesai), filter status dan prioritas, pencarian (judul, deskripsi, nama/kode mata kuliah), urut deadline atau prioritas, empty state (belum ada tugas, dan tidak ada hasil filter).
- Subjects (`/subjects`): daftar kartu, tambah/edit/hapus, nama, kode, dosen, SKS, semester, warna, jumlah tugas terkait (aktif/selesai), empty state. Hapus mata kuliah TIDAK menghapus tugas terkait.
- Schedule (`/schedule`): tampilan mingguan (Senin-Minggu atau Minggu-Sabtu sesuai `weekStartsOn`; 7 kolom di layar >= 1536px, daftar per hari di bawahnya), navigasi minggu sebelumnya/berikutnya/"Minggu ini", tambah/edit/hapus (dengan konfirmasi), pilih mata kuliah dari Subjects, hari atau tanggal, jam mulai/selesai, ruangan, mode Online/Offline, pengulangan Mingguan/2 mingguan/Sekali. Tiap kartu menampilkan jam, mata kuliah, kode, dosen, mode + ruangan. Empty state (juga yang mengarahkan ke Subjects bila belum ada mata kuliah). Bagian "Perlu tanggal" untuk jadwal none/biweekly yang tidak punya tanggal valid.
- Calendar (`/calendar`): kalender bulanan, navigasi bulan, tombol "Hari ini", penanda hari ini, titik indikator per jenis (Kuliah = biru, Event = hijau, Deadline tugas = kuning), pilih tanggal untuk melihat daftar aktivitas, empty state per tanggal, tampilan Agenda (daftar hari yang berisi di bulan itu). Data dibaca langsung dari `schedules`, `tasks`, dan `events`; tidak ada penyimpanan kalender.
- Exams & Events (`/exams`): daftar ujian dan event, tambah/edit/hapus (dengan konfirmasi), nama, deskripsi, kategori (UTS, UAS, Quiz, Presentasi, Praktikum, Seminar, Lainnya), tanggal, jam mulai/selesai (opsional), lokasi, mata kuliah (opsional). Pencarian (nama, deskripsi, lokasi, nama/kode mata kuliah), filter kategori, filter waktu (Semua, Hari ini, 7 hari ke depan, Mendatang, Sudah lewat), urut tanggal terdekat, penanda hitung mundur ("Besok", "3 hari lagi", "5 hari lalu"), empty state (belum ada event, dan tidak ada hasil filter).
- Event dari Exams otomatis muncul di Calendar (kartu Batch 3 yang sama, label kategori ikut tampil). Kalender hanya membaca koleksi `events`.
- Dashboard terhubung ke Tasks, Subjects, Schedule, dan Exams & Events (Batch 5). Halaman Notes, Focus, Statistics masih placeholder.

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

## 3d. Perubahan Batch 4 (Exams & Events)
Baru:
- `lib/events.ts`: filter (`filterEvents`), urutan (`sortEvents`), label tanggal (`eventDateInfo`, `eventTimeLabel`), form <-> record (`createEvent`, `applyEventEdit`, `validateEventForm`, `eventToFormValues`, `eventFieldsToPreserve`).
- `components/events/{events-view,event-item,event-form-modal}.tsx`.
- `scripts/batch4-logic-check.ts` (108 pemeriksaan).
Diubah: `app/exams/page.tsx` (tetap server component + metadata), `lib/calendar.ts` + `components/calendar/calendar-entry-row.tsx` (lihat di bawah), `scripts/batch3-logic-check.ts` (dua asersi disesuaikan dengan perubahan kalender), `package.json` (0.5.0), `README.md`, dokumen ini dan HANDOFF.md.
Tidak diubah: model `CampusEvent` (semua field yang diperlukan sudah ada), `lib/normalize.ts`, API storage, key storage, `schemaVersion`, komponen UI bersama.

Integrasi Calendar:
- Tidak ada penyimpanan atau salinan baru. `entriesForDate()` sudah membaca `events` sejak Batch 3; yang berubah hanya tampilannya: `CalendarEntry` mendapat `categoryLabel` ("UTS", "Quiz", ...) yang dipakai sebagai label di baris aktivitas menggantikan kata "Event", dan kategori tidak lagi digabung ke `detail` (isinya sekarang lokasi + nama mata kuliah). Efeknya, dua asersi lama di `batch3-logic-check.ts` diperbarui; sisanya tidak berubah.
- Karena `useStorage("events")` dipakai kedua halaman, tambah/edit/hapus di /exams langsung tercermin di /calendar (di tes: dicek lewat membaca ulang koleksi setelah tiap operasi, bukan lewat browser).
- Kalender tetap memakai tiga jenis titik (Kuliah, Event, Deadline tugas). Event ujian belum punya warna titik sendiri.

Preservasi enum (pola Tasks/Schedule):
- Form hanya punya satu kontrol enum: kategori. `type` tidak punya kontrol karena diturunkan dari kategori, sehingga `EventFormTouched = { category }` dan menyentuh kategori dianggap menyentuh `type` juga.
- Kategori disentuh: `category` = pilihan, `type` = `eventTypeFromCategory(pilihan)`. Tersimpan juga bila pilihannya sama dengan nilai tampilan (mis. klik "Lainnya" pada kategori "hologram" menyimpan "lainnya").
- Kategori tidak disentuh: `category` dan `type` dibawa ulang dari `storage.getCoercedRaw("events", id, field)` bila tak dikenal (di dalam `update()`), dan bila dikenal tetap seperti tersimpan. Jadi `type` lama yang sah seperti "deadline" juga tidak ditulis ulang oleh edit yang tidak terkait.
- Konsekuensi yang disengaja: event lama tanpa `category` yang kategorinya ditebak dari judul (mis. "UTS ...") akan menyimpan tebakan itu secara eksplisit saat diedit, karena itu yang ditampilkan form.
- Nilai non-string (mis. `category: 5`) juga dipertahankan.

Keputusan desain lain:
- Tanggal wajib. Jam opsional; jam selesai hanya boleh bila jam mulai diisi dan harus setelah jam mulai. Event tanpa jam ditampilkan "Seharian".
- Kategori awal pada event baru "Lainnya" (supaya kategori tidak terisi salah diam-diam); tanggal awal kosong.
- Urutan "terdekat": hari ini dan setelahnya naik, lalu yang sudah lewat dari yang terbaru ke belakang, lalu yang tanpa tanggal valid. Pada tanggal yang sama: tanpa jam dulu, lalu jam mulai, lalu judul (untuk yang sudah lewat, jam yang lebih akhir dulu).
- "7 hari ke depan" = hari ini sampai 6 hari setelahnya. Event tanpa tanggal valid hanya tampil pada filter waktu "Semua" dan ditandai "Belum ada tanggal"; mengeditnya dan mengisi tanggal memperbaikinya.
- Pencarian mencakup judul, deskripsi, lokasi, nama dan kode mata kuliah (lebih luas dari permintaan: nama + deskripsi).
- Mata kuliah yang sudah dihapus: event tetap ada tanpa label mata kuliah; bila event itu disimpan lewat form, id yang hilang ikut terhapus (sama seperti Tasks).

## 3e. Perubahan Batch 5 (Dashboard Integration + pengujian akhir)
Baru:
- `lib/dashboard.ts`: `buildDashboard()` (satu model untuk seluruh halaman) dan bagian-bagiannya: `greetingFor`, `dateLine`, `taskProgress`, `isOverdue`, `upcomingTasks`, `todayClasses`, `classStatus`, `upcomingEvents`. Tidak menyimpan atau menulis apa pun; `now` dioper sebagai parameter.
- `lib/quick-actions.ts`: daftar aksi cepat, `ADD_PARAM` (`tambah`), `wantsAdd()`, `withoutAddParam()`.
- `hooks/use-now.ts` (jam sekarang, null sebelum mount, diperbarui tiap menit dan saat tab kembali terlihat), `hooks/use-open-from-query.ts`.
- `components/dashboard/{dashboard-view, quick-actions, today-schedule-card, upcoming-tasks-card, upcoming-events-card, task-progress-card, section-header}.tsx`.
- `scripts/batch5-logic-check.ts` (69 pemeriksaan, termasuk skenario lintas fitur dan pemeriksaan statis seluruh `src/`) dan `scripts/run-logic-checks.sh` (semua uji di lima zona waktu).
Diubah: `app/dashboard/page.tsx` (dulu client page tanpa metadata; sekarang server component + metadata, isi di `DashboardView`), `components/{tasks/tasks-view, schedule/schedule-view, events/events-view}.tsx` (masing-masing hanya +1 import dan +1 baris `useOpenFromQuery(openCreate)`), `components/tasks/task-item.tsx` dan `components/events/event-item.tsx` (konstanta warna `PRIORITY_TONE`, `DEADLINE_TONE`, `CATEGORY_TONE`, `DATE_TONE` diberi `export` supaya Dashboard memakai warna yang sama), `package.json` (0.6.0), `README.md`, dokumen ini dan HANDOFF.md.
Tidak diubah: model, `lib/normalize.ts`, API storage, key storage, `schemaVersion`, komponen UI bersama, dependency.

Isi Dashboard:
- Sapaan menurut jam (04:00-10:59 pagi, 11:00-14:59 siang, 15:00-17:59 sore, selebihnya malam), tanggal format Indonesia ("Rabu, 18 November 2026"), dan "CampusBest · Your Campus Bestie." di atas judul.
- 6 kartu statistik dari data asli: Total tugas, Belum selesai, Sudah selesai, Terlambat, Mata kuliah, Ujian & event (hari ini dan mendatang).
- Jadwal hari ini lewat `scheduleOnDate` (aturan Batch 3: weekly, biweekly dari anchor, sekali saja): jam, mata kuliah, kode, dosen, Online/Offline + ruangan, penanda "Sedang berlangsung" dan "Selesai" (mulai inklusif, selesai eksklusif). Empty state berbeda untuk "belum ada jadwal sama sekali" dan "tidak ada kuliah hari ini".
- Tugas terdekat (5 teratas, yang belum selesai): `sortTasks(..., "deadline")`, jadi yang terlambat paling atas (badge "Terlambat" + garis merah), lalu yang terdekat, lalu yang tanpa deadline. Menampilkan mata kuliah, deadline, prioritas, status; link "Semua tugas" dan "+N tugas lainnya".
- Ujian & event mendatang (5 teratas): `filterEvents` (waktu "upcoming") + `sortEvents` dari `lib/events.ts`, dengan kategori, tanggal, jam, mata kuliah, lokasi; link "Semua event".
- Aksi cepat: Tambah tugas, Tambah jadwal, Tambah event, Lihat kalender. Tiga yang pertama membuka form modal yang SUDAH ada di Tasks/Schedule/Exams lewat `/tasks?tambah=1` dst.; flag dibaca saat mount lalu dihapus dari URL (`history.replaceState`), jadi refresh tidak membuka form lagi. Tidak ada form, modal, atau logika simpan baru di Dashboard (dijaga oleh pemeriksaan statis di tes).
- Progres tugas: persentase (dibulatkan), jumlah selesai dan belum selesai, bilah progres (`role="progressbar"`), dan jumlah yang terlambat.

Keputusan desain:
- Kartu "Catatan" dan "Sesi fokus" dari Dashboard Phase 1 dihapus: Notes dan Focus masih placeholder (angkanya selalu 0) dan spesifikasi Batch 5 menyebut enam kartu lain. Tambahkan kembali di Phase 3 bila fiturnya sudah ada.
- "Terlambat" = belum selesai dan lewat deadline (deadline tanpa jam berakhir 23:59 hari itu). Tugas selesai tidak pernah dihitung terlambat. Status tak dikenal dihitung belum selesai (sama dengan Tasks).
- "Ujian & event mendatang" = hari ini dan seterusnya (sama dengan filter "Mendatang" di Exams), jadi event hari ini yang jamnya sudah lewat tetap terhitung.
- Karena `useNow` memperbarui jam tiap menit, sapaan, penanda "sedang berlangsung", dan pergantian hari di Dashboard ikut benar tanpa reload (batasan "hari ini dihitung saat render" yang tercatat di Batch 3/4 tetap berlaku untuk halaman lain).
- Server dan render klien pertama sama (kerangka pemuatan) karena jam baru diisi setelah mount; tidak ada risiko hydration mismatch dari zona waktu server.

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

- Batch 4 (lingkungan yang sama, tanpa jaringan dan tanpa `node_modules`): `tsc` strict untuk `lib/*` dan ketiga skrip uji lolos tanpa error. `scripts/batch4-logic-check.ts`: 108 pemeriksaan lolos di TZ Asia/Jakarta, America/New_York, Europe/London, Pacific/Auckland, America/Sao_Paulo. Regresi di kelima zona itu: batch2 83, batch3 132, semua lolos. Cakupan Batch 4: ketujuh kategori (tipe turunan, tersimpan, label di kalender), validasi form, create, CRUD lewat `storage` (tambah, edit, ganti kategori, geser tanggal, hapus, 20 tulis paralel), baca ulang JSON mentah (simulasi refresh), pencarian (judul/deskripsi/lokasi/mata kuliah, tanpa huruf besar-kecil), filter kategori dan waktu (termasuk batas 7 hari), kombinasi filter, urutan (terdekat, lewat, tanpa tanggal, seri jam/judul), label tanggal, data lama (Phase 1 tanpa category, type "deadline", tanpa type/category, tanpa tanggal, migrasi `campusmate_events`), enum tak dikenal pada edit biasa dan berturut-turut, pilihan manual yang sama dengan nilai tampilan, kategori sah + type tak dikenal, nilai non-string, saudara yang tidak ikut berubah, entri orphan, `updatedAt`, dan integrasi kalender (muncul di tanggal yang benar dengan label/jam/lokasi/mata kuliah, pindah tanggal, ganti kategori, hapus, titik bulan dan agenda ikut berubah, bergabung dengan kuliah dan tugas, hanya key `campusbest_events` yang ada, hapus mata kuliah tidak menyentuh events). Empat mutasi sengaja (preservasi dimatikan, `type` tidak diturunkan, urutan lewat dibalik, jendela 7 hari bergeser) membuat 8, 4, 1, dan 1 pemeriksaan gagal, lalu kode dikembalikan dan semua lolos lagi.
- File TSX Batch 4 dicek dengan shim tipe (bukan typecheck sungguhan); satu-satunya keluhan berasal dari shim (parameter event tak bertipe, `useToast`, daftar ikon), bukan dari kode.
- Laporan pemilik: Batch 3 "sudah berhasil dijalankan di repository". Detail (typecheck/build/browser) tidak dirinci, dan saya tidak dapat memverifikasinya di sini.

- Batch 5 (lingkungan yang sama, tanpa jaringan dan tanpa `node_modules`): `tsc` strict untuk `lib/*` dan keempat skrip uji lolos tanpa error (dengan shim tipe untuk `node:fs`/`node:path`; di project asli tipenya dari `@types/node`). `scripts/batch5-logic-check.ts`: 69 pemeriksaan lolos di TZ Asia/Jakarta, America/New_York, Europe/London, Pacific/Auckland, America/Sao_Paulo. Regresi di kelima zona itu: batch2 83, batch3 132, batch4 108, semua lolos (`bash scripts/run-logic-checks.sh`). Cakupan Dashboard: batas sapaan, format tanggal, data kosong (nol, tanpa pembagian nol, tidak menulis data), statistik dari data tersimpan yang sebagian format legacy (done + completed, `dueDate`, status tak dikenal), terlambat (jam, tanpa jam 23:59, hari ini lebih awal vs lebih malam, selesai tidak dihitung), pembulatan persen, jadwal hari ini (weekly, biweekly minggu aktif/nonaktif, sekali saja, recurrence tak dikenal, tanpa tanggal, mata kuliah terhapus, pergantian tengah malam, batas status), tugas terdekat (urutan, batas, total, sama dengan Tasks), event mendatang (sama dengan Exams, hari berikutnya), dashboard mengikuti sumber setelah centang/tambah/edit/hapus tugas, jadwal, event, dan mata kuliah, hanya key koleksi yang sudah ada, kesamaan dengan Calendar, data Phase 1 setelah migrasi, aksi cepat (rute ada, flag, pembersihan URL, memakai form yang sudah ada, tidak ada form/penulisan di Dashboard), serta pemeriksaan statis seluruh `src/` (tanpa kunci tanggal berbasis UTC, `localStorage` hanya di layer storage dan theme script, tidak ada id Math.random, semua rute nav punya halaman, hanya Notes/Focus/Statistics yang placeholder, halaman Phase 2 server component + metadata, tidak ada dependency baru). Mutasi sengaja (batas akhir kuliah inklusif, persen dilantai, tugas selesai ikut daftar, batas sapaan pagi/siang, urutan menurut prioritas, tanggal hari ini berbasis UTC di Auckland) membuat 1, 1, 3, 1, 1, 3, dan 11 pemeriksaan gagal, lalu kode dikembalikan dan semua lolos lagi. Dua mutasi lain tidak gagal karena memang setara secara perilaku (equivalent mutant): cek `!isTaskDone` di `isOverdue` redundan karena `deadlineInfo` sudah menangani tugas selesai, dan batas bawah "sore" tertutup cabang "siang" yang dievaluasi lebih dulu.
- File TSX Batch 5 dicek dengan shim tipe (bukan typecheck sungguhan); satu-satunya keluhan berasal dari shim (daftar ikon, `useToast`, parameter event), bukan dari kode.

BELUM terverifikasi:
- Baseline Batch 1-4 oleh saya: `npm install`, `npm run typecheck` (seluruh project), `npm run build`. Baseline Batch 1 tidak pernah dijalankan penuh sebelum Batch 2 dimulai.
- Tampilan di browser (dark/light, mobile/tablet/desktop), perilaku modal/form (fokus, keyboard, date/time picker bawaan browser), animasi, dan toast.
- Nama ikon Lucide yang dipakai di kode baru belum dicek terhadap lucide-react 0.460 yang terpasang. Batch 2: `Plus, Pencil, Trash2, Check, Clock, Search, SearchX, X, ListChecks, BookOpen, User`. Batch 3 (tambahan, dilaporkan pemilik sudah jalan): `CalendarClock, CalendarDays, ChevronLeft, ChevronRight, MapPin, Repeat, Video, GraduationCap, ClipboardList`.
- Batch 5: tidak ada nama ikon baru (hanya yang sudah dipakai: `AlertCircle`, `CheckCircle2` dari toast, `CalendarCheck` dari Dashboard lama, `ChevronRight`, `ListChecks`, `BookOpen`, `Clock`, `ClipboardCheck`, `CalendarClock`, `CalendarDays`, `MapPin`, `User`, `Video`). Belum diverifikasi di browser: tata letak 2 kolom Dashboard (`lg:`), 6 kartu statistik di layar kecil, ukuran tombol aksi cepat, bilah progres, pergantian gelap/terang, perilaku `history.replaceState` bersama router Next.js (membuka form dari aksi cepat, dan URL yang dibersihkan), dan `useOpenFromQuery` di mode dev (React Strict Mode menjalankan effect dua kali; flag sudah dihapus pada pemanggilan pertama).
- Batch 4: nama ikon baru tidak ada selain yang sudah dipakai sebelumnya (`ClipboardCheck` dari navigasi, `CalendarDays`, `Clock`, `MapPin`, `Pencil`, `Trash2`, `Search`, `SearchX`, `X`, `Plus`). Tampilan di browser (daftar event, baris filter dengan chip yang bisa digeser, modal form yang panjang di layar kecil, input tanggal/jam, `type="search"` dengan tombol hapus sendiri) belum pernah dilihat.
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
- Batch 4: event tidak punya pengulangan (tiap event satu tanggal) dan tidak mendukung rentang beberapa hari.
- Batch 4: event tanpa tanggal valid (data lama) tidak tampil di Calendar dan hanya terlihat di /exams pada filter "Semua".
- Batch 4: filter waktu dan penanda "hari ini/besok" dihitung saat render; lewat tengah malam baru terbarui setelah ada interaksi.
- Batch 4: mengedit event lama tanpa `category` menulis kategori tebakan secara eksplisit (lihat di atas).
- Batch 4: `description` tidak ikut tampil di Calendar (hanya di /exams).
- Batch 5: Dashboard menampilkan maksimal 5 tugas dan 5 event; sisanya lewat link "+N lainnya". Tugas yang terlambat banyak akan memenuhi daftar tugas terdekat (disengaja: itu yang paling perlu perhatian).
- Batch 5: tugas tanpa deadline ikut daftar "Tugas terdekat" di urutan terakhir.
- Batch 5: bila dua kuliah jamnya tumpang tindih, keduanya bisa berstatus "Sedang berlangsung".
- Batch 5: aksi cepat bergantung pada `?tambah=1`; membuka URL itu langsung (mis. dari bookmark) juga membuka form tambah.
- Batch 5: Dashboard tidak punya tombol centang tugas; mengubah status tetap lewat halaman Tasks.

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
- **Batch 4: Exams & Events** (halaman `/exams`, event kampus, kategori UTS/UAS/Quiz/dll). SELESAI dikodekan; belum diverifikasi build/browser (lihat bagian 6).
- **Batch 5: Dashboard Integration + Testing** (hubungkan Dashboard ke semua fitur, pengujian menyeluruh). SELESAI dikodekan; belum diverifikasi build/browser (lihat bagian 6). Dengan ini Phase 2 selesai dikodekan.
- **Phase 3:** menurut daftar terbaru pemilik proyek: Notes, Focus Timer, Statistics, Settings, Export/Import, PWA, optimasi. Di luar Phase 2. Notes/Focus tetap placeholder sampai ada spesifikasi.

Catatan: Notes dan Focus tetap placeholder sampai ada instruksi. Jangan mulai Phase 3 sebelum Batch 5 disetujui dan spesifikasinya dikirim. Prioritas pertama sebelum Phase 3: jalankan `npm install && npm run typecheck && npm run build` dan uji di browser (daftar "belum terverifikasi" di bagian 6), karena build penuh belum pernah dijalankan oleh saya.

Catatan (sudah dilaksanakan di Batch 5): Dashboard memakai `sortEvents`/`filterEvents` (`lib/events.ts`), `isTaskDone`/`getTaskDeadline`, `scheduleOnDate` (`lib/schedule.ts`) dan `entriesForDate` (`lib/calendar.ts`) untuk "agenda hari ini" dan "mendatang", tanpa menulis ulang aturan. Jangan membuat penyimpanan baru untuk dashboard.

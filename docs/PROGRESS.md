# CampusBest — Progres Pengembangan

Terakhir diperbarui: setelah Phase 3 Batch 3 / Bulk Import 2 (versi 0.10.0). Phase 2 selesai dikodekan; Phase 3 baru Notes dan Focus Timer yang dikodekan.

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
    notes/        notes-view, note-card, note-form-modal
    dashboard/    dashboard-view, quick-actions, today-schedule-card, upcoming-tasks-card, upcoming-events-card, task-progress-card, section-header
    layout/       app-shell, sidebar, header, logo, theme-toggle, page-header, mobile-bottom-navigation
    shared/       placeholder-page
  providers/      theme, toast, app-providers
  hooks/          use-storage, use-now, use-open-from-query
  lib/            brand, storage-keys, storage, normalize, domain, date, id, navigation, tokens, theme-script, utils, tasks, subjects, schedule, calendar, events, dashboard, quick-actions, notes
  types/          models.ts, index.ts (StorageSchema)
scripts/          batch2..batch6-logic-check.ts, run-logic-checks.sh (uji logika murni, jalankan dengan `npx tsx`)
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
- Dashboard terhubung ke Tasks, Subjects, Schedule, dan Exams & Events (Batch 5), plus aksi cepat "Tambah catatan" (Phase 3 Batch 1).
- Notes (`/notes`): lihat bagian 3f.
- Focus Timer (`/focus`): lihat bagian 3g (Pomodoro, tetap jalan lintas halaman dan setelah refresh, riwayat sesi, ringkasan di Dashboard). Hanya Statistics yang masih placeholder.

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

## 3f. Perubahan Phase 3 Batch 1 (Notes)
Baru:
- `lib/notes.ts`: `filterNotes` (judul, isi, nama/kode mata kuliah, plus filter mata kuliah), `sortNotes`, `notePreview`, `noteTimeLabel`, `noteSubject`, form <-> record (`createNote`, `applyNoteEdit`, `validateNoteForm`, `noteToFormValues`), `togglePinned`, `isPinned`.
- `components/notes/{notes-view,note-card,note-form-modal}.tsx`.
- `scripts/batch6-logic-check.ts` (109 pemeriksaan).
Diubah: `app/notes/page.tsx` (tetap server component + metadata; bukan placeholder lagi), `lib/quick-actions.ts` (+aksi `note` -> `/notes?tambah=1`, sekarang 5 aksi: tugas, jadwal, event, catatan, kalender), `components/dashboard/quick-actions.tsx` (+ikon `NotebookPen`, grid 2 kolom di mobile / 3 di `sm` / 5 di `lg`; item terakhir melebar di mobile supaya tidak sendirian), `scripts/batch5-logic-check.ts` (asersi aksi cepat jadi 5 aksi, dan placeholder tersisa hanya `/focus` dan `/statistics`), `scripts/run-logic-checks.sh` (+batch6), `package.json` (0.7.0), `README.md`, dokumen ini dan HANDOFF.md.
Tidak diubah: model `Note` (field `title`, `content`, `subjectId`, `pinned` sudah cukup), `lib/normalize.ts`, API storage (tidak ada method baru), key storage, `schemaVersion`, komponen UI bersama, dependency, kartu/statistik Dashboard.

Fitur: daftar kartu (2 kolom di layar >= md), tambah/edit/hapus (hapus dengan konfirmasi), judul (wajib), isi teks biasa (opsional), mata kuliah (opsional), sematkan/lepas sematan dari kartu, pencarian (judul, isi, nama/kode mata kuliah), filter mata kuliah (Semua, Tanpa mata kuliah, atau satu mata kuliah), urut (Terakhir diubah, Terbaru dibuat, Judul A-Z), empty state (belum ada catatan, dan tidak ada hasil filter), skeleton, penanda "Diubah hari ini/kemarin/tanggal". Klik judul atau isi kartu membuka form edit. Ctrl/Cmd + Enter menyimpan dari form.

Keputusan desain:
- Tidak ada batas panjang catatan (sesuai keputusan pemilik). Kartu hanya menampilkan pratinjau (maks. ~280 karakter, 5 baris), jadi catatan besar tidak memberatkan daftar. Isi catatan disimpan apa adanya kecuali spasi/baris kosong di ujung akhir dibuang dan `\r\n` jadi `\n`.
- Pengurutan: yang disematkan SELALU di atas, apa pun urutan yang dipilih; di dalam tiap kelompok mengikuti pilihan. Seri jatuh ke cap waktu lain, judul, lalu id, jadi urutan tidak berubah-ubah.
- Menyematkan atau melepas sematan dianggap edit, jadi `updatedAt` naik (aturan proyek). Akibatnya catatan yang baru dilepas sematannya naik ke atas kelompok tak-tersemat pada urutan "Terakhir diubah".
- Catatan yang `subjectId`-nya menunjuk mata kuliah yang sudah dihapus tampil tanpa label, cocok dengan filter "Tanpa mata kuliah", dan di form dianggap "Tanpa mata kuliah" (id lama baru hilang kalau catatannya disimpan ulang). Filter yang menunjuk mata kuliah yang baru dihapus otomatis dianggap "Semua".
- Kegagalan simpan: tambah, edit, sematan, dan hapus memeriksa `getStorageAdapter().isAvailable()` dulu, karena LocalStorage yang diblokir membuat storage layer melewati penulisan TANPA error (perilaku lama, dicatat di bagian 6 dan dikunci oleh tes). Kuota penuh melempar error dari penulisan itu sendiri. Dalam kedua kasus: toast error, form TETAP terbuka berisi tulisan terakhir, dan muncul pesan di dalam form. Bila dialog sempat tertutup tanpa sengaja (Esc/klik di luar) setelah gagal, membuka catatan yang sama (atau "Tambah catatan") mengembalikan tulisan itu (hanya di memori halaman; hilang kalau halaman di-reload). "Batal" dan simpan sukses membuang draf itu.
- Tidak ada Markdown, tag, arsip, atau editor rich text. Kartu catatan/statistik di Dashboard tidak ditambahkan; hanya aksi cepat.

## 3g. Perubahan Phase 3 Batch 2 (Focus Timer)
Keputusan pemilik: fokus 25 mnt, istirahat pendek 5, istirahat panjang 15 setiap 4 sesi fokus selesai; preset 25/5 dan 50/10 plus kustom (tersimpan); hanya sesi Focus yang dicatat; timer jalan terus lintas halaman dan pulih setelah refresh; tanpa audio/Notification API; ringkasan fokus hari ini di Dashboard.

Baru:
- `lib/focus.ts`: aturan murni (tanpa jam, tanpa storage; `nowMs` selalu dikirim masuk). Konstanta (`LONG_BREAK_EVERY=4`, `MIN_RECORD_MINUTES=1`, batas durasi), preset (`FOCUS_PRESETS`, `presetOf`), `normalizeFocusSettings`, `normalizeTimerState`, `validateFocusSettings`, waktu (`remainingMs`, `elapsedMs`, `progressOf`, `isExpired`, `formatClock`, `formatMinutes`), transisi (`beginPhase`, `pausePhase`, `resumePhase`, `endPhase` untuk completed/reset/skip), `appendSession`, `sameRun`, `selectableTasks`, `sanitizeLink`, `focusToday`, `sortSessions`, `sessionWhen`.
- `lib/focus-store.ts`: persistensi tanpa React (`startTimer`, `pauseTimer`, `resumeTimer`, `endTimer`, `setTimerLink`, `saveFocusSettings`, `readTimer`, `ensureWritable`, `StorageUnavailableError`). Satu-satunya tempat yang menulis `focusTimer`.
- `providers/focus-timer-provider.tsx` (dipasang di `AppProviders`, di dalam `ToastProvider`, di atas semua halaman), `hooks/use-focus-clock.ts` (hanya memicu render ulang 2x/detik saat timer berjalan).
- `components/focus/{focus-view,timer-ring,focus-settings-card,focus-history}.tsx`, `components/layout/focus-mini-timer.tsx` (pil kecil di header ke `/focus` saat timer berjalan/dijeda di halaman lain), `components/dashboard/focus-today-card.tsx`.
- `scripts/batch7-logic-check.ts` (183 pemeriksaan).
Diubah: `types/models.ts` (aditif: `FocusSession.endedAt?`, `AppSettings.focus?`, `AppSettings.focusTimer?`, tipe `FocusMode/FocusTimerStatus/FocusSettings/FocusTimerState`), `lib/normalize.ts` (`endedAt` pada sesi; `normalizeSettings` menormalkan `focus` dan `focusTimer`, kunci dihilangkan bila tidak ada/rusak), `lib/dashboard.ts` (+`focusSessions?` opsional di input, +`focus` di model), `components/dashboard/dashboard-view.tsx` (+kartu Fokus hari ini di kolom kanan), `components/layout/header.tsx`, `providers/app-providers.tsx`, `app/focus/page.tsx` (server component + metadata, bukan placeholder), `app/settings/page.tsx` (teks "Hapus semua data" menyebut sesi fokus), `scripts/batch5-logic-check.ts` dan `batch6-logic-check.ts` (hanya asersi placeholder: sekarang tersisa `/statistics`), `scripts/run-logic-checks.sh` (+batch7), `package.json` (0.8.0), `README.md`, dokumen ini dan HANDOFF.md.
Tidak diubah: API storage, key storage (tetap 7), `schemaVersion` (tetap 2), komponen UI bersama, dependency, model `Task/Subject/Note/...`.

Penyimpanan (tanpa sistem baru):
- Durasi: `campusbest_settings` -> `focus` `{focusMinutes, shortBreakMinutes, longBreakMinutes}`. Tidak ada = bawaan 25/5/15.
- Timer aktif: `campusbest_settings` -> `focusTimer` `{mode, status idle|running|paused, cycle 0-3, subjectId?, taskId?, runId?, startedAt?, durationMs?, endsAt?, remainingMs?}`. Saat berjalan, waktu = `endsAt` (epoch ms); saat jeda = `remainingMs`. Ditulis HANYA saat transisi (mulai, jeda, lanjut, reset, lewati, selesai, ganti pilihan mata kuliah/tugas saat idle, ganti durasi), tidak pernah per detik. Penulisan lewat `storage.update("settings", s => ({...s, ...}))` sehingga theme/sidebar/weekStartsOn dan field tak dikenal ikut terbawa (pola yang sama dengan ThemeProvider).
- Riwayat: `campusbest_focus_sessions`. `id` sesi = `runId` timer, jadi pencatatan idempoten.
- Urutan saat fase berakhir: sesi ditulis dulu (idempoten), baru timer dipindah, dengan pengaman `sameRun` supaya tab lain yang sudah memindahkan tidak ditimpa. Bila gagal di tengah, timer tetap "berjalan dan sudah lewat waktu"; percobaan berikutnya menyelesaikan tanpa sesi ganda.

Aturan pencatatan:
- Hanya fase Focus yang dicatat; istirahat tidak pernah.
- Timer habis normal: `completed: true`, `durationMinutes` = durasi fase, `endedAt` = waktu akhir yang direncanakan (bukan "sekarang", jadi benar walau halaman baru dibuka lama setelahnya).
- Reset atau Lewati saat Focus: dicatat `completed: false` hanya bila sudah berjalan >= 1 menit (menit dibulatkan ke bawah; waktu saat dijeda tidak dihitung); kurang dari itu tidak dicatat. Reset/Lewati TIDAK PERNAH menjadi completed. (Tafsiran saya atas "dihentikan lebih awal" + "reset/skip tidak boleh dianggap selesai": keduanya sama-sama dicatat sebagai tidak selesai bila >= 1 menit.) Dialog konfirmasi muncul bila sesi itu akan dicatat.
- Bila Reset ditekan setelah waktu sebenarnya sudah habis, sesi dicatat sebagai selesai (waktunya memang habis).
- Siklus: sesi Focus ke-4 yang selesai memberi istirahat panjang dan `cycle` kembali 0; Lewati tidak menambah `cycle`. Fase berikutnya TIDAK mulai otomatis (menunggu Mulai).

Perilaku halaman: cincin progres + angka besar (`role="timer"`), penanda fase, titik siklus, tombol Mulai/Jeda/Lanjut/Reset/Lewati, pilihan mata kuliah dan tugas (opsional, terkunci saat sesi berjalan; tugas selesai tidak ditawarkan; memilih tugas mengisi mata kuliahnya bila kosong), ringkasan Hari ini (waktu fokus, sesi selesai), pengaturan durasi (preset 25/5, 50/10, atau Kustom dengan validasi 1-180 / 1-60 / 1-120 menit), riwayat 20 sesi terbaru (Selesai/Dihentikan; mata kuliah atau tugas yang sudah dihapus tampil tanpa label, sesinya tetap). Durasi baru berlaku mulai fase berikutnya; fase yang sedang berjalan tidak berubah.
Dashboard: kartu "Fokus hari ini" (total menit fokus dan jumlah sesi selesai pada tanggal lokal hari ini; sesi dihitung ke hari ia dimulai; menit sesi yang dihentikan ikut dihitung karena itu waktu fokus yang sungguh dijalani).

## 3h. Perubahan Phase 3 Batch 3 / Bulk Import 1 (Google Classroom + BRONE, versi 0.9.0)
Baru:
- `lib/import/`: `types.ts`, `text.ts` (pemecah baris, `readLink`, `safeUrl`, `nameKey`, `readTime`), `classroom.ts`, `brone.ts` (parser), `sources.ts` (daftar sumber `IMPORT_SOURCES`, `detectSource`, `runParser`), `subjects.ts` (pencocokan mata kuliah), `duplicates.ts`, `preview.ts` (item preview, validasi, `evaluate`, `itemToTask`), `commit.ts` (satu-satunya yang menulis).
- `app/import/page.tsx` (server component + metadata), `components/import/{import-view,import-item-card}.tsx`, item navigasi "Import" (`lib/navigation.ts`).
- `scripts/batch8-logic-check.ts` (+ didaftarkan di `run-logic-checks.sh`).
Diubah: `types/models.ts` (aditif: `Task.url?`, `Task.importSource?`), `lib/normalize.ts` (membaca dua field itu), `components/tasks/task-item.tsx` (link "Buka tautan" bila ada URL http/https), `package.json` (0.9.0).
Tidak diubah: API storage, key storage (tetap 7), `schemaVersion`, dependency, form Task manual.

Perilaku (sesuai spesifikasi pemilik):
- Classroom: judul (boleh Markdown link/bernomor), URL, nama mata kuliah, status sumber. Tidak ada deadline yang dikarang. "Turned in" hanya ditampilkan, tidak mengubah status Task.
- BRONE: tanggal berlaku sampai tanggal berikutnya, `00:00` valid, baris `Activity event` diabaikan, nama mata kuliah dari "Assignment is due · ...", dua tugas dengan tanggal+jam sama tetap terpisah, URL hanya bila ada di teks, tanpa konversi zona waktu (waktu apa adanya, Asia/Jakarta).
- Preview: pilih semua/sebagian, edit judul/mata kuliah/tanggal/jam/URL/status, hapus item, daftar baris gagal beserta alasan, deteksi duplikat (lewati atau tetap impor), pencocokan ke Subjects yang ada, atau hubungkan ke mata kuliah lain, atau buat baru (tanpa duplikat otomatis).
- Commit: mata kuliah baru dulu, lalu semua Task dalam satu tulis. Tidak pernah mengubah/menghapus record lama. Cek `isAvailable()` sebelum menulis.
- Arsitektur modular: sumber baru = satu `ImportSourceDef` (`key`, `target`, `parse`). SIAM Format 1 dan 2 (target Schedule) BELUM diimplementasikan (Bulk Import 2).

Perbaikan saat serah terima sesi: `splitLines` meratakan tab menjadi spasi sehingga baris "3<TAB>Judul" tidak dikenali sebagai bernomor; sekarang tab dipertahankan.

## 3i. Perubahan Phase 3 Batch 3 / Bulk Import 2 (SIAM Format 1 dan 2 -> Schedule, versi 0.10.0)
Catatan serah terima: pekerjaan SIAM dari sesi sebelumnya TIDAK ada di ZIP Bulk Import 1 (tidak ada satu pun file SIAM). Bulk Import 2 ditulis dari baseline ZIP berdasarkan spesifikasi pemilik.

Baru:
- `lib/import/siam.ts`: parser SIAM (`parseSiam`, `readWeekday`, `readTimeRange`, `looksLikeSiam`, `siamSource`). Menerima tabel Markdown (pipa) atau teks dipisah tab. Format dideteksi dari BARIS HEADER (Format 1 bila ada kolom "Mata Kuliah", Format 2 bila "MK"); kolom dicari lewat nama header, bukan posisi; kolom Action diabaikan.
- `lib/import/schedule-preview.ts`: item preview jadwal, pencocokan mata kuliah, validasi, deteksi duplikat, `evaluateSchedule`, `summarizeSchedule`, `itemToSchedule` (memakai `createSchedule()` yang sama dengan form Schedule), `groupScheduleSubjects`.
- `lib/import/commit.ts`: ditambah `commitScheduleImport()` (tetap satu-satunya file yang menulis): mata kuliah baru dulu, lalu semua jadwal dalam satu tulis.
- `lib/import/sources.ts`: ditambah `SCHEDULE_SOURCES` dan `runScheduleParser` (pengaman sama seperti `runParser`, batas `MAX_SCHEDULE_ITEMS` = 300). `IMPORT_SOURCES` (tugas) tidak berubah.
- `lib/import/types.ts`: `ScheduleDraft`, `ScheduleParseResult`, `ScheduleImportSourceDef`, `SiamFormat`; `ImportTarget` kini `"tasks" | "schedules"`.
- UI: `components/import/schedule-import-view.tsx`, `schedule-import-item-card.tsx`. `import-view.tsx` kini punya dua tab (Tugas, Jadwal kuliah (SIAM)); kedua tab tetap ter-mount supaya isi tab lain tidak hilang. `/import?sumber=siam` membuka tab jadwal. Halaman Schedule punya tombol "Import SIAM".
- `scripts/batch9-logic-check.ts` (didaftarkan di `run-logic-checks.sh`).
Diubah: `import-item-card.tsx` (`SubjectOptions` dapat prop `allowNone`, bawaan true), `scripts/batch8-logic-check.ts` (guard daftar modul, guard "SIAM belum ada" diganti "jalur tugas tidak tahu soal SIAM", versi boleh 0.9.0/0.10.0, daftar UI dan modul murni ditambah), `package.json` (0.10.0).
Tidak diubah: model `ScheduleItem`, `normalize.ts`, API storage, key storage (tetap 7), dependency, parser Classroom/BRONE, `lib/schedule|calendar|dashboard|tasks|events`.

Perilaku:
- Setiap baris jadi satu jadwal `recurrence: "weekly"` tanpa `date`. `dayOfWeek` dari nama hari (Minggu = 0). Jam dipakai persis seperti di teks (WIB), tanpa objek Date atau konversi zona waktu. Format jam yang dikenali: `07.00 - 08.40`, `07:00-08:40`, `7.00 s/d 8.40 WIB`.
- Tidak ada data dikarang: tanda "-" berarti kosong; Format 2 tidak punya dosen/kelas (dibiarkan kosong); kode mata kuliah hanya diambil bila tertulis di sel (`TIF1234 - Nama` atau `Nama (TIF1234)`); mode default offline, jadi Online hanya bila ruang berisi online/daring/zoom/meet/teams (dengan peringatan, bisa diubah).
- Kelas dan Dosen: `ScheduleItem` tidak punya field kelas/dosen. Kelas hanya ditampilkan di preview. Dosen dipakai HANYA sebagai dosen mata kuliah yang dibuat baru; mata kuliah yang sudah ada tidak pernah diubah.
- Mata kuliah: cocok persis (nama, kode, atau "kode nama") otomatis terhubung; mirip/ambigu harus dipilih pengguna; tidak cocok = "buat baru" (dibuat saat impor, satu per nama). Jadwal wajib punya mata kuliah, jadi tidak ada opsi "tanpa mata kuliah".
- Duplikat: mata kuliah sama + hari sama + jam mulai dan selesai sama (ruang tidak dihitung). Dibandingkan dengan jadwal mingguan yang sudah ada (jadwal sekali-saja dan dua-mingguan tidak dianggap sama) dan dengan item lain di batch. Pilihan Lewati (bawaan) atau Tetap impor.
- Baris yang gagal (hari tak dikenal, jam tak terbaca/terbalik, nama kosong) dilaporkan dengan nomor baris dan tidak diimpor; baris lain tetap jalan. Sel Hari kosong TIDAK diisi dari baris sebelumnya (tidak menebak sel yang digabung).
- Jadwal lama tidak pernah diubah (diuji byte-per-byte, termasuk field tak dikenal). Jadwal baru otomatis tampil di Schedule, Kalender, dan Dashboard lewat `occursOn()`/`scheduleOnDate()` tanpa perubahan pada ketiganya.

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
- Phase 3 Batch 1 / Notes (lingkungan yang sama, tanpa jaringan, tanpa `node_modules`; `tsx` dan `tsc` global tersedia): `scripts/batch6-logic-check.ts`: 109 pemeriksaan lolos di TZ Asia/Jakarta, America/New_York, Europe/London, Pacific/Auckland, America/Sao_Paulo. Regresi di kelima zona itu: batch2 83, batch3 132, batch4 108, batch5 69 (asersi aksi cepat dan placeholder sengaja diperbarui), semua lolos (`bash scripts/run-logic-checks.sh`). Cakupan Notes: form <-> record (validasi, trim, `\r\n`, subject kosong, `updatedAt`, field tak dikenal dan `pinned` terjaga, input tidak dimutasi), sematkan/lepas, filter (judul, isi, nama/kode mata kuliah, tanpa huruf besar-kecil, filter mata kuliah, mata kuliah terhapus = "Tanpa mata kuliah", gabungan), urutan (tersemat dulu pada ketiga urutan, seri stabil, cap waktu rusak), pratinjau dan label waktu (hari lokal, bukan UTC), data lama (id numerik, tanpa judul, `content` bukan string, migrasi `campusmate_notes`), CRUD lewat `storage` (tambah, edit, sematan, hapus, baca ulang, 20 tulis paralel, 10 sematan paralel, entri non-objek tidak hilang), hapus mata kuliah tidak mengubah `campusbest_notes` sedikit pun, kegagalan penulisan (kuota penuh: error dilempar, isi storage tidak berubah, antrean tidak macet, coba lagi berhasil; LocalStorage diblokir: dicatat sebagai perilaku storage layer), catatan 400 KB, aksi cepat dan navigasi, serta pemeriksaan statis (halaman server component + metadata, `useOpenFromQuery`, tidak ada `localStorage` di kode Notes, tidak ada kartu Notes di Dashboard, tanpa dependency baru). Dua mutasi sengaja (tersemat tidak diutamakan; edit tidak menaikkan `updatedAt`) membuat 3 dan 3 pemeriksaan gagal, lalu kode dikembalikan dan semua lolos.
- Phase 3 Batch 2 / Focus Timer (lingkungan yang sama, tanpa jaringan, tanpa `node_modules`; `tsx` dan `tsc` global tersedia): `scripts/batch7-logic-check.ts`: 183 pemeriksaan lolos di TZ Asia/Jakarta, America/New_York, Europe/London, Pacific/Auckland, America/Sao_Paulo. Regresi di kelima zona itu: batch2 83, batch3 132, batch4 108, batch5 69, batch6 109, semua lolos (hanya asersi placeholder di batch5/batch6 yang diperbarui). Cakupan: preset/format/validasi durasi, normalisasi timer tersimpan (rusak -> idle, tidak pernah melempar), matematika waktu berbasis timestamp (jeda tidak dihitung, jam mundur, lonjakan waktu seperti tab di background), semua jalur akhir fase (selesai, selesai setelah halaman lama tertutup, siklus 4 sesi sampai istirahat panjang, reset/lewati di batas 59,999 dan 60 detik, istirahat tidak dicatat), persistensi lewat storage sungguhan dengan localStorage tiruan (durasi dan timer terbaca ulang dari JSON mentah, ganti tema tidak merusak timer, hanya perubahan nyata yang menulis, dua penyelesaian bersamaan = satu sesi, kuota penuh saat menyimpan sesi atau timer lalu coba lagi tanpa sesi ganda, storage diblokir -> semua aksi melempar `StorageUnavailableError` dan tidak menulis apa pun), kompatibilitas sesi lama (tanpa `endedAt`, durasi berupa teks, tanpa `startedAt`, entri non-objek tidak hilang, migrasi `campusmate_focus_sessions`, 20 tulis paralel), ringkasan hari ini (hari lokal bukan UTC, lintas tengah malam, data rusak), urutan riwayat, pilihan tugas/mata kuliah, hapus mata kuliah/tugas tidak mengubah `campusbest_focus_sessions` sedikit pun, Dashboard (nol tanpa data, tidak menulis), dan pemeriksaan statis (provider di atas semua halaman, FocusView tanpa timer/interval/penulisan storage sendiri, hanya `focus-store.ts` yang menulis `focusTimer`, tanpa audio/Notification, tanpa kunci tanggal UTC, tanpa key storage atau dependency baru, versi 0.8.0). Tujuh mutasi sengaja (simpan sesi < 1 menit, hari berbasis UTC, reset dianggap selesai, `endedAt` = sekarang, lanjut mengabaikan sisa waktu, sesi ganda tidak dicegah, pengaman `sameRun` dihapus) membuat 3, 3, 10, 2, 3, 4, dan 1 pemeriksaan gagal, lalu kode dikembalikan dan semua lolos.
- Typecheck Batch 7: `tsc` strict atas `lib/*`, `types/*`, keenam skrip uji, dan seluruh TSX dengan shim tipe (React/Next/Lucide/Framer/Radix tidak terpasang). Sisa keluhan hanya berasal dari shim atau modul pihak ketiga yang tidak ada (`clsx`, `tailwind-merge`, `lucide-react`, tipe `LucideIcon`/`ClassValue`, props `Card` yang jadi `any`, parameter event), bukan dari kode Focus. Ini BUKAN pengganti `npm run typecheck` sungguhan.
- Typecheck Batch 6: `tsc` strict atas `lib/*`, `types/*`, kelima skrip uji, dan file TSX baru, dengan shim tipe untuk React/Next/Lucide/Framer/Radix (tidak terpasang di sini). Satu-satunya keluhan berasal dari shim atau modul pihak ketiga yang tidak ada (mis. `clsx`, daftar ikon, parameter yang jadi `any`), bukan dari kode Notes. Ini BUKAN pengganti `npm run typecheck` sungguhan.

BELUM terverifikasi:
- Focus Timer (Phase 3 Batch 2): TIDAK ada pengujian di browser sama sekali. Provider, effect (`setTimeout` ke waktu selesai, `visibilitychange`, `pageshow`), hook jam, tampilan (cincin SVG, grid 2 kolom `lg:`, pil mini timer di header, ConfirmationDialog), dan perilaku nyata saat tab di background atau di-refresh hanya diverifikasi lewat logika murni dan simulasi storage, bukan di React/browser. Nama ikon Lucide baru `Play`, `Pause`, `RotateCcw`, `SkipForward`, `History` belum dicek terhadap lucide-react 0.460 (`Timer` sudah dipakai di navigasi). Throttling timer browser di tab background belum diamati; desainnya sengaja tidak bergantung padanya (waktu selalu dihitung dari timestamp), tapi sesi baru ditutup saat tab aktif lagi atau timeout berjalan.
- Notes (Phase 3 Batch 1): nama ikon Lucide baru `Pin` dan `PinOff` belum dicek terhadap lucide-react 0.460 yang terpasang (lainnya sudah dipakai sebelumnya). Belum pernah dilihat di browser: kartu 2 kolom, textarea `min-h-56` di modal yang bisa di-scroll, baris filter dan urut, grid 5 aksi cepat (`lg:grid-cols-5`, `last:odd:col-span-2`), Ctrl/Cmd+Enter, pemulihan draf setelah gagal simpan, toast. Gagal simpan hanya disimulasikan di tes logika (adapter tiruan), bukan di browser sungguhan.
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
- Notes: tidak ada batas panjang catatan; LocalStorage browser terbatas (kira-kira 5 MB untuk seluruh data), jadi catatan yang sangat banyak/panjang akhirnya memicu error simpan (ditangani, tapi datanya tidak bisa dipindah ke tempat lain sampai Export/Import ada).
- Notes: draf yang gagal tersimpan hanya hidup di memori halaman (hilang saat reload).
- Notes: tidak ada tampilan baca penuh terpisah; catatan dibaca penuh lewat form edit. Pencarian tidak menyorot kata yang cocok.
- Notes: field `pinned` yang bukan boolean (data tak biasa) dibaca sebagai "tidak disematkan"; nilai aslinya hilang bila catatan itu diedit (sama seperti batasan field non-enum lain).
- Storage layer (sudah ada sejak Batch 1, ditemukan lagi di Notes): kalau LocalStorage diblokir, `setRaw` melewati penulisan tanpa error. Fitur lain (Tasks, Subjects, Schedule, Events) belum memeriksa `isAvailable()` dan tetap menampilkan toast sukses dalam kondisi itu; hanya Notes yang sudah menanganinya.
- Storage layer: menulis koleksi menyimpan seluruh daftar dalam bentuk ternormalisasi, jadi catatan lain dalam koleksi yang sama (mis. tanpa judul) ikut tersimpan dengan nilai bawaannya saat salah satu catatan diedit. Field tak dikenal tetap dipertahankan.
- Focus: timer disimpan di LocalStorage, jadi butuh penyimpanan browser yang bisa ditulis. Bila diblokir (mode privat), Mulai gagal dengan toast error; tidak ada timer cadangan di memori.
- Focus: timer yang berjalan dianggap tetap berjalan selama halaman tertutup. Bila halaman dibuka lagi setelah waktunya lewat (mis. berjam-jam), sesi dicatat selesai dengan `endedAt` = waktu akhir yang direncanakan, walau pengguna mungkin tidak benar-benar fokus.
- Focus: dua tab terbuka sama-sama bisa menyelesaikan fase yang sama; sesi tidak ganda (id = `runId`) dan timer pindah sekali, tapi toast "selesai" bisa muncul di kedua tab. Menekan Reset/Lewati di dua tab hampir bersamaan: yang kalah balapan tidak mengubah apa pun. Antrean `update` tetap hanya melindungi satu tab.
- Focus: nilai `focus`/`focusTimer` di settings yang tidak valid dibuang saat settings disimpan lagi (bukan dipertahankan); field settings lain dan field tak dikenal tetap utuh. Field tak dikenal DI DALAM objek `focusTimer` tidak dipertahankan.
- Focus: tidak ada mulai otomatis fase berikutnya, tidak ada suara/notifikasi, tidak ada hapus/edit sesi di riwayat, dan riwayat hanya menampilkan 20 sesi terbaru (statistik lengkap menunggu batch Statistics).
- Focus: pilihan mata kuliah/tugas dikunci selama fase berjalan dan disimpan di `focusTimer` (satu penulisan ke settings tiap pilihan diubah saat idle).
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
- **Phase 3:** menurut daftar terbaru pemilik proyek: Notes, Focus Timer, Statistics, Settings, Export/Import, PWA, optimasi. Di luar Phase 2.
  - **Phase 3 Batch 1: Notes** (halaman `/notes` + aksi cepat "Tambah catatan"). SELESAI dikodekan; belum diverifikasi build/browser (lihat bagian 6).
  - **Phase 3 Batch 2: Focus Timer** (halaman `/focus`, provider timer lintas halaman, ringkasan di Dashboard). SELESAI dikodekan; belum diverifikasi build/browser (lihat bagian 6).
  - Berikutnya (tunggu spesifikasi): Statistics, Settings, Export/Import, PWA, optimasi. Statistics tetap placeholder.

Catatan: Statistics tetap placeholder sampai ada instruksi. Jangan mulai batch Phase 3 berikutnya sebelum Phase 3 Batch 2 disetujui dan spesifikasinya dikirim. Prioritas pertama sebelum Phase 3: jalankan `npm install && npm run typecheck && npm run build` dan uji di browser (daftar "belum terverifikasi" di bagian 6), karena build penuh belum pernah dijalankan oleh saya.

Catatan (sudah dilaksanakan di Batch 5): Dashboard memakai `sortEvents`/`filterEvents` (`lib/events.ts`), `isTaskDone`/`getTaskDeadline`, `scheduleOnDate` (`lib/schedule.ts`) dan `entriesForDate` (`lib/calendar.ts`) untuk "agenda hari ini" dan "mendatang", tanpa menulis ulang aturan. Jangan membuat penyimpanan baru untuk dashboard.

## 9. Status Bulk Import 1
Terverifikasi: `scripts/batch2..batch8` lolos di 5 zona waktu (batch8: 170 pemeriksaan, Asia/Jakarta); `tsc` strict atas `lib/import/*`, `lib/dashboard.ts` dan turunannya lolos.
BELUM terverifikasi: `npm install`/`npm run typecheck`/`npm run build` (jaringan tidak tersedia di sesi ini, npm install gagal), dan seluruh UI `/import` di browser. Ikon Lucide baru (`ClipboardPaste`, `ExternalLink`, dll.) belum dicek terhadap lucide-react 0.460. Bulk Import 2 (SIAM) belum dimulai; tunggu instruksi.

## 10. Status Bulk Import 2
Terverifikasi (sesi tanpa jaringan, tanpa `node_modules`): `bash scripts/run-logic-checks.sh` lolos di 5 zona waktu untuk batch2 (83), batch3 (132), batch4 (108), batch5 (69), batch6 (109), batch7 (183), batch8 (170), batch9 (119). `tsc` strict atas `src/lib/**` dan `src/types/**` bersih; satu-satunya error adalah modul pihak ketiga yang tidak terpasang (`lucide-react`, `clsx`, `tailwind-merge`) di `navigation.ts` dan `utils.ts`, yang sudah ada sebelumnya.
BELUM terverifikasi: `npm install`, `npm run typecheck`, `npm run build` (jaringan tidak tersedia, jadi file TSX baru tidak dicek tipenya), seluruh UI tab "Jadwal kuliah (SIAM)" di browser, dan parser terhadap salinan SIAM asli. Format SIAM dibuat dari spesifikasi kolom dan contoh yang dikirim pemilik; asumsi paling berisiko: (1) tampilan hasil salin dari halaman SIAM sungguhan (pipa atau tab), (2) bentuk sel Mata Kuliah (ada kode atau tidak), (3) sel Hari yang digabung/kosong. Kirim contoh nyata (data pribadi boleh disamarkan) bila ada baris yang gagal terbaca.
Phase 3 Batch 4 BELUM dimulai; tunggu instruksi pemilik.

## 11. Status Phase 3 Batch 4 (PWA + Optimization, 0.11.0)
Dikerjakan: manifest (nama/short_name CampusBest, standalone, start_url `/dashboard`, scope `/`, warna #0B1020, ikon any + maskable, 3 shortcut), service worker, halaman offline, registrasi SW (produksi + HTTPS saja), alur pembaruan aman (menunggu persetujuan pengguna), panduan instalasi (prompt Chromium, langkah manual iOS, petunjuk manual untuk browser lain), banner offline dan banner "Versi baru tersedia", kartu "Pasang aplikasi" di Settings.
Strategi cache: navigasi = jaringan dulu (batas 4 dtk) lalu cache halaman yang pernah dibuka, lalu `/offline.html`; `/_next/static/*` = cache-first (nama berhash); ikon/manifest/offline = cache lalu segarkan; permintaan RSC (`?_rsc`), non-GET, dan lintas-origin tidak disentuh. Install mencoba menghangatkan 10 halaman utama (best effort). Batas cache: 40 halaman, 250 aset.
Data: tidak ada perubahan pada key, StorageAdapter, normalisasi, atau `clearAll`. SW tidak punya akses LocalStorage; uji memastikan isi LocalStorage identik sebelum/sesudah siklus install, activate, update.
Terverifikasi (tanpa jaringan): `bash scripts/run-logic-checks.sh` lolos di 5 zona waktu untuk batch2-batch10 (batch10: 96 pemeriksaan, menjalankan `public/sw.js` di sandbox Node `vm` dengan Cache Storage tiruan). `tsc` penuh tidak bisa dijalankan karena `node_modules` tidak ada.
BELUM dapat dilakukan/diverifikasi: `npm install`, `npm run typecheck`, `npm run build`; service worker di browser sungguhan; Lighthouse/installability; prompt instalasi Android/desktop; alur Add to Home Screen iOS; offline sungguhan setelah deploy; alur update dua versi; tampilan banner dan kartu baru (dark/light, mobile); ikon di perangkat nyata (gambar sementara).
Keterbatasan yang diketahui: (1) halaman yang belum pernah dibuka dan belum sempat dihangatkan saat install tidak tersedia offline, dan chunk JS halaman itu baru tersimpan setelah halaman dikunjungi online; (2) navigasi antarhalaman offline memakai RSC yang tidak di-cache, jadi Next akan memuat ulang penuh dari cache halaman (belum diuji di browser); (3) dua tab dengan versi berbeda: tombol Perbarui memuat ulang tab yang menekannya saja; (4) browser dapat menghapus data situs (mis. iOS Safari menghapus data situs yang lama tidak dibuka, atau saat pengguna membersihkan data); Export/Import (batch mendatang) adalah perlindungan sebenarnya; (5) `navigator.storage.persist()` belum dipakai, jadi penyimpanan tidak diminta jadi "persisten"; (6) tidak ada notifikasi push atau background sync; (7) bila deploy memakai subpath (basePath), path di manifest/sw.js perlu disesuaikan.
Optimasi: tanpa refactor; hanya caching aset berhash, font self-hosted `next/font` ikut ter-cache, SW tidak dimuat di dev. Tidak ada analisis ukuran bundle karena build belum bisa dijalankan.

### Perbaikan parser Import dari contoh asli pemilik (0.11.0)
Diuji dengan salinan asli Classroom dan SIAM dari pemilik. Dua ketidakcocokan ditemukan dan diperbaiki:
- SIAM: jam asli memakai detik ("07:00:00 - 08:40:00") dan nama mata kuliah memakai "(KODE) Nama". Sebelumnya semua baris ditolak. Sekarang `readTimeRange` menerima detik dan `splitSubject` memisah "(CIF65318) Jaringan Saraf Tiruan" menjadi kode + nama ("(MLOps)" tetap bagian nama).
- Classroom: salinan asli berupa blok baris link Markdown yang memakai satu URL yang sama per tugas ([assignment], judul, kelas, status, kadang tanggal). Sebelumnya tiap baris jadi satu tugas. Sekarang baris ber-URL sama digabung: label "assignment" dilewati, judul, kelas = mata kuliah, status ("Turned in"), dan tanggal "Monday, Nov 9" menjadi deadline.
- Tahun tanggal Classroom ditentukan dari nama hari (tahun terdekat dengan hari ini yang harinya cocok); tanpa nama hari tidak ada tanggal yang dikarang. Parser tetap murni: `today` dikirim dari UI (`runParser(source, text, todayKey())`), tanpa `new Date`.
- Nama kelas Classroom (mis. "Praktikum JST-F 2026") tidak sama dengan nama mata kuliah SIAM ("Jaringan Saraf Tiruan"), jadi pemetaan mata kuliah di preview impor tugas tetap perlu dipilih manual.
- Uji: bagian "real pasted samples" di `scripts/batch10-logic-check.ts` (113 pemeriksaan); semua uji batch2-batch10 lolos di 5 zona waktu.

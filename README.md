# CampusBest

Your Campus Bestie.

Your friendly companion for a more organized campus life.

```bash
npm install
npm run dev        # http://localhost:3000
npm run typecheck
npm run build
```

Stack: Next.js (App Router), TypeScript, Tailwind CSS, Radix Dialog (komponen bergaya shadcn/ui), Lucide, Framer Motion, LocalStorage.

## Struktur

`src/lib/` (storage, normalisasi, domain, tanggal, id, brand, tasks, subjects, schedule, calendar, events, notes, focus, focus-store, dashboard, quick-actions), `src/hooks/use-storage.ts`, `src/types/`, `src/components/{ui,layout,shared,tasks,subjects,schedule,calendar,events,notes,focus,dashboard}`, `scripts/` (uji logika murni), `src/providers/`.

Nama dan tagline aplikasi ada di satu tempat: `src/lib/brand.ts`.

## Uji logika

Uji perilaku untuk logika murni (tanpa browser, localStorage tiruan). Tidak butuh dependency di project, cukup `npx tsx`:

```bash
TZ=Asia/Jakarta npx tsx scripts/batch2-logic-check.ts
TZ=Asia/Jakarta npx tsx scripts/batch3-logic-check.ts
TZ=Asia/Jakarta npx tsx scripts/batch4-logic-check.ts
TZ=Asia/Jakarta npx tsx scripts/batch5-logic-check.ts
TZ=Asia/Jakarta npx tsx scripts/batch6-logic-check.ts   # coba juga TZ=America/New_York, TZ=Europe/London
```

Semua uji sekaligus, di lima zona waktu: `bash scripts/run-logic-checks.sh`.

## Penyimpanan

- Semua data di LocalStorage dengan prefix `campusbest_` (`subjects`, `tasks`, `schedules`, `events`, `notes`, `focus_sessions`, `settings`). Definisi key ada di `src/lib/storage-keys.ts`.
- Untuk mengganti backend penyimpanan, implementasikan `StorageAdapter` lalu panggil `setStorageAdapter()`.
- Data lama dari versi CampusMate (prefix `campusmate_`) disalin otomatis ke key baru satu kali. Penyalinan hanya terjadi kalau key baru belum ada, key lama tidak dihapus atau diubah, dan flag `campusbest_migration_v1` mencegah proses diulang.
- Setiap data dinormalisasi saat dibaca (`src/lib/normalize.ts`, schema versi 2): field baru punya nilai bawaan yang aman, field lama (`dueDate`, `type`, status `done`, `dayOfWeek`) tetap dipertahankan, dan field yang tidak dikenal tidak dibuang. Membaca tidak pernah menulis.
- Pakai `isTaskDone()` dan `getTaskDeadline()` dari `src/lib/domain.ts` untuk status dan tenggat tugas, jangan membandingkan langsung ke `"done"` atau `dueDate`.
- Tanggal disimpan sebagai `YYYY-MM-DD` dan jam sebagai `HH:mm` dalam waktu lokal. Gunakan helper di `src/lib/date.ts`, jangan `toISOString()` untuk kunci tanggal.
- `generateId()` dari `src/lib/id.ts` untuk ID baru.
- Mengedit record yang punya nilai enum tak dikenal: bawa ulang nilai aslinya lewat `storage.getCoercedRaw()` untuk field yang tidak disentuh pengguna (contoh: `fieldsToPreserve` di `src/lib/tasks.ts`).
- Jadwal kuliah (`schedules`): `recurrence` `weekly` mengikuti `dayOfWeek`; `none` (sekali) dan `biweekly` (dua minggu sekali) memakai field `date` (`YYYY-MM-DD`): tanggal pelaksanaan untuk `none`, tanggal sesi pertama (anchor) untuk `biweekly`. Aturan kemunculan hanya ada di `occursOn()` (`src/lib/schedule.ts`). Kalender (`src/lib/calendar.ts`) tidak punya penyimpanan sendiri, hanya membaca `schedules`, `tasks`, dan `events`.
- Exams & Events (`events`): `category` (uts, uas, quiz, presentasi, praktikum, seminar, lainnya) adalah sumber utama; `type` diturunkan darinya (`eventTypeFromCategory`). Event ditampilkan di Calendar langsung dari koleksi `events` (tanpa salinan), dengan label kategorinya.
- Dashboard (`/dashboard`): tidak punya penyimpanan. Semuanya dihitung dari `tasks`, `subjects`, `schedules`, dan `events` lewat `src/lib/dashboard.ts`, yang memakai aturan fitur masing-masing (`sortTasks`/`deadlineInfo`, `scheduleOnDate`, `filterEvents`/`sortEvents`). Tombol "Tambah ..." (tugas, jadwal, event, catatan) membuka form yang sudah ada di halaman tujuan lewat `?tambah=1` (`src/lib/quick-actions.ts`).
- Notes (`notes`): catatan teks biasa (tanpa Markdown/tag/arsip) dengan judul, isi, mata kuliah opsional, dan `pinned`. Logika di `src/lib/notes.ts` (filter, urut, form <-> record, `togglePinned`). Catatan yang disematkan selalu tampil di atas. Note tidak punya field enum, jadi tidak perlu pola `getCoercedRaw`; setiap edit dan sematan tetap menaikkan `updatedAt`. Hapus mata kuliah tidak menyentuh `notes`.
- Focus Timer (`/focus`): Pomodoro (bawaan 25/5/15 menit, istirahat panjang setiap 4 sesi fokus selesai; preset 25/5, 50/10, atau kustom). Aturannya murni di `src/lib/focus.ts` (waktu selalu dihitung dari timestamp), persistensinya di `src/lib/focus-store.ts`, dan state-nya dipegang `FocusTimerProvider` di `AppProviders`, jadi timer tetap jalan saat pindah halaman dan pulih setelah refresh. Tidak ada key storage baru: durasi di `settings.focus`, timer aktif di `settings.focusTimer` (ditulis hanya saat transisi, tidak per detik), riwayat di `focus_sessions` (id sesi = `runId`, idempoten). Hanya sesi Focus yang dicatat; Reset/Lewati setelah >= 1 menit dicatat sebagai tidak selesai. Edit `focusTimer` hanya lewat `focus-store.ts`.

## Bulk Import

`/import` punya dua tab:
- **Tugas**: tempel teks dari Google Classroom atau BRONE, lihat preview, edit, lalu impor sebagai Tasks. Uji: `TZ=Asia/Jakarta npx tsx scripts/batch8-logic-check.ts`.
- **Jadwal kuliah (SIAM)**: tempel tabel jadwal dari SIAM (Markdown atau hasil salin biasa). Format 1 (Hari, Jam, Mata Kuliah, Kelas, Dosen, Ruang, Action) dan Format 2 (Hari, MK, Jam, Ruang) dikenali otomatis dari judul kolom. Hasilnya masuk ke Schedule sebagai jadwal mingguan (tampil juga di Kalender dan Dashboard). Jadwal lama tidak diubah. Uji: `TZ=Asia/Jakarta npx tsx scripts/batch9-logic-check.ts`.

Logika di `src/lib/import/`. Semua uji sekaligus: `bash scripts/run-logic-checks.sh`.

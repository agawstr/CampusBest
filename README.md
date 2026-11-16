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
TZ=Asia/Jakarta npx tsx scripts/batch6-logic-check.ts   # (batch7..batch10 juga ada; coba juga TZ=America/New_York, TZ=Europe/London
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

## Calendar: agenda di samping kalender (0.12.1)

Hanya tampilan `/calendar` yang berubah; data dan LocalStorage tidak disentuh.
- Tanggal hari ini otomatis terpilih dan agenda tanggal terpilih langsung terlihat (di samping kalender mulai layar `lg`, di bawah kalender di HP dan tablet).
- Layar `lg` ke atas: sel tanggal menampilkan chip berwarna berisi judul (maksimal 2 di `lg`, 3 di `xl`), sisanya menjadi `+N lagi`. Urutannya sama dengan daftar di kartu agenda. Judul panjang dipotong dengan "...".
- HP dan tablet (di bawah `lg`): tetap titik indikator per jenis.
- Perlu diuji manual: `+12 lagi` (dua digit) di layar `lg` dengan sidebar terbuka; sel hanya sekitar 50 px dan sisa ruang label sekitar 10 px, jadi bisa terpotong. Lihat `docs/PROGRESS.md` bagian 13.
- Logika: `previewEntries()` di `src/lib/calendar.ts`. Uji: `TZ=Asia/Jakarta npx tsx scripts/batch12-logic-check.ts`.

## Statistics, Settings, Cadangan data (0.12.0)

- **Statistics** (`/statistics`): ringkasan tugas, per mata kuliah, ujian dan event, waktu fokus; periode 7 hari terakhir, 30 hari terakhir, atau semua waktu. Logika: `src/lib/statistics.ts`.
- **Settings** (`/settings`): tema, awal minggu, durasi Focus Timer, pasang aplikasi, info versi, cadangan data, hapus semua data. Logika: `src/lib/settings.ts`.
- **Cadangan data**: Ekspor semua data ke satu file JSON, atau Impor dari file dengan pilihan Gabung (per `id`, `updatedAt` lebih baru dipakai) atau Ganti semuanya (backup data saat ini diunduh otomatis lebih dulu, dan data dikembalikan bila penulisan gagal). Timer fokus yang sedang berjalan tidak ikut. Logika: `src/lib/backup.ts` dan `src/lib/backup-store.ts`. Uji: `TZ=Asia/Jakarta npx tsx scripts/batch11-logic-check.ts`.

## PWA dan offline (0.11.0)

CampusBest bisa dipasang sebagai aplikasi (manifest, ikon, service worker buatan sendiri, tanpa dependency baru).
- Manifest: `src/app/manifest.ts` (isi di `src/lib/pwa.ts`). Ikon di `public/icons/`. Service worker: `public/sw.js`. Halaman cadangan offline: `public/offline.html`.
- Service worker hanya terdaftar di build produksi lewat HTTPS (atau `localhost`); di `npm run dev` tidak aktif. Uji dengan `npm run build && npm run start`.
- Instalasi: Chrome/Edge/Samsung Internet (Android dan desktop) menampilkan tombol "Pasang CampusBest" di Settings. iPhone/iPad tidak punya tombol otomatis, jadi Settings menampilkan langkah Bagikan > Tambah ke Layar Utama. Browser lain (mis. Firefox desktop) mungkin tidak mendukung; Settings hanya menampilkan petunjuk manual.
- Offline: halaman yang pernah dibuka saat online bisa dibuka lagi tanpa internet; halaman yang belum pernah dibuka menampilkan halaman cadangan offline. Data Tasks, Subjects, Schedule, Notes, Focus, dll. tetap di LocalStorage perangkat.
- Pembaruan: versi baru menunggu sampai kamu menekan "Perbarui" (tidak ada pengambilalihan otomatis). Service worker hanya memakai Cache Storage; ia tidak bisa dan tidak pernah menyentuh LocalStorage, jadi update tidak menghapus data. Browser tetap bisa menghapus data situs bila kamu membersihkannya sendiri.
- Saat menaikkan versi aplikasi: ubah `version` di `package.json`, `APP_VERSION` di `src/lib/pwa.ts`, dan `VERSION` di `public/sw.js` (diperiksa `scripts/batch10-logic-check.ts`).
- Uji: `TZ=Asia/Jakarta npx tsx scripts/batch10-logic-check.ts`.

## Calendar HP: singkatan mata kuliah (0.12.2)
Isi "Singkatan" di halaman Subjects (mis. KG, JST, PAPB); kosong = otomatis dari nama. Jadwal di ruang lab (teks ruangan memuat "Lab", atau kode ruangan ada di `LAB_ROOM_CODES` di `src/lib/course-label.ts`) tampil dengan akhiran P, mis. `JST P`. Di layar kecil tiap hari menampilkan chip singkatan + jam mulai; tugas dan event menampilkan nama ringkas + jam deadline/mulai bila ada.

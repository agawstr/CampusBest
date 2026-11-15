# Konteks Serah Terima — CampusBest (untuk sesi Claude baru)

Tempel/unggah file ini bersama ZIP source code. Baca `docs/PROGRESS.md` di dalam ZIP untuk detail.

## Peran dan aturan kerja
Saya melanjutkan pengembangan **CampusBest** (sebelumnya CampusMate) secara bertahap per "batch". Kamu mengerjakan hanya batch yang saya kirim.
- Jangan buat project baru. Pakai source di ZIP sebagai dasar. Ekstrak ke folder kosong.
- Pertahankan desain, fitur, dan arsitektur Phase 1 + Batch 1. Jangan ganti Next.js/React/Tailwind. Jangan tambah dependency tanpa alasan kuat.
- Jangan mulai batch berikutnya sebelum batch sekarang selesai dan dilaporkan.
- Jangan hapus key LocalStorage `campusmate_*` (kecuali lewat tombol "Hapus semua data" di Settings).
- Teks UI memakai bahasa Indonesia santai ("kamu"), natural, tidak terdengar seperti AI.
- Setiap akhir batch beri: ringkasan perubahan, daftar file, hasil `npm run typecheck` dan `npm run build`, serta apa yang belum diverifikasi.
- Pertama kali: `npm install`, lalu jalankan typecheck dan build untuk memastikan baseline hijau. (Sesi sebelumnya tidak punya akses jaringan, jadi build penuh belum pernah dijalankan.)

## Identitas
CampusBest — "Your Campus Bestie." — "Your friendly companion for a more organized campus life." (`src/lib/brand.ts`)

## Stack
Next.js 15 App Router, React 19, TypeScript strict, Tailwind 3.4 (token warna CSS variable), Radix Dialog, Lucide, Framer Motion, LocalStorage lewat `StorageAdapter`.

## Desain (jangan diubah besar-besaran)
Tema dark default + light, glassmorphism (`.glass`), accent biru, radius control 14 / card 22 / sheet 28, font Plus Jakarta Sans, animasi 150/250/450 ms. Komponen ada di `components/ui` (Button, Card, Modal, BottomSheet, ConfirmationDialog, EmptyState, StatCard, dan field: Field/Input/Textarea/Select/SegmentedControl/ChipGroup). Pola fitur: halaman `app/x/page.tsx` (server, metadata) memakai `components/x/x-view.tsx` (client); logika murni di `lib/x.ts` supaya bisa diuji tanpa browser. Navigasi dari `lib/navigation.ts`: mobile pill 4 item + More, tablet icon rail, desktop sidebar.

## Data dan storage (penting)
- Key: `campusbest_{subjects,tasks,schedules,events,notes,focus_sessions,settings}`. Migrasi copy-only otomatis dari `campusmate_*` (flag `campusbest_migration_v1`).
- Akses data lewat `useStorage(name)` atau `storage.read/write/update`. `update` diserialisasi per koleksi.
- Semua data dinormalisasi saat dibaca (`lib/normalize.ts`, schemaVersion 2); membaca tidak menulis; field tak dikenal, entri aneh, dan nilai enum tak dikenal dipertahankan saat menyimpan. **Saat mengedit record, selalu set `updatedAt` baru.**
- **Mengedit record dengan enum tak dikenal:** menaikkan `updatedAt` saja TIDAK cukup untuk menjaga nilai asli (pemulihan storage sengaja mati saat record diedit). Pola yang dipakai Tasks: lacak field yang disentuh pengguna, lalu bawa ulang nilai asli dari `storage.getCoercedRaw(name, id, field)` (panggil di dalam `update()`) untuk field yang tidak disentuh. Lihat `lib/tasks.ts` (`fieldsToPreserve`) dan `components/tasks/tasks-view.tsx`. Pola ini sudah dipakai untuk Schedule (`lib/schedule.ts`: `scheduleFieldsToPreserve`, `components/schedule/schedule-view.tsx`). Dan untuk Events (`lib/events.ts`: `eventFieldsToPreserve`; `type` ikut dianggap disentuh saat `category` disentuh).
- Model:
  - Task: `status` todo|in_progress|done|completed (pakai `isTaskDone()`), `deadline` "YYYY-MM-DD" + `deadlineTime` "HH:mm" (legacy `dueDate`, baca lewat `getTaskDeadline()`), `priority`, `subjectId`.
  - Subject: name, code, lecturer, credits, `semester`, color.
  - ScheduleItem: subjectId, `dayOfWeek` (0 = Minggu), startTime, endTime, room, `mode` offline|online, `recurrence` none|weekly|biweekly (legacy = weekly), `date?` (YYYY-MM-DD; tanggal untuk `none`, anchor sesi pertama untuk `biweekly`, tidak dipakai `weekly`). Aturan kemunculan hanya di `occursOn()` (`lib/schedule.ts`); jangan menulis ulang di tempat lain.
  - CampusEvent: title, `type` (event|exam|deadline|other, legacy), `category` (uts|uas|quiz|presentasi|praktikum|seminar|lainnya; sumber utama, `type` diturunkan darinya lewat `eventTypeFromCategory`), `location`, date, startTime, endTime, subjectId.
  - Note, AppSettings (theme, sidebarCollapsed, weekStartsOn, schemaVersion=2; plus optional `focus` dan `focusTimer`, lihat Focus di bawah).
  - FocusSession: subjectId?, taskId?, `startedAt` (ISO), `durationMinutes` (menit aktual, bulat), `completed` (true hanya bila timer habis normal), `endedAt?` (ISO; sesi lama tidak punya).
- Focus Timer (Phase 3 Batch 2): aturan murni di `lib/focus.ts` (tanpa jam dan storage; `nowMs` dikirim masuk; waktu SELALU dari timestamp), persistensi di `lib/focus-store.ts` (satu-satunya yang menulis `focusTimer`), state dipegang `providers/focus-timer-provider.tsx` di `AppProviders` (di atas semua halaman, supaya timer hidup saat pindah halaman; `template.tsx` me-remount halaman, provider tidak). Tidak ada key baru: durasi di `settings.focus`, timer aktif di `settings.focusTimer` (`idle|running|paused`, `endsAt` saat berjalan, `remainingMs` saat jeda, `runId`, `cycle` 0-3), riwayat di `focus_sessions` (id sesi = `runId`, idempoten). Ditulis hanya saat transisi, tidak per detik. Selalu lewat `storage.update("settings", s => ({...s, ...}))` agar field settings lain terbawa. Akhir fase: tulis sesi dulu, lalu pindahkan timer (pengaman `sameRun`). Hanya Focus yang dicatat; Reset/Lewati >= 1 menit = `completed:false`; < 1 menit tidak dicatat; istirahat tidak dicatat. Istirahat panjang setelah sesi fokus ke-4 yang selesai. Fase berikutnya tidak mulai otomatis. Dashboard punya kartu "Fokus hari ini" (`focusToday`, hari lokal). Tidak ada audio/Notification. Uji: `scripts/batch7-logic-check.ts`.
- Kalender (`lib/calendar.ts`) tidak punya penyimpanan; ia membaca `schedules`/`tasks`/`events` lewat `entriesForDate()`. Uji logika: `scripts/batch2-logic-check.ts`, `scripts/batch3-logic-check.ts`, `scripts/batch4-logic-check.ts`, `scripts/batch5-logic-check.ts`, `scripts/batch6-logic-check.ts`, `scripts/batch7-logic-check.ts` (`TZ=Asia/Jakarta npx tsx scripts/...`; semua sekaligus: `bash scripts/run-logic-checks.sh`). Dashboard (`lib/dashboard.ts`) juga tanpa penyimpanan; aksi cepatnya membuka form yang sudah ada lewat `?tambah=1` (`lib/quick-actions.ts`, `hooks/use-open-from-query.ts`), jangan menduplikasi form di sana.
- Notes: `lib/notes.ts` (logika murni), UI di `components/notes/`. Note = title, content (teks biasa), subjectId?, pinned?. Tersemat selalu di atas; sematan = edit (naikkan `updatedAt`). Tidak ada enum, jadi tidak perlu `getCoercedRaw`. Simpan/sematkan/hapus memanggil `ensureWritable()` (`getStorageAdapter().isAvailable()`) karena storage yang diblokir tidak melempar error; form tidak ditutup dan tulisan tidak hilang saat gagal. Aksi cepat Dashboard memakai pola `?tambah=1` yang sama.
- Utilitas: `generateId()` (`lib/id.ts`), helper tanggal lokal `lib/date.ts` (jangan `toISOString()` untuk tanggal), konstanta/label `lib/domain.ts`.

## Status
- Selesai: Phase 1 (shell, tema, dashboard dasar, settings, storage) + Batch 1 (rebranding, migrasi, model, normalisasi, util, perbaikan enum) + Batch 2 (Tasks + Subjects, bagian 3b) termasuk perbaikan keamanan data lanjutan + Batch 3 (Class Schedule + Calendar, bagian 3c) + Batch 4 (Exams & Events, bagian 3d) + Batch 5 (Dashboard Integration + pengujian akhir, bagian 3e di `docs/PROGRESS.md`) + Phase 3 Batch 1 (Notes + aksi cepat "Tambah catatan", bagian 3f) + Phase 3 Batch 2 (Focus Timer, bagian 3g, versi 0.8.0). Phase 2 selesai dikodekan; Phase 3 baru Notes dan Focus Timer. Pemilik melaporkan Batch 3 sudah berhasil dijalankan di repository-nya; Batch 4 belum diverifikasi build/browser.
- Masih placeholder: hanya Statistics. Notes (`/notes`) dan Focus (`/focus`) sudah ada. Dashboard terhubung ke Tasks, Subjects, Schedule, Events, aksi cepat Tambah catatan, dan kartu "Fokus hari ini" (tanpa kartu/statistik Notes).
- Belum terverifikasi: `npm install`/typecheck/build penuh oleh saya (sesi tanpa jaringan), terutama Batch 4, tampilan di browser (lihat `docs/PROGRESS.md` bagian 6).
- Berikutnya, pembagian batch resmi (spesifikasi saya kirim satu per satu):
  - Batch 2: Tasks + Subjects (selesai)
  - Batch 3: Class Schedule + Calendar (selesai; dilaporkan berhasil dijalankan di repository)
  - Batch 4: Exams & Events (selesai dikodekan)
  - Batch 5: Dashboard Integration + Testing (selesai dikodekan)
  - Phase 3 Batch 1: Notes (selesai dikodekan; belum diverifikasi build/browser)
  - Phase 3 Batch 2: Focus Timer (selesai dikodekan; belum diverifikasi build/browser/layar nyata)
  - Phase 3 (daftar terbaru): Notes (selesai), Focus Timer (selesai), Statistics, Settings, Export/Import, PWA, optimasi. Statistics tetap placeholder sampai ada spesifikasi.
  - Phase 3 Batch 2 menunggu persetujuan. Batch Phase 3 berikutnya belum dimulai; tunggu spesifikasinya.

Mulai dengan: ekstrak ZIP, baca `docs/PROGRESS.md`, jalankan install/typecheck/build (kalau jaringan ada), laporkan hasilnya, lalu tunggu spesifikasi batch berikutnya. Kalau build gagal, perbaiki dulu error dari Batch 1-2 sebelum batch baru.

## Update: Phase 3 Batch 3 / Bulk Import 1 (0.9.0)
Selesai dikodekan: halaman `/import` (Google Classroom + BRONE → Tasks), logika di `lib/import/` (modular per sumber lewat `ImportSourceDef`, hanya `commit.ts` yang menulis). Task punya field opsional `url` dan `importSource`. Uji: `scripts/batch8-logic-check.ts`. Belum diverifikasi: npm install/typecheck/build dan tampilan browser. SIAM Format 1 dan 2 (ke Schedule) = Bulk Import 2, BELUM dimulai; tunggu instruksi pemilik.

## Update: Phase 3 Batch 3 / Bulk Import 2 (0.10.0)
Selesai dikodekan: tab "Jadwal kuliah (SIAM)" di `/import` (SIAM Format 1 dan 2 -> Schedule). Parser `lib/import/siam.ts` (format dideteksi dari header tabel, kolom dicari lewat nama), preview/validasi/duplikat di `lib/import/schedule-preview.ts`, penulisan di `commitScheduleImport()` dalam `lib/import/commit.ts` (tetap satu-satunya yang menulis). Jalur tugas (Classroom, BRONE) tidak diubah; registry jadwal terpisah (`SCHEDULE_SOURCES`, `runScheduleParser`). Hasilnya jadwal `weekly` baru (tanpa `date`); `ScheduleItem` tidak punya field kelas/dosen, jadi Kelas hanya tampil di preview dan Dosen hanya dipakai untuk mata kuliah BARU. Jadwal lama tidak disentuh. Uji: `scripts/batch9-logic-check.ts` (119 pemeriksaan); semua uji: `bash scripts/run-logic-checks.sh`. Belum diverifikasi: npm install/typecheck/build, tampilan browser, dan parser terhadap salinan SIAM asli (lihat PROGRESS bagian 10). Phase 3 Batch 4 BELUM dimulai; tunggu instruksi pemilik.

## Update: Phase 3 Batch 4 / PWA + Optimization (0.11.0)
Selesai dikodekan: PWA tanpa dependency baru. `src/lib/pwa.ts` (APP_VERSION, `buildManifest()`, `installMode()`, `isIosDevice()`, `OFFLINE_CAPABILITIES`, `shouldRegisterServiceWorker()`), `src/app/manifest.ts`, `public/sw.js`, `public/offline.html`, `public/icons/*` (192, 512, maskable 512, apple-touch 180, favicon 32; digambar dengan Pillow, desain sementara), `src/providers/pwa-provider.tsx` (daftar SW, state install/online/update; di `AppProviders`, membungkus FocusTimerProvider), `src/components/settings/install-card.tsx` (satu kartu baru di `/settings`; tidak ada perubahan pengaturan lain, Settings batch penuh BELUM dimulai), metadata di `layout.tsx`, header `/sw.js` di `next.config.mjs`.
Aturan penting: SW hanya memakai Cache Storage dan TIDAK pernah menyentuh storage halaman; tidak ada `skipWaiting()` otomatis (hanya setelah pesan `SKIP_WAITING` dari tombol "Perbarui"); `activate` hanya menghapus cache ber-prefix `campusbest-` versi lama (cache `pages` dan `assets` dipertahankan). Versi harus sama di package.json, `APP_VERSION`, dan `VERSION` di sw.js. Key storage, StorageAdapter, dan jalur `clearAll` tidak diubah. Uji: `scripts/batch10-logic-check.ts` (96 pemeriksaan); `batch8`/`batch9` hanya diubah agar menerima versi 0.11.0.
Belum diverifikasi: npm install/typecheck/build, SW di browser sungguhan (Lighthouse, install prompt, offline, alur update), tampilan Settings baru dan banner offline/update, ikon di perangkat nyata. Statistics, Settings, Export/Import, Batch 5 BELUM dimulai; tunggu instruksi pemilik.

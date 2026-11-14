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

`src/lib/` (storage, normalisasi, domain, tanggal, id, brand, tasks, subjects, schedule, calendar), `src/hooks/use-storage.ts`, `src/types/`, `src/components/{ui,layout,shared,tasks,subjects,schedule,calendar}`, `scripts/` (uji logika murni), `src/providers/`.

Nama dan tagline aplikasi ada di satu tempat: `src/lib/brand.ts`.

## Uji logika

Uji perilaku untuk logika murni (tanpa browser, localStorage tiruan). Tidak butuh dependency di project, cukup `npx tsx`:

```bash
TZ=Asia/Jakarta npx tsx scripts/batch2-logic-check.ts
TZ=Asia/Jakarta npx tsx scripts/batch3-logic-check.ts   # coba juga TZ=America/New_York, TZ=Europe/London
```

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

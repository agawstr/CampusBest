# CampusMate — Phase 1

Your Academic Life, Organized.

```bash
npm install
npm run dev        # http://localhost:3000
npm run typecheck
npm run build
```

Stack: Next.js (App Router), TypeScript, Tailwind CSS, Radix Dialog (komponen bergaya shadcn/ui), Lucide, Framer Motion, LocalStorage.

Struktur: `src/lib/storage.ts` (adapter + service), `src/hooks/use-storage.ts`, `src/types/`, `src/components/{ui,layout,shared}`, `src/providers/`.
Untuk mengganti backend penyimpanan, implementasikan `StorageAdapter` lalu panggil `setStorageAdapter()`.

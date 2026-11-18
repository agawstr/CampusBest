"use client";

import { Check, Download, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { IOS_INSTALL_STEPS, MANUAL_INSTALL_HINT, OFFLINE_CAPABILITIES } from "@/lib/pwa";
import { usePwa } from "@/providers/pwa-provider";
import { useToast } from "@/providers/toast-provider";

/** Install guidance + offline status. Read-only with respect to app data. */
export function InstallCard() {
  const { mode, offlineReady, promptInstall } = usePwa();
  const { toast } = useToast();

  return (
    <Card delay={0.12}>
      <h2 className="text-[0.95rem] font-semibold tracking-tight">Pasang aplikasi</h2>
      {mode === "installed" && <p className="mt-1 text-sm text-muted">CampusBest sudah terpasang dan dibuka sebagai aplikasi.</p>}
      {mode === "prompt" && (
        <>
          <p className="mt-1 text-sm text-muted">Pasang CampusBest supaya bisa dibuka dari layar utama atau desktop.</p>
          <Button
            className="mt-4"
            onClick={async () => {
              const r = await promptInstall();
              if (r === "accepted") toast({ title: "Memasang aplikasi", variant: "success" });
            }}
          >
            <Download className="h-4 w-4" aria-hidden /> Pasang CampusBest
          </Button>
        </>
      )}
      {mode === "ios" && (
        <>
          <p className="mt-1 text-sm text-muted">Di iPhone/iPad, pemasangan dilakukan manual lewat Safari:</p>
          <ol className="mt-3 list-decimal space-y-1.5 pl-5 text-sm">
            {IOS_INSTALL_STEPS.map((s) => <li key={s}>{s}</li>)}
          </ol>
        </>
      )}
      {mode === "manual" && <p className="mt-1 text-sm text-muted">{MANUAL_INSTALL_HINT}</p>}

      <h3 className="mt-5 text-sm font-semibold">Pemakaian offline</h3>
      <p className="mt-1 text-xs text-muted">
        {offlineReady
          ? "Mode offline aktif di browser ini. Halaman yang pernah kamu buka bisa dibuka tanpa internet."
          : "Mode offline aktif setelah aplikasi dimuat sekali dengan internet (tidak aktif di mode pengembangan)."}
      </p>
      <ul className="mt-3 space-y-2 text-sm">
        {OFFLINE_CAPABILITIES.map((c) => (
          <li key={c.feature} className="flex items-start gap-2">
            {c.offline ? <Check className="mt-0.5 h-4 w-4 shrink-0 text-success" aria-hidden /> : <X className="mt-0.5 h-4 w-4 shrink-0 text-danger" aria-hidden />}
            <span>
              {c.feature}
              <span className="sr-only">{c.offline ? " bisa offline" : " butuh koneksi"}</span>
              <span className="block text-xs text-muted">{c.note}</span>
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-xs text-muted">Data tersimpan di penyimpanan browser perangkat ini dan tidak dihapus saat aplikasi diperbarui. Browser tetap bisa menghapusnya bila kamu membersihkan data situs.</p>
    </Card>
  );
}

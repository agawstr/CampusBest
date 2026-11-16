"use client";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getAppInfo } from "@/lib/settings";
import { usePwa } from "@/providers/pwa-provider";

/** App identity and version. The version is APP_VERSION (the existing single source), never typed here. */
export function AboutCard() {
  const info = getAppInfo();
  const { updateReady, applyUpdate } = usePwa();

  return (
    <Card>
      <h2 className="text-base font-semibold">Tentang aplikasi</h2>
      <dl className="mt-3 space-y-2 text-sm">
        <div className="flex justify-between gap-4"><dt className="text-muted">Nama</dt><dd className="font-medium">{info.name}</dd></div>
        <div className="flex justify-between gap-4"><dt className="text-muted">Versi</dt><dd className="font-medium tabular-nums">{info.version}</dd></div>
        <div className="flex justify-between gap-4"><dt className="text-muted">Penyimpanan</dt><dd className="text-right font-medium">Di perangkat ini (LocalStorage)</dd></div>
      </dl>
      <p className="mt-3 text-sm text-muted">{info.tagline} {info.description}</p>
      {updateReady && (
        <div className="mt-4 flex flex-wrap items-center gap-3 rounded-control border border-accent/30 bg-accent/10 px-3 py-2 text-sm">
          <span className="font-medium">Versi baru tersedia.</span>
          <Button size="sm" onClick={applyUpdate}>Perbarui</Button>
        </div>
      )}
    </Card>
  );
}

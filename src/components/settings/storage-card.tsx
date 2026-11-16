"use client";

import { useState } from "react";
import { Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { runStorageSelfTest, type SelfTestResult } from "@/lib/storage";

/** Basic read/write self-test. It uses its own key and never touches the user's data. */
export function StorageCard() {
  const [results, setResults] = useState<SelfTestResult[] | null>(null);
  return (
    <Card>
      <h2 className="text-base font-semibold">Penyimpanan lokal</h2>
      <p className="mt-1 text-sm text-muted">Uji dasar membaca dan menulis. Data kuliahmu tidak disentuh.</p>
      <Button className="mt-4" variant="secondary" onClick={async () => setResults(await runStorageSelfTest())}>
        Jalankan uji penyimpanan
      </Button>
      {results && (
        <ul className="mt-4 space-y-2 text-sm">
          {results.map((r) => (
            <li key={r.name} className="flex items-center gap-2">
              {r.passed ? <Check className="h-4 w-4 shrink-0 text-success" aria-hidden /> : <X className="h-4 w-4 shrink-0 text-danger" aria-hidden />}
              <span>{r.name}</span>
              <span className="sr-only">{r.passed ? "lulus" : "gagal"}</span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

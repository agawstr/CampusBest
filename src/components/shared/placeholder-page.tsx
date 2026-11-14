import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/layout/page-header";
import { NAV_ITEMS } from "@/lib/navigation";

export function PlaceholderPage({ navKey }: { navKey: string }) {
  const item = NAV_ITEMS.find((i) => i.key === navKey);
  if (!item) return null;
  const copy = item.placeholder ?? { title: "Segera hadir", description: "Halaman ini sedang disiapkan." };
  return (
    <>
      <PageHeader title={item.label} description={item.description} />
      <Card>
        <EmptyState
          icon={item.icon}
          title={copy.title}
          description={`${copy.description} Fitur ini dibangun di tahap pengembangan berikutnya.`}
        />
      </Card>
    </>
  );
}

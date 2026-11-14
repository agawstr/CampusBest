import type { Metadata } from "next";
import { PlaceholderPage } from "@/components/shared/placeholder-page";

export const metadata: Metadata = { title: "Notes" };

export default function Page() {
  return <PlaceholderPage navKey="notes" />;
}

import type { Metadata } from "next";
import { PlaceholderPage } from "@/components/shared/placeholder-page";

export const metadata: Metadata = { title: "Statistics" };

export default function Page() {
  return <PlaceholderPage navKey="statistics" />;
}

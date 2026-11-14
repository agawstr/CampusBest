import type { Metadata } from "next";
import { PlaceholderPage } from "@/components/shared/placeholder-page";

export const metadata: Metadata = { title: "Subjects" };

export default function Page() {
  return <PlaceholderPage navKey="subjects" />;
}

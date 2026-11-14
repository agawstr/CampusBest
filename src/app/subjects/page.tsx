import type { Metadata } from "next";
import { SubjectsView } from "@/components/subjects/subjects-view";

export const metadata: Metadata = { title: "Subjects" };

export default function Page() {
  return <SubjectsView />;
}

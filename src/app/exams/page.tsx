import type { Metadata } from "next";
import { EventsView } from "@/components/events/events-view";

export const metadata: Metadata = { title: "Exams" };

export default function Page() {
  return <EventsView />;
}

import type { Metadata } from "next";
import { StatisticsView } from "@/components/statistics/statistics-view";

export const metadata: Metadata = { title: "Statistics" };

export default function Page() {
  return <StatisticsView />;
}

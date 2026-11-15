import type { Task } from "@/types";
import { getTaskDeadline } from "../domain";
import { nameKey, urlKey } from "./text";

/** What the duplicate check needs from a candidate (a preview item). */
export interface DupCandidate {
  title: string;
  url: string;
  deadline: string;
  deadlineTime: string;
  /** Comparable subject identity, see subjectIdentity(). */
  subject: string;
}

export type DupInfo =
  | { kind: "existing"; taskId: string; title: string }
  | { kind: "batch"; withKey: string; title: string };

/** "id:<subjectId>", "none", or "name:<normalized source name>" for a subject that doesn't exist yet. */
export const subjectIdentity = {
  existing: (id: string) => `id:${id}`,
  none: "none",
  pending: (sourceName: string) => `name:${nameKey(sourceName)}`,
};

/**
 * Same task if:
 *  - both have a URL: the URLs are the same (different URLs are different tasks, even with the same title); otherwise
 *  - the titles are the same AND the subjects are the same AND the deadlines don't contradict each other.
 * Deadlines contradict when both have a date and the dates differ, or both have a time and the times differ.
 * A side without a deadline never contradicts (a Classroom task has none, a BRONE task has one).
 */
export function isSameTask(a: DupCandidate, b: DupCandidate): boolean {
  if (a.url && b.url) return urlKey(a.url) === urlKey(b.url);
  if (nameKey(a.title) !== nameKey(b.title) || !nameKey(a.title)) return false;
  if (a.subject !== b.subject) return false;
  if (a.deadline && b.deadline) {
    if (a.deadline !== b.deadline) return false;
    if (a.deadlineTime && b.deadlineTime && a.deadlineTime !== b.deadlineTime) return false;
  }
  return true;
}

export function taskAsCandidate(task: Task): DupCandidate {
  return {
    title: task.title,
    url: typeof task.url === "string" ? task.url : "",
    deadline: getTaskDeadline(task) ?? "",
    deadlineTime: task.deadlineTime ?? "",
    subject: task.subjectId ? subjectIdentity.existing(task.subjectId) : subjectIdentity.none,
  };
}

/**
 * For every item, the first thing it duplicates: an existing task, or an earlier included item of the same
 * batch. `items` are in display order; only included items count as "earlier". Pure: nothing is written.
 */
export function findDuplicates(
  items: readonly { key: string; included: boolean; candidate: DupCandidate }[],
  tasks: readonly Task[],
): Map<string, DupInfo> {
  const existing = tasks.map((t) => ({ task: t, candidate: taskAsCandidate(t) }));
  const out = new Map<string, DupInfo>();
  const seen: { key: string; title: string; candidate: DupCandidate }[] = [];
  for (const item of items) {
    const hit = existing.find((e) => isSameTask(item.candidate, e.candidate));
    if (hit) {
      out.set(item.key, { kind: "existing", taskId: hit.task.id, title: hit.task.title });
    } else {
      const earlier = seen.find((s) => isSameTask(item.candidate, s.candidate));
      if (earlier) out.set(item.key, { kind: "batch", withKey: earlier.key, title: earlier.title });
    }
    if (item.included) seen.push({ key: item.key, title: item.candidate.title, candidate: item.candidate });
  }
  return out;
}

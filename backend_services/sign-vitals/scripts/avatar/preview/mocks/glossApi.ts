// Dev-only stand-in for services/glossApi.ts in the preview harness: serves a
// snapshot of real data (GLOSS_FIXTURES, built from read-only queries and the
// real model on reference videos). Check my sign returns window.__freeOutcome
// ('match' | 'maybe' | 'none'); Recall returns the snapshot's recall attempt.
declare const __FIXTURES__: string;
type Fx = Record<string, any>;
const fixtures: Promise<Fx> = fetch(__FIXTURES__).then((r) => r.json());
const w = window as unknown as Record<string, unknown>;
const later = <T,>(v: T, ms = (w.__submitDelay as number) ?? 400) => new Promise<T>((res) => setTimeout(() => res(v), ms));

export async function getNextGlossLesson() { return { next_recommended_sign_id: (await fixtures).next_lesson }; }
export async function listGlossSigns() { return (await fixtures).signs; }
export async function getGlossSignReference(signId: string) {
  const ref = (await fixtures).references[signId];
  if (!ref) throw new Error("not in the snapshot");
  return ref;
}
export async function getGlossSignDemoVideo() { return null; }
export async function getGlossProgress() { return (await fixtures).progress; }
export async function getGlossHistory() { return (await fixtures).history; }
export async function getGlossProgressSummary() { return (await fixtures).summary; }
export async function getRecallSign() { return { sign_id: "water" }; }
export async function submitFreeAttempt() { return later((await fixtures).free[(w.__freeOutcome as string) ?? "match"]); }
export async function submitWebcamAttempt(_t: string, _b: Blob, _s?: string, mode = "practice") {
  const fx = await fixtures;
  return later(mode === "recall" ? fx.recall : fx.recall);
}
export async function submitMultipleChoiceAttempt() { return later((await fixtures).recall); }
export async function getGlossAttemptFeedback() { return { status: "unchanged", summary: null }; }
export async function getGlossHistoryPage(p: { limit?: number; before?: string; start?: string; end?: string }) {
  let rows = (await fixtures).history as Array<{ attempted_at: string }>;
  if (p.before) rows = rows.filter((r) => r.attempted_at < p.before!);
  if (p.start) rows = rows.filter((r) => new Date(r.attempted_at) >= new Date(p.start!));
  if (p.end) rows = rows.filter((r) => new Date(r.attempted_at) < new Date(p.end!));
  const limit = p.limit ?? 30;
  return { attempts: rows.slice(0, limit), has_more: rows.length > limit };
}
// Supervisor view: window.__me = "supervisor" | "supervisor-new" (no learner profile yet).
export async function getGlossMe() {
  const me = w.__me as string | undefined;
  if (me?.startsWith("supervisor")) return { role: "supervisor", name: "Preview Supervisor", learner_id: me === "supervisor" ? "sup-learner" : null, is_supervisor: true };
  return { role: "caregiver", name: "Preview Caregiver", learner_id: "preview", is_supervisor: false };
}
export async function getSupervisorOverview() { return later((await fixtures).supervisor_overview); }
export async function getSupervisorCaregiver(id: string) { return later((await fixtures).supervisor_details[id]); }
export async function createSupervisorLearnerProfile() { return later({ learner_id: "sup-learner" }); }

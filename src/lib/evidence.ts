import type { Lesson, Revision, StudentResponse, ViewpointKey } from "./types";

const labels: Record<ViewpointKey, string> = {
  weight: "weight-first",
  gravity: "gravity-first",
  air: "context-first"
};

export function countReasoningPaths(responses: StudentResponse[]): Record<ViewpointKey, number> {
  return responses.reduce<Record<ViewpointKey, number>>((counts, response) => {
    counts[response.viewpoint] += 1;
    return counts;
  }, { weight: 0, gravity: 0, air: 0 });
}

export function createEvidenceNote({ lesson, responses, revision, nextMove }: {
  lesson: Lesson;
  responses: StudentResponse[];
  revision?: Revision;
  nextMove: string;
}): string {
  const counts = countReasoningPaths(responses);
  const reasoningSnapshot = (Object.keys(labels) as ViewpointKey[])
    .map((key) => `${counts[key]} ${labels[key]}`)
    .join(", ");
  const revisionLine = revision
    ? `One anonymous revision saved: “${revision.claim}” Evidence named: “${revision.evidence}”`
    : "No student revision has been saved in this demo session yet.";

  return [
    `Counterpoint evidence note — ${lesson.title}`,
    `Learning goal: ${lesson.learningGoal}`,
    `Prompt: ${lesson.question}`,
    `Before discussion: ${responses.length} anonymous responses (${reasoningSnapshot}).`,
    revisionLine,
    `Suggested next move: ${nextMove}`,
    "Teacher note: This is formative evidence for teacher review, not a grade or student record."
  ].join("\n\n");
}

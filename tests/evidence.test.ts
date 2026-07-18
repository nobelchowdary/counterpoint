import { describe, expect, it } from "vitest";
import { createEvidenceNote } from "../src/lib/evidence";
import { lesson, nextMove, responses } from "../src/lib/demo-data";

describe("teacher evidence note", () => {
  it("records only actual submitted revisions and avoids grading language", () => {
    const note = createEvidenceNote({ lesson, responses, nextMove });

    expect(note).toContain("12 anonymous responses");
    expect(note).toContain("No student revision has been saved");
    expect(note).toContain("not a grade or student record");
  });

  it("records a learner's own reasoning signal without claiming a class-wide result", () => {
    const note = createEvidenceNote({
      lesson,
      responses,
      nextMove,
      revision: {
        claim: "They land together without air resistance.",
        evidence: "Both have the same acceleration.",
        shift: "changed",
        counterpoint: "What observation would prove that?",
        savedAt: "2026-07-18T00:00:00.000Z"
      }
    });

    expect(note).toContain("Learner signal: my thinking changed");
    expect(note).toContain("Counterpoint question");
    expect(note).not.toContain("class-wide shift");
  });
});

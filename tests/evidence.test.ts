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
});

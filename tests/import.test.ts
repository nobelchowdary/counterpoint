import { describe, expect, it } from "vitest";
import { parseAnonymousResponses, screenAnonymousResponses } from "../src/lib/import";

describe("anonymous response import", () => {
  it("creates neutral aliases and preliminary reasoning paths from claim-and-evidence rows", () => {
    const imported = parseAnonymousResponses([
      "They land together | Both are pulled down at the same time.",
      "Air could matter | A wide shape has more air resistance.",
      "The heavier one lands first | It has more downward force."
    ].join("\n"));

    expect(imported.map((response) => response.alias)).toEqual(["Response 01", "Response 02", "Response 03"]);
    expect(imported.map((response) => response.viewpoint)).toEqual(["gravity", "air", "weight"]);
  });

  it("rejects direct contact information before anything enters the session", () => {
    expect(() => parseAnonymousResponses([
      "Claim one | email me at student@example.com",
      "Claim two | example evidence",
      "Claim three | more evidence"
    ].join("\n"))).toThrow("contact information");
  });

  it("separates deterministic intake issues from usable anonymous responses", () => {
    const screening = screenAnonymousResponses([
      "They land together | Both are released from the same height.",
      "asdf | qwerty",
      "Air could matter | A wide shape meets more air.",
      "The heavier one lands first",
      "The force may be larger | Ask jordan@example.com what they observed.",
      "Mass could matter | Compare the pull with how much object there is."
    ].join("\n"));

    expect(screening.acceptedResponses.map((response) => response.alias)).toEqual([
      "Response 01",
      "Response 02",
      "Response 03"
    ]);
    expect(screening.acceptedResponses.map((response) => response.claim)).toEqual([
      "They land together",
      "Air could matter",
      "Mass could matter"
    ]);
    expect(screening.needsReview.map((item) => ({ sourceLine: item.sourceLine, reason: item.reason }))).toEqual([
      { sourceLine: 2, reason: "gibberish" },
      { sourceLine: 4, reason: "missing-evidence" },
      { sourceLine: 5, reason: "contact-information" }
    ]);
    expect(screening.acceptedResponses.map((response) => `${response.claim} | ${response.evidence}`)).not.toContain("asdf | qwerty");
    expect(screening.canImport).toBe(true);
  });

  it("does not allow a caller to import fewer than three accepted responses", () => {
    const rawText = [
      "They land together | Both are released from the same height.",
      "asdf | qwerty",
      "The heavier one lands first"
    ].join("\n");

    const screening = screenAnonymousResponses(rawText);
    expect(screening.acceptedResponses).toHaveLength(1);
    expect(screening.needsReview.map((item) => item.reason)).toEqual(["gibberish", "missing-evidence"]);
    expect(screening.canImport).toBe(false);
    expect(() => screenAnonymousResponses(rawText, { requireMinimumAccepted: true })).toThrow("at least 3 accepted");
  });

  it("routes overlong rows to review without letting them reach approved responses", () => {
    const tooLongClaim = "a".repeat(501);
    const screening = screenAnonymousResponses([
      `${tooLongClaim} | Evidence that would otherwise be valid.`,
      "They land together | Both are released from the same height.",
      "Air could matter | A wide shape meets more air.",
      "Mass could matter | Compare the pull with how much object there is."
    ].join("\n"));

    expect(screening.needsReview).toHaveLength(1);
    expect(screening.needsReview[0]).toMatchObject({ sourceLine: 1, reason: "too-long" });
    expect(screening.acceptedResponses).toHaveLength(3);
    expect(screening.acceptedResponses.some((response) => response.claim === tooLongClaim)).toBe(false);
  });
});

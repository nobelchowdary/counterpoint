import { describe, expect, it } from "vitest";
import { createImpactSummary, demoExitTickets, safePercent } from "../src/lib/impact";

describe("exit-ticket impact summary", () => {
  it("aggregates the staged anonymous demo data without overstating learner signals", () => {
    expect(createImpactSummary(demoExitTickets)).toEqual({
      total: 12,
      changed: 5,
      strengthened: 3,
      stillThinking: 4,
      namedNewEvidence: 10,
      changedOrStrengthened: 8,
      changedOrStrengthenedPercent: 67,
      namedNewEvidencePercent: 83
    });
  });

  it("returns an all-zero summary when no exit tickets have been submitted", () => {
    expect(createImpactSummary([])).toEqual({
      total: 0,
      changed: 0,
      strengthened: 0,
      stillThinking: 0,
      namedNewEvidence: 0,
      changedOrStrengthened: 0,
      changedOrStrengthenedPercent: 0,
      namedNewEvidencePercent: 0
    });
  });

  it("never produces NaN or Infinity for an empty denominator", () => {
    expect(safePercent(10, 0)).toBe(0);
  });
});

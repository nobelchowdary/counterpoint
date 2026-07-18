import { describe, expect, it } from "vitest";
import { createDemoAnalysis, createImportedReviewAnalysis, normalizeAnalysisResult } from "../src/lib/analysis";
import { responses } from "../src/lib/demo-data";

describe("classroom reasoning analysis contract", () => {
  it("keeps every anonymous response traceable in the offline demo map", () => {
    const analysis = createDemoAnalysis(responses);

    expect(analysis.viewpoints).toHaveLength(3);
    expect(Object.keys(analysis.responseViewpoints).sort()).toEqual(responses.map((response) => response.id).sort());
    expect(analysis.protocol.length).toBeGreaterThanOrEqual(3);
  });

  it("rejects an incomplete server assignment before it can change the teacher view", () => {
    const fixture = createDemoAnalysis(responses);
    const incomplete = {
      ...fixture,
      responseViewpoints: Object.fromEntries(responses.slice(1).map((response) => [response.id, response.viewpoint]))
    };

    expect(() => normalizeAnalysisResult(incomplete, responses)).toThrow("incomplete response map");
  });

  it("labels an imported class as a teacher-reviewable draft instead of a model verdict", () => {
    const analysis = createImportedReviewAnalysis([{ ...responses[0], id: "imported-1" }, { ...responses[1], id: "imported-2" }, { ...responses[2], id: "imported-3" }]);

    expect(analysis.model).toBe("Local draft map");
    expect(analysis.viewpoints.every((viewpoint) => viewpoint.badge === "Draft pattern")).toBe(true);
  });
});

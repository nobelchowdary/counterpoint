import { describe, expect, it } from "vitest";
import { responses } from "../src/lib/demo-data";
import { excludeResponseForReview, hasCompletedMapReview, moveResponseToPath } from "../src/lib/review";

describe("teacher review controls", () => {
  it("re-sorts a selected source response without changing the evidence", () => {
    const moved = moveResponseToPath(responses, "s1", "gravity");

    expect(moved).toHaveLength(responses.length);
    expect(moved.find((response) => response.id === "s1")).toMatchObject({
      viewpoint: "gravity",
      claim: responses[0].claim,
      evidence: responses[0].evidence
    });
  });

  it("keeps a recoverable excluded response and protects a viable class discussion", () => {
    const result = excludeResponseForReview(responses, "s1");

    expect(result.included).toHaveLength(11);
    expect(result.excluded.id).toBe("s1");
    expect(() => excludeResponseForReview(responses.slice(0, 3), "s1")).toThrow("at least three");
  });

  it("requires all three pathways to be reviewed before classroom approval", () => {
    expect(hasCompletedMapReview(["weight", "gravity"])).toBe(false);
    expect(hasCompletedMapReview(["weight", "gravity", "air"])).toBe(true);
  });
});

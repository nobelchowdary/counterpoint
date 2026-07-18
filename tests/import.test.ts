import { describe, expect, it } from "vitest";
import { parseAnonymousResponses } from "../src/lib/import";

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
});

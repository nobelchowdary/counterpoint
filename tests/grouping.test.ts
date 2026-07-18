import { describe, expect, it } from "vitest";
import { responses } from "../src/lib/demo-data";
import { createDiverseGroups } from "../src/lib/grouping";

describe("createDiverseGroups", () => {
  it("places every learner once in a three-person group", () => {
    const groups = createDiverseGroups(responses);
    const memberIds = groups.flatMap((group) => group.members.map((member) => member.id));

    expect(groups).toHaveLength(4);
    expect(memberIds).toHaveLength(responses.length);
    expect(new Set(memberIds).size).toBe(responses.length);
    expect(groups.every((group) => group.members.length === 3)).toBe(true);
  });

  it("maximizes viewpoint diversity for this balanced demo", () => {
    const groups = createDiverseGroups(responses, 1);

    expect(groups.every((group) => new Set(group.members.map((member) => member.viewpoint)).size === 3)).toBe(true);
  });
});

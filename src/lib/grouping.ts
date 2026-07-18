import type { DiscussionGroup, StudentResponse, ViewpointKey } from "./types";

const viewpointOrder: ViewpointKey[] = ["weight", "air", "gravity"];

/**
 * Builds groups with one contrasting reasoning path per group when possible.
 * The model may label views, but this deterministic function owns placement.
 */
export function createDiverseGroups(responses: StudentResponse[], rotation = 0): DiscussionGroup[] {
  const byView = new Map<ViewpointKey, StudentResponse[]>();
  viewpointOrder.forEach((viewpoint) => byView.set(viewpoint, responses.filter((response) => response.viewpoint === viewpoint)));

  const groupCount = Math.ceil(responses.length / 3);
  const groups: DiscussionGroup[] = Array.from({ length: groupCount }, (_, index) => ({
    id: `group-${index + 1}`,
    members: [],
    reason: "Each learner brings a distinct explanation to test with evidence."
  }));

  viewpointOrder.forEach((viewpoint, viewpointIndex) => {
    const members = byView.get(viewpoint) ?? [];
    members.forEach((member, memberIndex) => {
      const groupIndex = (memberIndex + viewpointIndex + rotation) % groupCount;
      groups[groupIndex].members.push(member);
    });
  });

  return groups.map((group) => ({
    ...group,
    members: group.members.slice(0, 3)
  }));
}

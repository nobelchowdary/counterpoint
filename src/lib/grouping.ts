import type { DiscussionGroup, StudentResponse, ViewpointKey } from "./types";

const viewpointOrder: ViewpointKey[] = ["weight", "air", "gravity"];

/**
 * Builds groups with one contrasting reasoning path per group when possible.
 * The model may label views, but this deterministic function owns placement.
 */
export function createDiverseGroups(responses: StudentResponse[], rotation = 0): DiscussionGroup[] {
  const groupCount = Math.ceil(responses.length / 3);
  const groups: DiscussionGroup[] = Array.from({ length: groupCount }, (_, index) => ({
    id: `group-${index + 1}`,
    members: [],
    reason: "Each learner brings a distinct explanation to test with evidence."
  }));

  const byView = new Map<ViewpointKey, StudentResponse[]>();
  viewpointOrder.forEach((viewpoint) => byView.set(viewpoint, responses.filter((response) => response.viewpoint === viewpoint)));
  const orderedResponses = Array.from({ length: Math.max(...viewpointOrder.map((viewpoint) => byView.get(viewpoint)?.length ?? 0), 0) })
    .flatMap((_, memberIndex) => viewpointOrder.map((viewpoint) => byView.get(viewpoint)?.[memberIndex]).filter((response): response is StudentResponse => Boolean(response)));

  orderedResponses.forEach((member) => {
    const nextGroup = groups
      .map((group, index) => ({ group, index }))
      .filter(({ group }) => group.members.length < 3)
      .sort((left, right) => {
        const leftSameView = left.group.members.filter((existing) => existing.viewpoint === member.viewpoint).length;
        const rightSameView = right.group.members.filter((existing) => existing.viewpoint === member.viewpoint).length;
        if (leftSameView !== rightSameView) return leftSameView - rightSameView;
        if (left.group.members.length !== right.group.members.length) return left.group.members.length - right.group.members.length;
        return ((left.index - rotation + groupCount) % groupCount) - ((right.index - rotation + groupCount) % groupCount);
      })[0]?.group;
    nextGroup?.members.push(member);
  });

  return groups;
}

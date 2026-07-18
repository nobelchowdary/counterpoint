import type { StudentResponse, ViewpointKey } from "./types";

export const requiredReviewPaths: ViewpointKey[] = ["weight", "gravity", "air"];

export function moveResponseToPath(responses: StudentResponse[], responseId: string, target: ViewpointKey): StudentResponse[] {
  return responses.map((response) => response.id === responseId ? { ...response, viewpoint: target } : response);
}

/** Keeps at least three anonymous responses in the classroom plan. */
export function excludeResponseForReview(responses: StudentResponse[], responseId: string): {
  included: StudentResponse[];
  excluded: StudentResponse;
} {
  if (responses.length <= 3) throw new Error("Keep at least three anonymous responses in the classroom plan.");
  const excluded = responses.find((response) => response.id === responseId);
  if (!excluded) throw new Error("That source response is no longer in the classroom plan.");
  return { included: responses.filter((response) => response.id !== responseId), excluded };
}

export function hasCompletedMapReview(reviewedIds: ViewpointKey[]): boolean {
  return requiredReviewPaths.every((path) => reviewedIds.includes(path));
}

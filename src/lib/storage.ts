import type {
  CounterpointDraft,
  DraftAnalysisState,
  DraftStage,
  DraftWorkflow,
  IntakeIssue,
  Lesson,
  ProtocolStep,
  Revision,
  StudentResponse,
  Viewpoint,
  ViewpointKey
} from "./types";

const draftKey = "counterpoint.teacher-draft.v1";
const viewpointKeys: ViewpointKey[] = ["weight", "gravity", "air"];
const stages: DraftStage[] = ["launch", "map", "groups", "protocol", "evidence"];
const analysisStates: Exclude<DraftAnalysisState, "loading">[] = ["idle", "live", "demo"];

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isString(value: unknown): value is string {
  return typeof value === "string";
}

function isViewpointKey(value: unknown): value is ViewpointKey {
  return typeof value === "string" && viewpointKeys.includes(value as ViewpointKey);
}

function isLesson(value: unknown): value is Lesson {
  return isRecord(value) && isString(value.title) && isString(value.learningGoal) && isString(value.question);
}

function isResponse(value: unknown): value is StudentResponse {
  return isRecord(value)
    && isString(value.id)
    && isString(value.alias)
    && isString(value.claim)
    && isString(value.evidence)
    && typeof value.confidence === "number"
    && isViewpointKey(value.viewpoint);
}

function isViewpoint(value: unknown): value is Viewpoint {
  return isRecord(value)
    && isViewpointKey(value.id)
    && isString(value.title)
    && isString(value.badge)
    && isString(value.summary)
    && isString(value.teacherNote)
    && ["rose", "blue", "gold"].includes(String(value.color));
}

function isProtocolStep(value: unknown): value is ProtocolStep {
  return isRecord(value) && ["id", "title", "description", "duration"].every((key) => isString(value[key]));
}

function isRevision(value: unknown): value is Revision {
  return isRecord(value)
    && isString(value.claim)
    && isString(value.evidence)
    && ["changed", "strengthened", "still-thinking"].includes(String(value.shift))
    && isString(value.savedAt)
    && (value.counterpoint === undefined || isString(value.counterpoint))
    && (value.id === undefined || isString(value.id))
    && (value.groupId === undefined || isString(value.groupId))
    && (value.namedNewEvidence === undefined || typeof value.namedNewEvidence === "boolean");
}

function isIssue(value: unknown): value is IntakeIssue {
  return isRecord(value)
    && isString(value.id)
    && typeof value.line === "number"
    && ["needs-review", "blocked"].includes(String(value.status))
    && isString(value.reason);
}

function normalizeWorkflow(value: unknown): DraftWorkflow | undefined {
  if (!isRecord(value)
    || !stages.includes(value.stage as DraftStage)
    || typeof value.furthestStage !== "number"
    || typeof value.rotation !== "number"
    || !Array.isArray(value.lockedGroupIds)
    || !value.lockedGroupIds.every(isString)
    || typeof value.groupsApproved !== "boolean"
    || !isViewpointKey(value.activeViewpoint)
    || !analysisStates.includes(value.analysisState as Exclude<DraftAnalysisState, "loading">)) {
    return undefined;
  }

  return {
    stage: value.stage as DraftStage,
    furthestStage: Math.min(Math.max(Math.floor(value.furthestStage), 0), stages.length - 1),
    rotation: Math.max(Math.floor(value.rotation), 0),
    lockedGroupIds: value.lockedGroupIds,
    groupsApproved: value.groupsApproved,
    activeViewpoint: value.activeViewpoint,
    analysisState: value.analysisState as Exclude<DraftAnalysisState, "loading">
  };
}

function parseDraft(value: unknown): CounterpointDraft | null {
  if (!isRecord(value)
    || !isLesson(value.lesson)
    || !Array.isArray(value.responses)
    || !value.responses.every(isResponse)
    || !Array.isArray(value.viewpoints)
    || !value.viewpoints.every(isViewpoint)
    || !Array.isArray(value.protocol)
    || !value.protocol.every(isProtocolStep)
    || !isString(value.teacherMove)
    || !isString(value.studentPrompt)
    || !isString(value.nextMove)
    || !isString(value.updatedAt)) {
    return null;
  }

  const excludedResponses = Array.isArray(value.excludedResponses) && value.excludedResponses.every(isResponse)
    ? value.excludedResponses
    : [];
  const needsReviewItems = Array.isArray(value.needsReviewItems) && value.needsReviewItems.every(isIssue)
    ? value.needsReviewItems
    : [];
  const reviewedViewpointIds = Array.isArray(value.reviewedViewpointIds) && value.reviewedViewpointIds.every(isViewpointKey)
    ? value.reviewedViewpointIds
    : [];
  const exitTickets = Array.isArray(value.exitTickets) && value.exitTickets.every(isRevision)
    ? value.exitTickets
    : undefined;

  return {
    version: 2,
    lesson: value.lesson,
    responses: value.responses,
    excludedResponses,
    needsReviewItems,
    viewpoints: value.viewpoints,
    reviewedViewpointIds,
    mapApproved: value.mapApproved === true,
    protocol: value.protocol,
    teacherMove: value.teacherMove,
    studentPrompt: value.studentPrompt,
    nextMove: value.nextMove,
    revision: isRevision(value.revision) ? value.revision : undefined,
    exitTickets,
    workflow: normalizeWorkflow(value.workflow),
    updatedAt: value.updatedAt
  };
}

/**
 * Hydrates only a structurally valid local draft. Old v1 drafts are migrated
 * by supplying safe defaults for the new workflow fields on the next save.
 */
export function loadDraft(): CounterpointDraft | null {
  if (typeof window === "undefined") return null;
  try {
    const saved = window.localStorage.getItem(draftKey);
    return saved ? parseDraft(JSON.parse(saved)) : null;
  } catch {
    return null;
  }
}

export function saveDraft(draft: CounterpointDraft): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(draftKey, JSON.stringify(draft));
  } catch {
    // Browsers with disabled storage can still run the complete session in memory.
  }
}

export function clearDraft(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(draftKey);
  } catch {
    // Nothing else needs to happen for a best-effort reset.
  }
}

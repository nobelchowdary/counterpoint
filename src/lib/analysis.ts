import { nextMove, protocol, studentPrompt, teacherMove, viewpoints } from "./demo-data";
import type { AnalysisResult, Lesson, ProtocolStep, StudentResponse, Viewpoint, ViewpointKey } from "./types";

const viewpointKeys: ViewpointKey[] = ["weight", "gravity", "air"];

type AnalysisRequest = {
  lesson: Lesson;
  responses: StudentResponse[];
};

type ApiError = {
  error?: string;
};

function isViewpointKey(value: unknown): value is ViewpointKey {
  return typeof value === "string" && viewpointKeys.includes(value as ViewpointKey);
}

function isProtocolStep(value: unknown): value is ProtocolStep {
  if (!value || typeof value !== "object") return false;
  const step = value as Record<string, unknown>;
  return ["id", "title", "description", "duration"].every((key) => typeof step[key] === "string");
}

function isViewpoint(value: unknown): value is Viewpoint {
  if (!value || typeof value !== "object") return false;
  const viewpoint = value as Record<string, unknown>;
  return isViewpointKey(viewpoint.id)
    && typeof viewpoint.title === "string"
    && typeof viewpoint.badge === "string"
    && typeof viewpoint.summary === "string"
    && typeof viewpoint.teacherNote === "string"
    && ["rose", "blue", "gold"].includes(String(viewpoint.color));
}

/**
 * A reliable, offline-first result for the supplied de-identified demo fixture.
 * This is also the graceful fallback if a deploy has not configured its server key.
 */
export function createDemoAnalysis(studentResponses: StudentResponse[]): AnalysisResult {
  return {
    model: "Deterministic demo map",
    viewpoints,
    responseViewpoints: Object.fromEntries(studentResponses.map((response) => [response.id, response.viewpoint])),
    protocol,
    teacherMove,
    studentPrompt,
    nextMove
  };
}

/** A transparent local starting point for teacher-imported responses before GPT-5.6 is connected. */
export function createImportedReviewAnalysis(studentResponses: StudentResponse[]): AnalysisResult {
  return {
    model: "Local draft map",
    viewpoints: [
      { id: "weight", title: "Force-focused reasoning", badge: "Draft pattern", color: "rose", summary: "Responses that foreground force, weight, or a main cause. Rename this wording after reviewing the source ideas.", teacherNote: "Ask which evidence or observation would test this explanation." },
      { id: "gravity", title: "Relationship-focused reasoning", badge: "Draft pattern", color: "blue", summary: "Responses that compare two ideas, objects, or relationships. Rename this wording after reviewing the source ideas.", teacherNote: "Invite learners to name what stays the same and what changes." },
      { id: "air", title: "Condition-focused reasoning", badge: "Draft pattern", color: "gold", summary: "Responses that notice conditions, context, or missing information. Rename this wording after reviewing the source ideas.", teacherNote: "Ask which condition would make the strongest test or counterexample." }
    ],
    responseViewpoints: Object.fromEntries(studentResponses.map((response) => [response.id, response.viewpoint])),
    protocol: [
      { id: "notice", title: "Notice your reasoning", description: "Re-read your own claim and underline the evidence or example you used.", duration: "1 min" },
      { id: "listen", title: "Understand before challenge", description: "Each person shares an explanation. Ask one question to understand it accurately.", duration: "4 min" },
      { id: "test", title: "Test an explanation", description: "Compare the evidence. Name one observation, example, or condition that could test the ideas.", duration: "3 min" },
      { id: "revise", title: "Revise independently", description: "Keep or revise your claim. Name the evidence that mattered most.", duration: "2 min" }
    ],
    teacherMove: "Listen for claims that need evidence and for conditions learners think could change the result. Do not announce a verdict before groups name their reasoning.",
    studentPrompt: "What evidence, example, or condition would help your group test these explanations?",
    nextMove: "Choose one shared example or small investigation that lets learners test a claim against evidence."
  };
}

export function createOfflineReviewAnalysis(studentResponses: StudentResponse[]): AnalysisResult {
  return studentResponses.every((response) => /^s\d+$/.test(response.id))
    ? createDemoAnalysis(studentResponses)
    : createImportedReviewAnalysis(studentResponses);
}

/** Validates an untrusted server result before it changes a teacher-facing map. */
export function normalizeAnalysisResult(value: unknown, studentResponses: StudentResponse[]): AnalysisResult {
  if (!value || typeof value !== "object") throw new Error("Analysis returned an invalid result.");
  const result = value as Record<string, unknown>;
  if (!Array.isArray(result.viewpoints) || result.viewpoints.length !== 3 || !result.viewpoints.every(isViewpoint)) {
    throw new Error("Analysis did not return three reviewable viewpoints.");
  }
  if (new Set(result.viewpoints.map((viewpoint) => viewpoint.id)).size !== 3) {
    throw new Error("Analysis returned duplicate reasoning viewpoints.");
  }
  if (!Array.isArray(result.protocol) || result.protocol.length < 3 || !result.protocol.every(isProtocolStep)) {
    throw new Error("Analysis did not return a usable discussion protocol.");
  }
  if (["teacherMove", "studentPrompt", "nextMove"].some((key) => typeof result[key] !== "string")) {
    throw new Error("Analysis is missing teacher-facing guidance.");
  }

  const rawAssignments = result.responseViewpoints;
  if (!rawAssignments || typeof rawAssignments !== "object") throw new Error("Analysis is missing source links.");
  const assignments: Record<string, ViewpointKey> = {};
  for (const response of studentResponses) {
    const assignment = (rawAssignments as Record<string, unknown>)[response.id];
    if (!isViewpointKey(assignment)) throw new Error("Analysis included an incomplete response map.");
    assignments[response.id] = assignment;
  }

  return {
    model: typeof result.model === "string" ? result.model : "GPT-5.6",
    viewpoints: result.viewpoints,
    responseViewpoints: assignments,
    protocol: result.protocol,
    teacherMove: result.teacherMove as string,
    studentPrompt: result.studentPrompt as string,
    nextMove: result.nextMove as string
  };
}

/** Calls the optional server-side GPT-5.6 route. No secret is ever sent by the browser. */
export async function requestAnalysis(request: AnalysisRequest): Promise<AnalysisResult> {
  const response = await fetch("/api/analyze", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      lesson: request.lesson,
      responses: request.responses.map(({ id, claim, evidence }) => ({ id, claim, evidence }))
    })
  });
  if (!response.ok) {
    let message = "The secure GPT-5.6 analysis route is unavailable.";
    try {
      const body = await response.json() as ApiError;
      if (body.error) message = body.error;
    } catch {
      // A non-JSON deployment error should still leave the demo usable.
    }
    throw new Error(message);
  }
  return normalizeAnalysisResult(await response.json(), request.responses);
}

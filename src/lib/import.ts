import type { StudentResponse, ViewpointKey } from "./types";

const emailPattern = /\b[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}\b/;
const phonePattern = /(?:\+?\d[\d .()-]{7,}\d)/;
const minimumAcceptedResponses = 3;
const maximumResponsesPerImport = 30;

const fillerTerms = new Set([
  "asdf",
  "qwerty",
  "zxcv",
  "zxcvb",
  "blah",
  "lorem",
  "ipsum",
  "test",
  "testing",
  "xxx",
  "none",
  "n/a"
]);

const keyboardRuns = ["qwertyuiop", "asdfghjkl", "zxcvbnm"];

export type IntakeReviewReason =
  | "missing-claim"
  | "missing-evidence"
  | "too-long"
  | "contact-information"
  | "gibberish"
  | "batch-limit";

export type NeedsReviewResponse = {
  sourceLine: number;
  raw: string;
  reason: IntakeReviewReason;
  message: string;
};

export type AnonymousResponseScreening = {
  acceptedResponses: StudentResponse[];
  needsReview: NeedsReviewResponse[];
  minimumAcceptedResponses: number;
  canImport: boolean;
};

export type ScreeningOptions = {
  /**
   * Use at the final import action. Screening still returns recoverable rows in
   * normal mode, while this option refuses a session with fewer than three
   * usable responses.
   */
  requireMinimumAccepted?: boolean;
};

function initialViewpoint(claim: string, evidence: string): ViewpointKey {
  const text = `${claim} ${evidence}`.toLowerCase();
  if (/(air|shape|surface|resist|friction|wind|condition|context)/.test(text)) return "air";
  if (/(same|together|equal|both|accelerat|mass)/.test(text)) return "gravity";
  return "weight";
}

function hasContactInformation(value: string): boolean {
  return emailPattern.test(value) || phonePattern.test(value);
}

/**
 * Intentionally conservative: a row is only called gibberish when a claim or
 * evidence field is plainly a filler token, a keyboard run, repeated noise, or
 * contains no letters at all. Ambiguous student thinking stays for teacher
 * review rather than being discarded by the app.
 */
function isClearlyGibberish(value: string): boolean {
  const normalized = value.trim().toLowerCase();
  const compact = normalized.replace(/[^a-z0-9]/g, "");

  if (!/[a-z]/.test(normalized)) return true;
  if (fillerTerms.has(normalized) || /^([a-z0-9])\1{2,}$/.test(compact)) return true;

  return keyboardRuns.some((run) => {
    const reversed = run.split("").reverse().join("");
    return compact.length >= 3 && (run.includes(compact) || reversed.includes(compact));
  });
}

function createImportedResponse(claim: string, evidence: string, index: number): StudentResponse {
  return {
    id: `imported-${index + 1}`,
    alias: `Response ${String(index + 1).padStart(2, "0")}`,
    claim,
    evidence,
    confidence: 0,
    viewpoint: initialViewpoint(claim, evidence)
  };
}

function reviewItem(sourceLine: number, raw: string, reason: IntakeReviewReason, message: string): NeedsReviewResponse {
  return { sourceLine, raw, reason, message };
}

/**
 * Parses a deliberately small, privacy-first teacher import format:
 * one anonymous `claim | evidence` response per line.
 */
export function parseAnonymousResponses(rawText: string): StudentResponse[] {
  const lines = rawText.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (lines.length < 3) throw new Error("Add at least three anonymous responses to form a discussion.");
  if (lines.length > maximumResponsesPerImport) throw new Error("Import up to 30 responses at a time for a teacher-reviewable session.");

  return lines.map((line, index) => {
    const [claimPart, ...evidenceParts] = line.split("|");
    const claim = claimPart?.trim();
    const evidence = evidenceParts.join("|").trim();
    if (!claim || !evidence) throw new Error(`Line ${index + 1} needs both a claim and evidence, separated by |.`);
    if (claim.length > 500 || evidence.length > 500) throw new Error(`Line ${index + 1} is too long. Keep each field under 500 characters.`);
    if (hasContactInformation(line)) throw new Error(`Line ${index + 1} appears to contain contact information. Remove it before importing.`);
    return createImportedResponse(claim, evidence, index);
  });
}

/**
 * Deterministically screens a teacher's paste before any model call. Valid,
 * de-identified claim/evidence pairs are returned separately from rows that a
 * teacher can repair. Nothing in `needsReview` enters the approved response
 * set or downstream GPT-5.6 analysis.
 */
export function screenAnonymousResponses(rawText: string, options: ScreeningOptions = {}): AnonymousResponseScreening {
  const lines = rawText.split(/\r?\n/);
  const acceptedResponses: StudentResponse[] = [];
  const needsReview: NeedsReviewResponse[] = [];

  lines.forEach((source, lineIndex) => {
    const raw = source.trim();
    if (!raw) return;

    if (acceptedResponses.length >= maximumResponsesPerImport) {
      needsReview.push(reviewItem(
        lineIndex + 1,
        raw,
        "batch-limit",
        "This session already has 30 accepted responses. Start a new import for this row."
      ));
      return;
    }

    const [claimPart, ...evidenceParts] = raw.split("|");
    const claim = claimPart?.trim() ?? "";
    const evidence = evidenceParts.join("|").trim();

    if (!claim) {
      needsReview.push(reviewItem(lineIndex + 1, raw, "missing-claim", "Add a short claim before the | separator."));
      return;
    }

    if (!evidence) {
      needsReview.push(reviewItem(lineIndex + 1, raw, "missing-evidence", "Add evidence after the | separator."));
      return;
    }

    if (claim.length > 500 || evidence.length > 500) {
      needsReview.push(reviewItem(lineIndex + 1, raw, "too-long", "Keep each claim and evidence field under 500 characters."));
      return;
    }

    if (hasContactInformation(raw)) {
      needsReview.push(reviewItem(lineIndex + 1, raw, "contact-information", "Remove contact information before using this anonymous response."));
      return;
    }

    if (isClearlyGibberish(claim) || isClearlyGibberish(evidence)) {
      needsReview.push(reviewItem(lineIndex + 1, raw, "gibberish", "Replace placeholder or unreadable text with a meaningful claim and evidence."));
      return;
    }

    acceptedResponses.push(createImportedResponse(claim, evidence, acceptedResponses.length));
  });

  const screening: AnonymousResponseScreening = {
    acceptedResponses,
    needsReview,
    minimumAcceptedResponses,
    canImport: acceptedResponses.length >= minimumAcceptedResponses
  };

  if (options.requireMinimumAccepted && !screening.canImport) {
    throw new Error(`Keep at least ${minimumAcceptedResponses} accepted anonymous responses before importing.`);
  }

  return screening;
}

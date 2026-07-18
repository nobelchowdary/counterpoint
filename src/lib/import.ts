import type { StudentResponse, ViewpointKey } from "./types";

const emailPattern = /\b[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}\b/;
const phonePattern = /(?:\+?\d[\d .()-]{7,}\d)/;

function initialViewpoint(claim: string, evidence: string): ViewpointKey {
  const text = `${claim} ${evidence}`.toLowerCase();
  if (/(air|shape|surface|resist|friction|wind|condition|context)/.test(text)) return "air";
  if (/(same|together|equal|both|accelerat|mass)/.test(text)) return "gravity";
  return "weight";
}

/**
 * Parses a deliberately small, privacy-first teacher import format:
 * one anonymous `claim | evidence` response per line.
 */
export function parseAnonymousResponses(rawText: string): StudentResponse[] {
  const lines = rawText.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (lines.length < 3) throw new Error("Add at least three anonymous responses to form a discussion.");
  if (lines.length > 30) throw new Error("Import up to 30 responses at a time for a teacher-reviewable session.");

  return lines.map((line, index) => {
    const [claimPart, ...evidenceParts] = line.split("|");
    const claim = claimPart?.trim();
    const evidence = evidenceParts.join("|").trim();
    if (!claim || !evidence) throw new Error(`Line ${index + 1} needs both a claim and evidence, separated by |.`);
    if (claim.length > 500 || evidence.length > 500) throw new Error(`Line ${index + 1} is too long. Keep each field under 500 characters.`);
    if (emailPattern.test(line) || phonePattern.test(line)) throw new Error(`Line ${index + 1} appears to contain contact information. Remove it before importing.`);
    return {
      id: `imported-${index + 1}`,
      alias: `Response ${String(index + 1).padStart(2, "0")}`,
      claim,
      evidence,
      confidence: 0,
      viewpoint: initialViewpoint(claim, evidence)
    };
  });
}

export type ExitTicketShift = "changed" | "strengthened" | "still-thinking";

/**
 * A deliberately minimal, aggregate-friendly representation of an exit ticket.
 * It contains no student name, claim, evidence text, or grading data.
 */
export type ExitTicket = {
  id: string;
  shift: ExitTicketShift;
  namedNewEvidence: boolean;
};

export type ImpactSummary = {
  total: number;
  changed: number;
  strengthened: number;
  stillThinking: number;
  namedNewEvidence: number;
  changedOrStrengthened: number;
  changedOrStrengthenedPercent: number;
  namedNewEvidencePercent: number;
};

/**
 * Returns a whole-number percentage and is safe for an empty class or a
 * partially submitted exit-ticket set.
 */
export function safePercent(numerator: number, denominator: number): number {
  if (denominator <= 0) {
    return 0;
  }

  return Math.round((numerator / denominator) * 100);
}

/**
 * Builds an aggregate formative snapshot. These are learner self-reports, not
 * scores or proof that a class has mastered the lesson.
 */
export function createImpactSummary(tickets: readonly ExitTicket[]): ImpactSummary {
  const summary = tickets.reduce<Omit<ImpactSummary, "total" | "changedOrStrengthened" | "changedOrStrengthenedPercent" | "namedNewEvidencePercent">>(
    (counts, ticket) => {
      if (ticket.shift === "changed") {
        counts.changed += 1;
      } else if (ticket.shift === "strengthened") {
        counts.strengthened += 1;
      } else {
        counts.stillThinking += 1;
      }

      if (ticket.namedNewEvidence) {
        counts.namedNewEvidence += 1;
      }

      return counts;
    },
    { changed: 0, strengthened: 0, stillThinking: 0, namedNewEvidence: 0 }
  );

  const total = tickets.length;
  const changedOrStrengthened = summary.changed + summary.strengthened;

  return {
    total,
    ...summary,
    changedOrStrengthened,
    changedOrStrengthenedPercent: safePercent(changedOrStrengthened, total),
    namedNewEvidencePercent: safePercent(summary.namedNewEvidence, total)
  };
}

// Staged, synthetic, anonymous demo data only — never a student record.
export const demoExitTickets: ExitTicket[] = [
  { id: "demo-exit-01", shift: "changed", namedNewEvidence: true },
  { id: "demo-exit-02", shift: "changed", namedNewEvidence: true },
  { id: "demo-exit-03", shift: "changed", namedNewEvidence: true },
  { id: "demo-exit-04", shift: "changed", namedNewEvidence: true },
  { id: "demo-exit-05", shift: "changed", namedNewEvidence: true },
  { id: "demo-exit-06", shift: "strengthened", namedNewEvidence: true },
  { id: "demo-exit-07", shift: "strengthened", namedNewEvidence: true },
  { id: "demo-exit-08", shift: "strengthened", namedNewEvidence: true },
  { id: "demo-exit-09", shift: "still-thinking", namedNewEvidence: true },
  { id: "demo-exit-10", shift: "still-thinking", namedNewEvidence: true },
  { id: "demo-exit-11", shift: "still-thinking", namedNewEvidence: false },
  { id: "demo-exit-12", shift: "still-thinking", namedNewEvidence: false }
];

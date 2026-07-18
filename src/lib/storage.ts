import type { CounterpointDraft } from "./types";

const draftKey = "counterpoint.teacher-draft.v1";

export function loadDraft(): CounterpointDraft | null {
  if (typeof window === "undefined") return null;
  try {
    const saved = window.localStorage.getItem(draftKey);
    return saved ? JSON.parse(saved) as CounterpointDraft : null;
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

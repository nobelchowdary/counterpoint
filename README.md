# Counterpoint

**AI-orchestrated peer learning for classrooms.**

Counterpoint turns a class’s short written answers into anonymous, teacher-approved peer discussions. It helps students defend, test, and revise their own reasoning instead of receiving a model answer from a chatbot.

![Counterpoint flow](https://img.shields.io/badge/flow-teacher%20review%20%E2%86%92%20peer%20discussion%20%E2%86%92%20evidence-252b3b)

> The included classroom is a fictional, de-identified fixture. The complete demo runs without an account, API key, or network request.

## What works now

1. A teacher can edit a learning goal and discussion question, or paste 3–30 anonymous `claim | evidence` responses for a new local session. The import view has a safe sample, an explicit de-identification confirmation, and explains that drafts stay in the current browser.
2. A review studio keeps every anonymous response linked to a viewpoint. Teachers can rename patterns, mark each pathway reviewed, move evidence between pathways, exclude a weak source without deleting it, restore it later, or merge pathways before approval.
3. The thinking map cannot advance until the teacher has reviewed all three pathways and explicitly approved it for class. Mixed-reasoning groups are then generated deterministically, and teachers can lock or rebalance them.
4. A teacher can edit and approve a four-step evidence discussion protocol.
5. The student-facing classroom card shows anonymous claims *and their evidence*, a visible eight-minute discussion timer, an explicit “what would change your mind?” prompt, and no model answer.
6. The independent two-question exit ticket asks for a best claim and the evidence that mattered, then lets a learner indicate whether their thinking changed, strengthened, or is still developing.
7. The impact loop records only an actual submitted exit ticket—not an invented class-wide outcome—and can copy or download a teacher-owned text note.
8. Teacher edits persist locally in the browser. The reset icon in the upper-right restores the fixture. The layout is responsive for a tablet or phone demo.

## 60-second judge demo

1. Select **Reveal the thinking**.
2. In the review studio, click each pathway, show the linked evidence, then mark all three as reviewed. Point out that a teacher can move, exclude, restore, or merge evidence before approval.
3. Select **Approve map for class**, then **Build discussion groups** and **Approve groups for class**.
4. Open the **classroom group card**. Start the timer and show that students receive anonymous claims, evidence, and a productive counterpoint question—not an answer from AI.
5. Save the two-question exit ticket to reveal the impact loop and the teacher-owned formative note.

## Run locally

```bash
npm install
npm run dev
```

Open the local URL shown in the terminal. The default experience is intentionally usable offline as a high-confidence demo.

## Check it

```bash
npm test
npm run build
```

The tests cover transparent grouping, the analysis response contract, and evidence-note safeguards.

## Optional GPT-5.6 analysis route

The client never receives an API key. When deployed on Vercel, [`api/analyze.ts`](api/analyze.ts) exposes a server-side `POST /api/analyze` route that:

- sends only response IDs, claims, and evidence to the model — no names or student records;
- requests a structured JSON result from the Responses API using `gpt-5.6-terra` by default;
- requires all responses to be assigned to a reviewable viewpoint;
- asks for a teacher move, student prompt, and discussion protocol, while prohibiting grading, diagnosis, identity inference, or a direct answer;
- validates the result in the browser before it changes the teacher-facing map.

Set these secrets in the deployment provider (never in client code or Git):

```bash
OPENAI_API_KEY=...
OPENAI_MODEL=gpt-5.6-terra
```

Without the server secret, the route returns a clear message and the app automatically falls back to the deterministic fixture. That makes a judgeable demo reliable while keeping a real GPT-5.6 integration path ready for deployment.

## Architecture

```text
anonymous responses
        │
        ├── optional GPT-5.6 reasoning map (server-side, structured)
        │                                      │
        └── deterministic grouping rule ───────┘
                                               │
teacher reviews / edits / approves ──→ timed classroom evidence discussion
                                               │
                         two-question exit ticket / reasoning signal
                                               │
                                  editable formative evidence note
```

- [`src/lib/grouping.ts`](src/lib/grouping.ts) owns transparent student-group placement; the model never silently controls grouping.
- [`src/lib/analysis.ts`](src/lib/analysis.ts) validates any model result and owns the reliable offline fallback.
- [`src/lib/import.ts`](src/lib/import.ts) accepts a small, teacher-confirmed import format, assigns neutral aliases in the UI, and blocks obvious email/phone contact details. Teachers must remove all identifiers before pasting.
- [`src/lib/review.ts`](src/lib/review.ts) owns recoverable source exclusion, source re-sorting, and the three-path review gate.
- [`src/lib/evidence.ts`](src/lib/evidence.ts) generates a plain-text note that explicitly avoids grades and student records.
- [`src/lib/storage.ts`](src/lib/storage.ts) saves only the current local demo draft in browser storage.

## Safety and scope

Counterpoint is a formative peer-learning prototype. It is **not** a grading system, compliance workflow, IEP generator, student-record system, or diagnosis tool. Use only de-identified, authorized classroom data in a future pilot, and require teacher review before publishing any model-assisted wording to students.

## OpenAI Build Week

This project was built in Codex with GPT-5.6 as a constrained classroom reasoning mapper: structured, source-linked, teacher-editable, and never the final voice to a student.

Before submission, add the deployed demo URL, demo video URL, and the `/feedback` session ID from the primary build task to the Devpost submission.

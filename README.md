# Counterpoint

**AI-orchestrated peer learning for classrooms.**

Counterpoint turns a class’s short written answers into anonymous, teacher-approved peer discussions. It helps students defend, test, and revise their own reasoning instead of receiving a model answer from a chatbot.

> This repository currently contains the polished, deterministic demo flow for the OpenAI Build Week submission. It uses fictional, de-identified student responses and requires no account or API key to run.

## What the demo proves

1. A teacher launches a formative prompt with 12 fictional student responses.
2. A teacher reviews an anonymous thinking map with traceable source responses.
3. A deterministic grouping engine creates mixed-reasoning groups.
4. A teacher approves a discussion protocol before students see anything.
5. A student preview captures a revised claim and evidence.
6. A teacher receives an editable evidence timeline and next instructional move.

## Run locally

```bash
npm install
npm run dev
```

Open the local URL shown in your terminal.

## Test and build

```bash
npm test
npm run build
```

## Architecture

- `src/lib/demo-data.ts` contains the fictional, de-identified classroom fixture.
- `src/lib/grouping.ts` owns transparent student-group placement. The production model may classify anonymous reasoning, but it does not secretly decide the groups.
- `tests/grouping.test.ts` checks group size, membership, and viewpoint diversity.
- `src/main.tsx` contains the runnable teacher and student demo flow.

## GPT-5.6 integration plan

The next implementation slice adds a server-side GPT-5.6 analysis path that returns schema-validated, source-linked viewpoint labels and a teacher-editable discussion protocol. The app will preserve this demo mode so judges can always test it without an API key.

No live student data should be entered into this prototype. Counterpoint is not a grading, compliance, IEP, or student-record system.

## Built with Codex and GPT-5.6

This project is being built in a primary Codex task for OpenAI Build Week. Before submitting, this README will be updated with the actual development chronicle, prompt/version details, deployed demo URL, and the `/feedback` Session ID from the core build task.


import { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  lesson as demoLesson,
  nextMove as demoNextMove,
  protocol as demoProtocol,
  responses as demoResponses,
  studentPrompt as demoStudentPrompt,
  teacherMove as demoTeacherMove,
  viewpoints as demoViewpoints
} from "./lib/demo-data";
import { createImportedReviewAnalysis, createOfflineReviewAnalysis, requestAnalysis } from "./lib/analysis";
import { countReasoningPaths, createEvidenceNote } from "./lib/evidence";
import { createDiverseGroups } from "./lib/grouping";
import { parseAnonymousResponses } from "./lib/import";
import { clearDraft, loadDraft, saveDraft } from "./lib/storage";
import type {
  AnalysisResult,
  CounterpointDraft,
  DiscussionGroup,
  Lesson,
  ProtocolStep,
  Revision,
  StudentResponse,
  Viewpoint,
  ViewpointKey
} from "./lib/types";
import "./styles.css";

type Stage = "launch" | "map" | "groups" | "protocol" | "evidence";
type AnalysisState = "idle" | "loading" | "live" | "demo";

const stageMeta: Array<{ id: Stage; label: string; number: string }> = [
  { id: "launch", label: "Launch", number: "01" },
  { id: "map", label: "Thinking map", number: "02" },
  { id: "groups", label: "Groups", number: "03" },
  { id: "protocol", label: "Discuss", number: "04" },
  { id: "evidence", label: "Evidence", number: "05" }
];

const icon = {
  spark: "✦",
  arrow: "→",
  check: "✓",
  shield: "◌",
  people: "◒",
  edit: "↗",
  lock: "⌁"
};

function createInitialDraft(): CounterpointDraft {
  return {
    lesson: { ...demoLesson },
    responses: demoResponses.map((response) => ({ ...response })),
    viewpoints: demoViewpoints.map((viewpoint) => ({ ...viewpoint })),
    protocol: demoProtocol.map((step) => ({ ...step })),
    teacherMove: demoTeacherMove,
    studentPrompt: demoStudentPrompt,
    nextMove: demoNextMove,
    updatedAt: new Date().toISOString()
  };
}

function App() {
  const [initialDraft] = useState<CounterpointDraft>(() => loadDraft() ?? createInitialDraft());
  const [stage, setStage] = useState<Stage>("launch");
  const [furthestStage, setFurthestStage] = useState(0);
  const [lesson, setLesson] = useState<Lesson>(initialDraft.lesson);
  const [responses, setResponses] = useState<StudentResponse[]>(initialDraft.responses);
  const [viewpoints, setViewpoints] = useState<Viewpoint[]>(initialDraft.viewpoints);
  const [protocol, setProtocol] = useState<ProtocolStep[]>(initialDraft.protocol);
  const [teacherMove, setTeacherMove] = useState(initialDraft.teacherMove);
  const [studentPrompt, setStudentPrompt] = useState(initialDraft.studentPrompt);
  const [nextMove, setNextMove] = useState(initialDraft.nextMove);
  const [revision, setRevision] = useState<Revision | undefined>(initialDraft.revision);
  const [activeViewpoint, setActiveViewpoint] = useState<ViewpointKey>("weight");
  const [rotation, setRotation] = useState(0);
  const [groups, setGroups] = useState<DiscussionGroup[]>(() => createDiverseGroups(initialDraft.responses));
  const [lockedGroupIds, setLockedGroupIds] = useState<string[]>([]);
  const [approved, setApproved] = useState(false);
  const [studentPreview, setStudentPreview] = useState(false);
  const [analysisState, setAnalysisState] = useState<AnalysisState>("idle");
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    saveDraft({
      lesson,
      responses,
      viewpoints,
      protocol,
      teacherMove,
      studentPrompt,
      nextMove,
      revision,
      updatedAt: new Date().toISOString()
    });
  }, [lesson, responses, viewpoints, protocol, teacherMove, studentPrompt, nextMove, revision]);

  useEffect(() => {
    if (!toast) return undefined;
    const timer = window.setTimeout(() => setToast(null), 5500);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const currentIndex = stageMeta.findIndex((item) => item.id === stage);
  const hasImportedResponses = responses.some((response) => response.id.startsWith("imported-"));
  const stageLabel = analysisState === "live" ? "GPT-5.6 map" : hasImportedResponses ? "Teacher import" : "Demo data";

  const advanceTo = (target: Stage) => {
    const index = stageMeta.findIndex((item) => item.id === target);
    setFurthestStage((value) => Math.max(value, index));
    setStage(target);
  };

  const applyAnalysis = (analysis: AnalysisResult, sourceResponses = responses, groupRotation = rotation) => {
    const remappedResponses = sourceResponses.map((response) => ({
      ...response,
      viewpoint: analysis.responseViewpoints[response.id] ?? response.viewpoint
    }));
    setResponses(remappedResponses);
    setViewpoints(analysis.viewpoints);
    setProtocol(analysis.protocol);
    setTeacherMove(analysis.teacherMove);
    setStudentPrompt(analysis.studentPrompt);
    setNextMove(analysis.nextMove);
    setGroups(createDiverseGroups(remappedResponses, groupRotation));
    setLockedGroupIds([]);
  };

  const runAnalysis = async () => {
    setAnalysisState("loading");
    try {
      const analysis = await requestAnalysis({ lesson, responses });
      applyAnalysis(analysis);
      setAnalysisState("live");
      setToast("GPT-5.6 analysis is ready for teacher review. No student-facing text was published.");
    } catch (error) {
      applyAnalysis(createOfflineReviewAnalysis(responses));
      setAnalysisState("demo");
      const reason = error instanceof Error ? error.message : "The secure analysis route is unavailable.";
      setToast(`${reason} Showing the reviewable fixture map instead.`);
    }
  };

  const rebalanceGroups = () => {
    if (lockedGroupIds.length > 0) {
      setToast("Unlock the locked groups before rebalancing, so no approved grouping is overwritten.");
      return;
    }
    const nextRotation = rotation + 1;
    setRotation(nextRotation);
    setGroups(createDiverseGroups(responses, nextRotation));
    setToast("Groups were rebalanced with the same transparent diversity rule.");
  };

  const updateViewpoint = (id: ViewpointKey, patch: Partial<Omit<Viewpoint, "id" | "color">>) => {
    setViewpoints((items) => items.map((item) => item.id === id ? { ...item, ...patch } : item));
    setToast("Viewpoint wording saved locally. Source responses remain unchanged.");
  };

  const importAnonymousResponses = (rawText: string) => {
    const importedResponses = parseAnonymousResponses(rawText);
    setRotation(0);
    setRevision(undefined);
    setApproved(false);
    setStudentPreview(false);
    setActiveViewpoint("weight");
    setAnalysisState("demo");
    applyAnalysis(createImportedReviewAnalysis(importedResponses), importedResponses, 0);
    advanceTo("map");
    setToast(`${importedResponses.length} anonymous responses imported. Review the local draft map, rename it, or run GPT-5.6 before sharing anything.`);
  };

  const restart = () => {
    setStage("launch");
    setFurthestStage(0);
    setApproved(false);
    setStudentPreview(false);
    setRevision(undefined);
    setRotation(0);
    setGroups(createDiverseGroups(responses));
    setLockedGroupIds([]);
    setToast("The discussion flow restarted. Your teacher edits remain saved locally.");
  };

  const resetSavedDemo = () => {
    clearDraft();
    window.location.reload();
  };

  const groupForPreview = useMemo(() => groups[2] ?? groups[0], [groups]);

  return (
    <main className="app-shell">
      <aside className="rail">
        <a className="brand" href="#top" aria-label="Counterpoint home">
          <span className="brand-mark">C</span>
          <span>counterpoint</span>
        </a>
        <div className="rail-rule" />
        <nav className="stage-nav" aria-label="Demo steps">
          {stageMeta.map((item, index) => (
            <button
              className={`stage-link ${stage === item.id ? "active" : ""} ${index <= furthestStage ? "seen" : ""}`}
              key={item.id}
              onClick={() => index <= furthestStage && setStage(item.id)}
              disabled={index > furthestStage}
            >
              <span>{item.number}</span>{item.label}
            </button>
          ))}
        </nav>
        <div className="rail-bottom">
          <div className="avatar">MN</div>
          <div><strong>Ms. Nguyen</strong><small>Grade 8 science</small></div>
        </div>
      </aside>

      <section className="workspace" id="top">
        <header className="topbar">
          <div className="crumb"><span className="dot" />Demo classroom <span>/</span> {lesson.title}</div>
          <div className="topbar-right">
            <span className={`demo-pill ${analysisState === "live" ? "live-pill" : ""}`}>{stageLabel}</span>
            <button className="help" aria-label="Reset saved demo" title="Reset saved demo" onClick={resetSavedDemo}>↺</button>
          </div>
        </header>

        <section className="content">
          {stage === "launch" && <Launch lesson={lesson} responseCount={responses.length} hasImportedResponses={hasImportedResponses} onSaveLesson={setLesson} onImportResponses={importAnonymousResponses} onBegin={() => advanceTo("map")} />}
          {stage === "map" && <ThinkingMap
            activeViewpoint={activeViewpoint}
            onSelect={setActiveViewpoint}
            lesson={lesson}
            viewpoints={viewpoints}
            responses={responses}
            analysisState={analysisState}
            hasImportedResponses={hasImportedResponses}
            onRunAnalysis={runAnalysis}
            onSaveViewpoint={updateViewpoint}
            onContinue={() => advanceTo("groups")}
          />}
          {stage === "groups" && <Groups
            groups={groups}
            viewpoints={viewpoints}
            lockedGroupIds={lockedGroupIds}
            onToggleLock={(id) => setLockedGroupIds((ids) => ids.includes(id) ? ids.filter((item) => item !== id) : [...ids, id])}
            onRebalance={rebalanceGroups}
            onApprove={() => { setApproved(true); advanceTo("protocol"); }}
          />}
          {stage === "protocol" && <Protocol
            approved={approved}
            protocol={protocol}
            teacherMove={teacherMove}
            studentPrompt={studentPrompt}
            nextMove={nextMove}
            onSave={({ protocol: nextProtocol, teacherMove: nextTeacherMove, studentPrompt: nextStudentPrompt, nextMove: nextNextMove }) => {
              setProtocol(nextProtocol);
              setTeacherMove(nextTeacherMove);
              setStudentPrompt(nextStudentPrompt);
              setNextMove(nextNextMove);
              setToast("Discussion plan saved. Students only see the teacher-approved version.");
            }}
            studentPreview={studentPreview}
            setStudentPreview={setStudentPreview}
            group={groupForPreview}
            viewpoints={viewpoints}
            onComplete={(nextRevision) => { setRevision(nextRevision); advanceTo("evidence"); }}
          />}
          {stage === "evidence" && <Evidence
            lesson={lesson}
            responses={responses}
            revision={revision}
            nextMove={nextMove}
            onNotify={setToast}
            onRestart={restart}
          />}
        </section>
      </section>
      {toast && <div className="toast" role="status">{toast}</div>}
    </main>
  );
}

function Launch({ lesson, responseCount, hasImportedResponses, onSaveLesson, onImportResponses, onBegin }: {
  lesson: Lesson;
  responseCount: number;
  hasImportedResponses: boolean;
  onSaveLesson: (lesson: Lesson) => void;
  onImportResponses: (rawText: string) => void;
  onBegin: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [draft, setDraft] = useState(lesson);
  const [rawResponses, setRawResponses] = useState("");
  const [privacyConfirmed, setPrivacyConfirmed] = useState(false);
  const [importError, setImportError] = useState("");

  const openEditor = () => {
    setDraft(lesson);
    setImporting(false);
    setEditing(true);
  };

  const openImporter = () => {
    setEditing(false);
    setImportError("");
    setImporting(true);
  };

  const save = () => {
    if (!draft.title.trim() || !draft.learningGoal.trim() || !draft.question.trim()) return;
    onSaveLesson({ title: draft.title.trim(), learningGoal: draft.learningGoal.trim(), question: draft.question.trim() });
    setEditing(false);
  };

  const importResponses = () => {
    if (!privacyConfirmed) {
      setImportError("Confirm that you removed names and identifying details before importing.");
      return;
    }
    try {
      onImportResponses(rawResponses);
      setImporting(false);
    } catch (error) {
      setImportError(error instanceof Error ? error.message : "Counterpoint could not import those responses.");
    }
  };

  return <div className="launch-wrap fade-in">
    <div className="eyebrow">A ten-minute formative conversation</div>
    <h1>Make the thinking<br />in the room useful<br />to the room.</h1>
    <p className="lede">Counterpoint turns a class’s written reasoning into an anonymous, teacher-approved peer conversation — not another answer from a bot.</p>
    <div className="lesson-card">
      <div className="lesson-head"><span>Today’s learning goal</span><span className="lesson-actions"><button className="inline-action" onClick={openImporter}>Paste responses</button><button className="inline-action" onClick={openEditor}>Edit goal {icon.edit}</button></span></div>
      {importing ? <div className="lesson-editor import-editor">
        <div className="import-guidance"><strong>Paste anonymous responses</strong><p>One response per line: <code>claim | evidence</code>. Do not include names, emails, IDs, or contact details.</p><pre>They land together | Both objects are pulled down at the same time.
Air could matter | A wider shape may be slowed more by air.
The heavier one lands first | It seems to have more downward force.</pre></div>
        <label htmlFor="anonymous-responses">Anonymous responses<textarea id="anonymous-responses" value={rawResponses} onChange={(event) => setRawResponses(event.target.value)} placeholder="Claim | Evidence" /></label>
        <label className="privacy-check"><input type="checkbox" checked={privacyConfirmed} onChange={(event) => setPrivacyConfirmed(event.target.checked)} /> I confirm I removed names and identifying information.</label>
        {importError && <p className="form-error">{importError}</p>}
        <div className="form-actions"><button className="outline" onClick={() => setImporting(false)}>Cancel</button><button className="primary" onClick={importResponses}>Import for review <span>{icon.arrow}</span></button></div>
      </div> : editing ? <div className="lesson-editor">
        <label>Lesson title<input value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} /></label>
        <label>Learning goal<textarea value={draft.learningGoal} onChange={(event) => setDraft({ ...draft, learningGoal: event.target.value })} /></label>
        <label>Discussion question<textarea value={draft.question} onChange={(event) => setDraft({ ...draft, question: event.target.value })} /></label>
        <div className="form-actions"><button className="outline" onClick={() => setEditing(false)}>Cancel</button><button className="primary" onClick={save}>Save goal <span>{icon.check}</span></button></div>
      </div> : <>
        <p>{lesson.learningGoal}</p>
        <div className="prompt-box"><span>Question</span><strong>{lesson.question}</strong></div>
      </>}
      <div className="response-row"><div className="response-stack">{Array.from({ length: Math.min(responseCount, 5) }).map((_, index) => <span key={index} style={{ transform: `rotate(${(index - 2) * 3}deg) translateX(${index * 5}px)` }} />)}</div><div><strong>{responseCount} responses ready</strong><small>{hasImportedResponses ? "Teacher-imported, locally stored reasoning" : "Fictional, de-identified classroom reasoning"}</small></div></div>
    </div>
    <div className="trust-row"><span><b>{icon.shield}</b> Teacher review before sharing</span><span><b>{icon.check}</b> No grades or learner labels</span><span><b>{icon.spark}</b> Evidence stays editable</span></div>
    <div className="launch-actions"><button className="primary" onClick={onBegin}>Reveal the thinking <span>{icon.arrow}</span></button><p><span>{icon.shield}</span> Nothing reaches students without your review.</p></div>
  </div>;
}

function ThinkingMap({ activeViewpoint, onSelect, lesson, viewpoints, responses, analysisState, hasImportedResponses, onRunAnalysis, onSaveViewpoint, onContinue }: {
  activeViewpoint: ViewpointKey;
  onSelect: (id: ViewpointKey) => void;
  lesson: Lesson;
  viewpoints: Viewpoint[];
  responses: StudentResponse[];
  analysisState: AnalysisState;
  hasImportedResponses: boolean;
  onRunAnalysis: () => void;
  onSaveViewpoint: (id: ViewpointKey, patch: Partial<Omit<Viewpoint, "id" | "color">>) => void;
  onContinue: () => void;
}) {
  const active = viewpoints.find((viewpoint) => viewpoint.id === activeViewpoint) ?? viewpoints[0];
  const selectedResponses = responses.filter((response) => response.viewpoint === active.id);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({ title: active.title, badge: active.badge, summary: active.summary, teacherNote: active.teacherNote });

  useEffect(() => {
    setEditing(false);
    setDraft({ title: active.title, badge: active.badge, summary: active.summary, teacherNote: active.teacherNote });
  }, [active]);

  const save = () => {
    if (!draft.title.trim() || !draft.summary.trim() || !draft.teacherNote.trim()) return;
    onSaveViewpoint(active.id, {
      title: draft.title.trim(),
      badge: draft.badge.trim() || "Reasoning path",
      summary: draft.summary.trim(),
      teacherNote: draft.teacherNote.trim()
    });
    setEditing(false);
  };

  const analysisLabel = analysisState === "loading" ? "Mapping reasoning…" : analysisState === "live" ? "Refresh GPT-5.6 map" : "Run secure GPT-5.6 analysis";
  return <div className="fade-in">
    <PageIntro eyebrow="Step 02 / Teacher review" title="Three ways your class is thinking." text={analysisState === "live" ? "GPT-5.6 grouped the anonymous reasoning into reviewable viewpoints. You control every label, note, and next step before anything is shared." : hasImportedResponses ? "Counterpoint created a transparent local draft map from the anonymous teacher import. Rename every viewpoint, or run GPT-5.6, before sharing anything with students." : "Review the fictional reasoning map below, or connect the optional secure GPT-5.6 analysis route. Every interpretation stays traceable to its source response."} />
    <div className="analysis-toolbar"><div><span className="tiny-label">Reasoning map</span><strong>{analysisState === "live" ? "GPT-5.6 structured result — awaiting teacher review" : hasImportedResponses ? "Local draft categories — teacher review required" : "Deterministic fixture — always available for a demo"}</strong></div><button className="outline" onClick={onRunAnalysis} disabled={analysisState === "loading"}>{analysisLabel}</button></div>
    <div className="map-layout">
      <div className="viewpoint-grid">
        {viewpoints.map((viewpoint, index) => {
          const count = responses.filter((response) => response.viewpoint === viewpoint.id).length;
          return <button className={`viewpoint-card ${viewpoint.color} ${activeViewpoint === viewpoint.id ? "selected" : ""}`} key={viewpoint.id} onClick={() => onSelect(viewpoint.id)}>
            <span className="card-index">0{index + 1}</span><span className="view-dot" /><span className="viewpoint-count">{count} learners</span>
            <h2>{viewpoint.title}</h2><p>{viewpoint.summary}</p><div className="card-footer"><span>{viewpoint.badge}</span><span>{icon.arrow}</span></div>
          </button>;
        })}
      </div>
      <aside className={`insight-panel ${active.color}`}>
        <div className="panel-kicker"><span className="view-dot" />Teacher lens</div>
        {editing ? <div className="dark-editor">
          <label>Viewpoint title<input value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} /></label>
          <label>Short label<input value={draft.badge} onChange={(event) => setDraft({ ...draft, badge: event.target.value })} /></label>
          <label>Teacher-facing summary<textarea value={draft.summary} onChange={(event) => setDraft({ ...draft, summary: event.target.value })} /></label>
          <label>Teacher move<textarea value={draft.teacherNote} onChange={(event) => setDraft({ ...draft, teacherNote: event.target.value })} /></label>
          <div className="form-actions"><button className="dark-cancel" onClick={() => setEditing(false)}>Cancel</button><button className="dark-save" onClick={save}>Save wording</button></div>
        </div> : <>
          <h3>{active.title}</h3><p>{active.teacherNote}</p>
          <div className="source-list"><span>Source responses</span>{selectedResponses.map((response) => <article key={response.id}><div className="source-avatar">{response.alias.slice(0, 1)}</div><div><strong>{response.claim}</strong><small>“{response.evidence}”</small></div></article>)}</div>
          <button className="quiet-button" onClick={() => setEditing(true)}>Edit viewpoint wording {icon.edit}</button>
        </>}
      </aside>
    </div>
    <div className="source-footnote"><span>{icon.shield}</span> {lesson.title}: summaries are editable interpretations; anonymous source reasoning stays visible to the teacher.</div>
    <div className="page-actions"><p><span>{icon.check}</span> All summaries link to source reasoning.</p><button className="primary" onClick={onContinue}>Build discussion groups <span>{icon.arrow}</span></button></div>
  </div>;
}

function Groups({ groups, viewpoints, lockedGroupIds, onToggleLock, onRebalance, onApprove }: {
  groups: DiscussionGroup[];
  viewpoints: Viewpoint[];
  lockedGroupIds: string[];
  onToggleLock: (id: string) => void;
  onRebalance: () => void;
  onApprove: () => void;
}) {
  return <div className="fade-in">
    <PageIntro eyebrow="Step 03 / Teacher review" title="Design for productive disagreement." text="Counterpoint balances distinct reasoning paths. Lock a group after reviewing it, or rebalance before students receive a prompt." />
    <div className="group-toolbar"><div><span className="tiny-label">Grouping rule</span><strong>One contrasting explanation per group, whenever the class distribution allows it</strong></div><button className="outline" onClick={onRebalance}>↻ Rebalance groups</button></div>
    <div className="groups-grid">
      {groups.map((group, index) => <GroupCard group={group} viewpoints={viewpoints} index={index} locked={lockedGroupIds.includes(group.id)} onToggleLock={() => onToggleLock(group.id)} key={group.id} />)}
    </div>
    <div className="group-note"><span>{icon.shield}</span><p><strong>Teacher approval required.</strong> The map never labels a learner correct or incorrect. Locking a group prevents a rebalance from replacing that reviewed composition.</p></div>
    <div className="page-actions"><p><span>{icon.people}</span> {groups.length} mixed groups, {groups.flatMap((group) => group.members).length} anonymous responses</p><button className="primary" onClick={onApprove}>Approve discussion plan <span>{icon.arrow}</span></button></div>
  </div>;
}

function GroupCard({ group, viewpoints, index, locked, onToggleLock }: {
  group: DiscussionGroup;
  viewpoints: Viewpoint[];
  index: number;
  locked: boolean;
  onToggleLock: () => void;
}) {
  const labels = group.members.map((member) => viewpoints.find((viewpoint) => viewpoint.id === member.viewpoint) ?? viewpoints[0]);
  return <article className={`group-card ${locked ? "locked" : ""}`}><div className="group-title"><span>Group {String.fromCharCode(65 + index)}</span><button className="lock-button" aria-label={`${locked ? "Unlock" : "Lock"} group ${index + 1}`} aria-pressed={locked} onClick={onToggleLock}>{icon.lock} {locked ? "Locked" : "Lock"}</button></div><div className="member-orbit">{group.members.map((member, memberIndex) => <div className={`member-token ${labels[memberIndex].color}`} key={member.id}><span>{member.alias.slice(0, 1)}</span><small>{labels[memberIndex].badge}</small></div>)}</div><p>{group.reason}</p><div className="group-labels">{labels.map((label) => <span className={label.color} key={label.id}>{label.title}</span>)}</div></article>;
}

function Protocol({ approved, protocol, teacherMove, studentPrompt, nextMove, onSave, studentPreview, setStudentPreview, group, viewpoints, onComplete }: {
  approved: boolean;
  protocol: ProtocolStep[];
  teacherMove: string;
  studentPrompt: string;
  nextMove: string;
  onSave: (content: { protocol: ProtocolStep[]; teacherMove: string; studentPrompt: string; nextMove: string }) => void;
  studentPreview: boolean;
  setStudentPreview: (value: boolean) => void;
  group: DiscussionGroup;
  viewpoints: Viewpoint[];
  onComplete: (revision: Revision) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draftSteps, setDraftSteps] = useState(protocol);
  const [draftTeacherMove, setDraftTeacherMove] = useState(teacherMove);
  const [draftPrompt, setDraftPrompt] = useState(studentPrompt);
  const [draftNextMove, setDraftNextMove] = useState(nextMove);

  if (studentPreview) return <StudentPreview group={group} viewpoints={viewpoints} prompt={studentPrompt} onBack={() => setStudentPreview(false)} onComplete={onComplete} />;

  const openEditor = () => {
    setDraftSteps(protocol.map((step) => ({ ...step })));
    setDraftTeacherMove(teacherMove);
    setDraftPrompt(studentPrompt);
    setDraftNextMove(nextMove);
    setEditing(true);
  };

  const save = () => {
    const trimmedSteps = draftSteps.map((step) => ({ ...step, title: step.title.trim(), description: step.description.trim(), duration: step.duration.trim() }));
    if (trimmedSteps.some((step) => !step.title || !step.description || !step.duration) || !draftTeacherMove.trim() || !draftPrompt.trim() || !draftNextMove.trim()) return;
    onSave({ protocol: trimmedSteps, teacherMove: draftTeacherMove.trim(), studentPrompt: draftPrompt.trim(), nextMove: draftNextMove.trim() });
    setEditing(false);
  };

  const updateStep = (index: number, patch: Partial<ProtocolStep>) => setDraftSteps((steps) => steps.map((step, stepIndex) => stepIndex === index ? { ...step, ...patch } : step));

  return <div className="fade-in">
    <PageIntro eyebrow="Step 04 / Teacher-approved protocol" title="Give students a reason to listen." text="The conversation asks students to test an explanation with evidence, not to vote for a right answer." />
    {editing ? <section className="protocol-editor">
      <div className="protocol-top"><div><span className="tiny-label">Edit discussion plan</span><h2>Teacher controls the words students see.</h2></div><button className="outline" onClick={() => setEditing(false)}>Cancel</button></div>
      <div className="step-editor-grid">{draftSteps.map((step, index) => <fieldset key={step.id}><legend>Step {String(index + 1).padStart(2, "0")}</legend><label>Action<input value={step.title} onChange={(event) => updateStep(index, { title: event.target.value })} /></label><label>Student direction<textarea value={step.description} onChange={(event) => updateStep(index, { description: event.target.value })} /></label><label>Time<input value={step.duration} onChange={(event) => updateStep(index, { duration: event.target.value })} /></label></fieldset>)}</div>
      <div className="teacher-fields"><label>Teacher move<textarea value={draftTeacherMove} onChange={(event) => setDraftTeacherMove(event.target.value)} /></label><label>Student prompt<textarea value={draftPrompt} onChange={(event) => setDraftPrompt(event.target.value)} /></label><label>Suggested next move<textarea value={draftNextMove} onChange={(event) => setDraftNextMove(event.target.value)} /></label></div>
      <div className="form-actions"><button className="outline" onClick={() => setEditing(false)}>Cancel</button><button className="primary" onClick={save}>Save discussion plan <span>{icon.check}</span></button></div>
    </section> : <>
      <div className="protocol-layout"><section className="protocol-card"><div className="protocol-top"><div><span className="tiny-label">Group protocol</span><h2>{studentPrompt}</h2></div><span className="duration">10 min</span></div><ol className="timeline">{protocol.map((step, index) => <li key={step.id}><span>{String(index + 1).padStart(2, "0")}</span><div><strong>{step.title}</strong><p>{step.description}</p></div><em>{step.duration}</em></li>)}</ol></section><aside className="protocol-side"><div className="approved-stamp">{approved ? icon.check : "…"}<span>{approved ? "Approved" : "Draft"}</span></div><h3>Teacher move</h3><p>{teacherMove}</p><div className="prompt-callout"><span>Student prompt</span><strong>“{studentPrompt}”</strong></div><button className="outline full" onClick={openEditor}>Edit discussion plan {icon.edit}</button></aside></div>
      <div className="page-actions"><p><span>{icon.shield}</span> No AI answer appears in student view.</p><button className="primary" onClick={() => setStudentPreview(true)}>Open student preview <span>{icon.arrow}</span></button></div>
    </>}
  </div>;
}

function StudentPreview({ group, viewpoints, prompt, onBack, onComplete }: {
  group: DiscussionGroup;
  viewpoints: Viewpoint[];
  prompt: string;
  onBack: () => void;
  onComplete: (revision: Revision) => void;
}) {
  const [claim, setClaim] = useState("They land together if nothing slows them down.");
  const [evidence, setEvidence] = useState("If there is no air, the shape cannot slow either sphere down.");
  const [error, setError] = useState("");
  const groupName = group?.id.replace("group-", "Group ").replace(/\b\w/g, (letter) => letter.toUpperCase()) ?? "Group C";

  const submit = () => {
    if (!claim.trim() || !evidence.trim()) {
      setError("Add both a claim and the evidence that changed or supported it.");
      return;
    }
    onComplete({ claim: claim.trim(), evidence: evidence.trim(), savedAt: new Date().toISOString() });
  };

  return <div className="student-shell fade-in"><div className="student-top"><button onClick={onBack}>← Teacher view</button><span>{groupName} · Student view</span><div className="student-avatar">H</div></div><section className="student-card"><div className="eyebrow">Your group’s question</div><h1>{prompt}</h1><p>Read the anonymous ideas below. Start by asking a question before you defend your own claim.</p><div className="student-ideas">{group.members.map((member) => { const label = viewpoints.find((item) => item.id === member.viewpoint) ?? viewpoints[0]; return <article className={label.color} key={member.id}><span>One person thinks</span><strong>“{member.claim}”</strong></article>; })}</div><div className="revision-box"><label htmlFor="claim">After the discussion, my best claim is…</label><textarea id="claim" value={claim} onChange={(event) => setClaim(event.target.value)} /><label htmlFor="evidence">The evidence that mattered was…</label><textarea id="evidence" value={evidence} onChange={(event) => setEvidence(event.target.value)} />{error && <p className="form-error">{error}</p>}<button className="primary" onClick={submit}>Save my revision <span>{icon.arrow}</span></button></div></section></div>;
}

function Evidence({ lesson, responses, revision, nextMove, onNotify, onRestart }: {
  lesson: Lesson;
  responses: StudentResponse[];
  revision?: Revision;
  nextMove: string;
  onNotify: (message: string) => void;
  onRestart: () => void;
}) {
  const counts = countReasoningPaths(responses);
  const note = createEvidenceNote({ lesson, responses, revision, nextMove });
  const paths: Array<{ key: ViewpointKey; label: string; className: string }> = [
    { key: "weight", label: "weight-first", className: "rose-bar" },
    { key: "gravity", label: "gravity-first", className: "blue-bar" },
    { key: "air", label: "context-first", className: "gold-bar" }
  ];

  const copyNote = async () => {
    try {
      await navigator.clipboard.writeText(note);
      onNotify("Evidence note copied. It remains editable and teacher-owned.");
    } catch {
      onNotify("Copy is unavailable in this browser. Download the text note instead.");
    }
  };

  const downloadNote = () => {
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob([note], { type: "text/plain" }));
    link.download = "counterpoint-evidence-note.txt";
    link.click();
    URL.revokeObjectURL(link.href);
    onNotify("Evidence note downloaded as a plain-text teacher record.");
  };

  return <div className="fade-in"><PageIntro eyebrow="Step 05 / Evidence timeline" title="A better next conversation, not a grade." text="Counterpoint gives the teacher a small, reviewable record of the reasoning available in this session, then points toward the next instructional move." /><div className="evidence-layout"><section className="evidence-card"><div className="evidence-head"><div><span className="tiny-label">Classroom evidence</span><h2>What the class brought to the conversation</h2></div><span className="review-pill">Teacher review</span></div><div className="flow-chart"><div><strong>Before discussion</strong>{paths.map((path) => <span className={`bar ${path.className}`} style={{ width: `${Math.max(20, (counts[path.key] / responses.length) * 100)}%` }} key={path.key}>{counts[path.key]} {path.label}</span>)}</div><div className="flow-arrow">→</div><div><strong>After discussion</strong><span className="after-evidence"><b>{revision ? "1" : "0"}</b> saved independent revision{revision ? "" : "s"}</span><small>Counterpoint does not invent a class-wide shift. It only records submitted reflections.</small></div></div><div className="evidence-quote"><span>{revision ? "Saved revision" : "Revision signal"}</span><p>{revision ? `“${revision.claim}”` : "No student revision has been saved in this demo session yet."}</p>{revision && <><strong>Evidence named:</strong><small>“{revision.evidence}” · anonymous student reflection</small></>}</div></section><aside className="next-step"><span className="spark">{icon.spark}</span><span className="tiny-label">Suggested next move</span><h3>{nextMove}</h3><p>Export a short teacher-owned note for planning or reflection. It is not a grade, compliance record, or student profile.</p><button className="outline full" onClick={copyNote}>Copy evidence note {icon.edit}</button><button className="text-action" onClick={downloadNote}>Download .txt</button></aside></div><div className="page-actions"><p><span>{icon.check}</span> Evidence note stays editable and teacher-owned.</p><button className="primary" onClick={onRestart}>Restart the demo <span>↻</span></button></div></div>;
}

function PageIntro({ eyebrow, title, text }: { eyebrow: string; title: string; text: string }) {
  return <header className="page-intro"><div className="eyebrow">{eyebrow}</div><h1>{title}</h1><p>{text}</p></header>;
}

createRoot(document.getElementById("root")!).render(<App />);

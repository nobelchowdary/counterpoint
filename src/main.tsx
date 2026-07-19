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
import { countReasoningPaths, createEvidenceNote, formatReasoningShift } from "./lib/evidence";
import { createDiverseGroups } from "./lib/grouping";
import { parseAnonymousResponses } from "./lib/import";
import { excludeResponseForReview, hasCompletedMapReview, moveResponseToPath } from "./lib/review";
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

const importSample = [
  "They land together | Both objects are pulled down at the same time.",
  "Air could matter | A wider shape may be slowed more by air.",
  "The heavier one lands first | It seems to have more downward force."
].join("\n");

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
  const [excludedResponses, setExcludedResponses] = useState<StudentResponse[]>(initialDraft.excludedResponses ?? []);
  const [viewpoints, setViewpoints] = useState<Viewpoint[]>(initialDraft.viewpoints);
  const [reviewedViewpointIds, setReviewedViewpointIds] = useState<ViewpointKey[]>(initialDraft.reviewedViewpointIds ?? []);
  const [mapApproved, setMapApproved] = useState(initialDraft.mapApproved ?? false);
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
      excludedResponses,
      viewpoints,
      reviewedViewpointIds,
      mapApproved,
      protocol,
      teacherMove,
      studentPrompt,
      nextMove,
      revision,
      updatedAt: new Date().toISOString()
    });
  }, [lesson, responses, excludedResponses, viewpoints, reviewedViewpointIds, mapApproved, protocol, teacherMove, studentPrompt, nextMove, revision]);

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
    setReviewedViewpointIds([]);
    setMapApproved(false);
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
    setReviewedViewpointIds((ids) => ids.filter((item) => item !== id));
    setMapApproved(false);
    setToast("Viewpoint wording saved locally. Source responses remain unchanged.");
  };

  const moveResponse = (responseId: string, target: ViewpointKey) => {
    const nextResponses = moveResponseToPath(responses, responseId, target);
    setResponses(nextResponses);
    setGroups(createDiverseGroups(nextResponses, rotation));
    setReviewedViewpointIds([]);
    setMapApproved(false);
    setToast("Source reasoning moved. Review the affected pathways again before approval.");
  };

  const excludeResponse = (responseId: string) => {
    try {
      const result = excludeResponseForReview(responses, responseId);
      setResponses(result.included);
      setExcludedResponses((items) => [...items, result.excluded]);
      setGroups(createDiverseGroups(result.included, rotation));
      setReviewedViewpointIds([]);
      setMapApproved(false);
      setToast("That source is excluded from the class plan, not deleted. You can restore it during review.");
    } catch (error) {
      setToast(error instanceof Error ? error.message : "Counterpoint could not exclude that source.");
    }
  };

  const restoreResponse = (responseId: string, target: ViewpointKey) => {
    const restored = excludedResponses.find((response) => response.id === responseId);
    if (!restored) return;
    const nextResponses = [...responses, { ...restored, viewpoint: target }];
    setResponses(nextResponses);
    setExcludedResponses((items) => items.filter((response) => response.id !== responseId));
    setGroups(createDiverseGroups(nextResponses, rotation));
    setReviewedViewpointIds([]);
    setMapApproved(false);
    setToast("Source reasoning restored to this pathway. Review the map again before approval.");
  };

  const mergeViewpoint = (source: ViewpointKey, target: ViewpointKey) => {
    if (source === target) return;
    const nextResponses = responses.map((response) => response.viewpoint === source ? { ...response, viewpoint: target } : response);
    setResponses(nextResponses);
    setGroups(createDiverseGroups(nextResponses, rotation));
    setActiveViewpoint(target);
    setReviewedViewpointIds([]);
    setMapApproved(false);
    setToast("Pathways merged. The now-empty card can be renamed and used to split a distinct counterpoint.");
  };

  const importAnonymousResponses = (rawText: string) => {
    const importedResponses = parseAnonymousResponses(rawText);
    setRotation(0);
    setExcludedResponses([]);
    setReviewedViewpointIds([]);
    setMapApproved(false);
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
            excludedResponses={excludedResponses}
            reviewedViewpointIds={reviewedViewpointIds}
            mapApproved={mapApproved}
            onRunAnalysis={runAnalysis}
            onSaveViewpoint={updateViewpoint}
            onMoveResponse={moveResponse}
            onExcludeResponse={excludeResponse}
            onRestoreResponse={restoreResponse}
            onMergeViewpoint={mergeViewpoint}
            onToggleReviewed={(id) => {
              setReviewedViewpointIds((ids) => ids.includes(id) ? ids.filter((item) => item !== id) : [...ids, id]);
              setMapApproved(false);
            }}
            onApproveMap={() => {
              if (!hasCompletedMapReview(reviewedViewpointIds)) {
                setToast("Review all three reasoning pathways before approving the classroom map.");
                return;
              }
              setMapApproved(true);
              setToast("Thinking map approved. Next, review the balanced discussion groups.");
            }}
            onContinue={() => {
              if (!mapApproved) {
                setToast("Open each pathway, mark it reviewed in the Teacher lens, then approve the map before building student groups.");
                return;
              }
              advanceTo("groups");
            }}
          />}
          {stage === "groups" && <Groups
            groups={groups}
            viewpoints={viewpoints}
            mapApproved={mapApproved}
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
    setRawResponses("");
    setPrivacyConfirmed(false);
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
        <div className="import-guidance"><div className="import-guidance-head"><div><span className="tiny-label">Private teacher workspace</span><strong>Paste anonymous responses</strong></div><button className="text-action" onClick={() => setRawResponses(importSample)}>Use a 3-response sample</button></div><p>One response per line: <code>claim | evidence</code>. Do not include names, emails, IDs, or contact details.</p><pre>{importSample}</pre></div>
        <label htmlFor="anonymous-responses">Anonymous responses<textarea id="anonymous-responses" value={rawResponses} onChange={(event) => setRawResponses(event.target.value)} placeholder="Claim | Evidence" /></label>
        {!rawResponses && <div className="import-empty"><span>{icon.spark}</span><div><strong>Start with three short responses</strong><p>Use the sample to explore the full teacher-review workflow before adding a de-identified classroom set.</p></div></div>}
        <label className="privacy-check"><input type="checkbox" checked={privacyConfirmed} onChange={(event) => setPrivacyConfirmed(event.target.checked)} /> I confirm I removed names and identifying information.</label>
        <div className="import-trust"><span>{icon.shield} Saved only in this browser</span><span>{icon.check} Teacher reviews before students see anything</span></div>
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

function ThinkingMap({ activeViewpoint, onSelect, lesson, viewpoints, responses, analysisState, hasImportedResponses, excludedResponses, reviewedViewpointIds, mapApproved, onRunAnalysis, onSaveViewpoint, onMoveResponse, onExcludeResponse, onRestoreResponse, onMergeViewpoint, onToggleReviewed, onApproveMap, onContinue }: {
  activeViewpoint: ViewpointKey;
  onSelect: (id: ViewpointKey) => void;
  lesson: Lesson;
  viewpoints: Viewpoint[];
  responses: StudentResponse[];
  analysisState: AnalysisState;
  hasImportedResponses: boolean;
  excludedResponses: StudentResponse[];
  reviewedViewpointIds: ViewpointKey[];
  mapApproved: boolean;
  onRunAnalysis: () => void;
  onSaveViewpoint: (id: ViewpointKey, patch: Partial<Omit<Viewpoint, "id" | "color">>) => void;
  onMoveResponse: (responseId: string, target: ViewpointKey) => void;
  onExcludeResponse: (responseId: string) => void;
  onRestoreResponse: (responseId: string, target: ViewpointKey) => void;
  onMergeViewpoint: (source: ViewpointKey, target: ViewpointKey) => void;
  onToggleReviewed: (id: ViewpointKey) => void;
  onApproveMap: () => void;
  onContinue: () => void;
}) {
  const active = viewpoints.find((viewpoint) => viewpoint.id === activeViewpoint) ?? viewpoints[0];
  const selectedResponses = responses.filter((response) => response.viewpoint === active.id);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({ title: active.title, badge: active.badge, summary: active.summary, teacherNote: active.teacherNote });
  const [mergeTarget, setMergeTarget] = useState<ViewpointKey>(viewpoints.find((viewpoint) => viewpoint.id !== active.id)?.id ?? active.id);
  const reviewComplete = hasCompletedMapReview(reviewedViewpointIds);
  const activeReviewed = reviewedViewpointIds.includes(active.id);

  useEffect(() => {
    setEditing(false);
    setDraft({ title: active.title, badge: active.badge, summary: active.summary, teacherNote: active.teacherNote });
    setMergeTarget(viewpoints.find((viewpoint) => viewpoint.id !== active.id)?.id ?? active.id);
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
    <div className="analysis-toolbar"><div><span className="tiny-label">Reasoning map</span><strong>{analysisState === "live" ? "GPT-5.6 structured result — awaiting teacher review" : hasImportedResponses ? "Local draft categories — teacher review required" : "Deterministic fixture — always available for a demo"}</strong></div><div className="review-toolbar-actions"><span className={`review-progress ${mapApproved ? "done" : ""}`}>{mapApproved ? `${icon.check} approved for class` : `${reviewedViewpointIds.length}/3 pathways reviewed`}</span><button className="outline" onClick={onRunAnalysis} disabled={analysisState === "loading"}>{analysisLabel}</button></div></div>
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
          <div className="review-controls"><button className={`review-toggle ${activeReviewed ? "checked" : ""}`} aria-pressed={activeReviewed} onClick={() => onToggleReviewed(active.id)}>{activeReviewed ? `${icon.check} Path reviewed` : "Mark pathway reviewed"}</button><span>Rename, re-sort, or exclude evidence before approval.</span></div>
          <div className="source-list"><span>Evidence ledger · {selectedResponses.length} linked sources</span>{selectedResponses.length > 0 ? selectedResponses.map((response) => <article key={response.id}><div className="source-avatar">{response.alias.slice(0, 1)}</div><div className="source-copy"><strong>{response.claim}</strong><small>“{response.evidence}”</small><div className="source-actions"><label>Path<select aria-label={`Move ${response.alias} to another pathway`} value={response.viewpoint} onChange={(event) => onMoveResponse(response.id, event.target.value as ViewpointKey)}>{viewpoints.map((viewpoint) => <option value={viewpoint.id} key={viewpoint.id}>{viewpoint.badge}</option>)}</select></label><button className="text-action" onClick={() => onExcludeResponse(response.id)}>Exclude</button></div></div></article>) : <div className="empty-path"><strong>Open pathway</strong><p>Rename this card, then move a distinct source here to split a counterpoint from another path.</p></div>}</div>
          {selectedResponses.length > 0 && <div className="merge-control"><label>Merge this pathway into<select aria-label={`Merge ${active.title} into another pathway`} value={mergeTarget} onChange={(event) => setMergeTarget(event.target.value as ViewpointKey)}>{viewpoints.filter((viewpoint) => viewpoint.id !== active.id).map((viewpoint) => <option value={viewpoint.id} key={viewpoint.id}>{viewpoint.title}</option>)}</select></label><button className="text-action" onClick={() => onMergeViewpoint(active.id, mergeTarget)}>Merge sources</button></div>}
          {excludedResponses.length > 0 && <div className="excluded-ledger"><span>Excluded from class plan · recoverable</span>{excludedResponses.map((response) => <article key={response.id}><div><strong>{response.alias}</strong><small>{response.claim}</small></div><button className="text-action" onClick={() => onRestoreResponse(response.id, active.id)}>Restore here</button></article>)}</div>}
          <button className="quiet-button" onClick={() => setEditing(true)}>Edit viewpoint wording {icon.edit}</button>
        </>}
      </aside>
    </div>
    <div className="source-footnote"><span>{icon.shield}</span> {lesson.title}: summaries are editable interpretations; every pattern stays linked to anonymous source reasoning, including any source the teacher excludes from the class plan.</div>
    <div className="page-actions review-actions"><p><span>{icon.check}</span> {reviewComplete ? "All pathways are reviewed. Approve the map when it is ready for students." : "Open each pathway and choose ‘Mark pathway reviewed’ in the Teacher lens to unlock classroom approval."}</p><div><button className="outline" onClick={onApproveMap} disabled={mapApproved}>{mapApproved ? `${icon.check} Map approved` : "Approve map for class"}</button><button className="primary" onClick={onContinue}>Build discussion groups <span>{icon.arrow}</span></button></div></div>
  </div>;
}

function Groups({ groups, viewpoints, mapApproved, lockedGroupIds, onToggleLock, onRebalance, onApprove }: {
  groups: DiscussionGroup[];
  viewpoints: Viewpoint[];
  mapApproved: boolean;
  lockedGroupIds: string[];
  onToggleLock: (id: string) => void;
  onRebalance: () => void;
  onApprove: () => void;
}) {
  return <div className="fade-in">
    <PageIntro eyebrow="Step 03 / Teacher review" title="Design for productive disagreement." text="Counterpoint balances distinct reasoning paths. Lock a group after reviewing it, or rebalance before students receive a prompt." />
    <div className={`approval-banner ${mapApproved ? "approved" : ""}`}><span>{mapApproved ? icon.check : icon.shield}</span><div><strong>{mapApproved ? "Thinking map approved for class" : "Map still needs teacher approval"}</strong><small>{mapApproved ? "Every group below is built only from the reviewed, teacher-approved map." : "Return to the thinking map before sharing groups with students."}</small></div></div>
    <div className="group-toolbar"><div><span className="tiny-label">Grouping rule</span><strong>One contrasting explanation per group, whenever the class distribution allows it</strong></div><button className="outline" onClick={onRebalance}>↻ Rebalance groups</button></div>
    <div className="groups-grid">
      {groups.map((group, index) => <GroupCard group={group} viewpoints={viewpoints} index={index} locked={lockedGroupIds.includes(group.id)} onToggleLock={() => onToggleLock(group.id)} key={group.id} />)}
    </div>
    <div className="group-note"><span>{icon.shield}</span><p><strong>Teacher approval required.</strong> The map never labels a learner correct or incorrect. Locking a group prevents a rebalance from replacing that reviewed composition.</p></div>
    <div className="page-actions"><p><span>{icon.people}</span> {groups.length} mixed groups, {groups.flatMap((group) => group.members).length} anonymous responses</p><button className="primary" onClick={onApprove} disabled={!mapApproved}>Approve groups for class <span>{icon.arrow}</span></button></div>
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

  if (studentPreview) return <StudentPreview group={group} viewpoints={viewpoints} protocol={protocol} prompt={studentPrompt} onBack={() => setStudentPreview(false)} onComplete={onComplete} />;

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
      <div className="page-actions"><p><span>{icon.shield}</span> No AI answer appears in student view. Students receive claims, evidence, a timed prompt, and an independent exit ticket.</p><button className="primary" onClick={() => setStudentPreview(true)}>Open classroom group card <span>{icon.arrow}</span></button></div>
    </>}
  </div>;
}

function StudentPreview({ group, viewpoints, protocol, prompt, onBack, onComplete }: {
  group: DiscussionGroup;
  viewpoints: Viewpoint[];
  protocol: ProtocolStep[];
  prompt: string;
  onBack: () => void;
  onComplete: (revision: Revision) => void;
}) {
  const [claim, setClaim] = useState("They land together if nothing slows them down.");
  const [evidence, setEvidence] = useState("If there is no air, the shape cannot slow either sphere down.");
  const [counterpoint, setCounterpoint] = useState("");
  const [shift, setShift] = useState<Revision["shift"]>("changed");
  const [secondsRemaining, setSecondsRemaining] = useState(8 * 60);
  const [timerRunning, setTimerRunning] = useState(false);
  const [error, setError] = useState("");
  const groupName = group?.id.replace("group-", "Group ").replace(/\b\w/g, (letter) => letter.toUpperCase()) ?? "Group C";
  const timerLabel = `${String(Math.floor(secondsRemaining / 60)).padStart(2, "0")}:${String(secondsRemaining % 60).padStart(2, "0")}`;

  useEffect(() => {
    if (!timerRunning || secondsRemaining === 0) return undefined;
    const timer = window.setInterval(() => {
      setSecondsRemaining((value) => Math.max(0, value - 1));
    }, 1_000);
    return () => window.clearInterval(timer);
  }, [timerRunning, secondsRemaining]);

  useEffect(() => {
    if (secondsRemaining === 0) setTimerRunning(false);
  }, [secondsRemaining]);

  const submit = () => {
    if (!claim.trim() || !evidence.trim()) {
      setError("Add both a claim and the evidence that changed or supported it.");
      return;
    }
    onComplete({ claim: claim.trim(), evidence: evidence.trim(), counterpoint: counterpoint.trim() || undefined, shift, savedAt: new Date().toISOString() });
  };

  return <div className="student-shell fade-in"><div className="student-top"><button onClick={onBack}>← Teacher view</button><span>{groupName} · Classroom card</span><div className="student-avatar">H</div></div><section className="student-card classroom-card"><div className="classroom-card-head"><div><div className="eyebrow">{groupName} · teacher-approved</div><h1>{prompt}</h1></div><div className="discussion-timer"><span>Discussion time</span><strong aria-live="polite">{timerLabel}</strong><div><button className="timer-button" onClick={() => setTimerRunning((value) => !value)} disabled={secondsRemaining === 0}>{timerRunning ? "Pause" : "Start"}</button><button className="timer-button reset" onClick={() => { setTimerRunning(false); setSecondsRemaining(8 * 60); }}>Reset</button></div></div></div><p>Listen for evidence, not a winning answer. Start by accurately restating one anonymous idea before you challenge it.</p><div className="moment-rhythm">{protocol.map((step, index) => <span key={step.id}><b>{String(index + 1).padStart(2, "0")}</b>{step.title}<small>{step.duration}</small></span>)}</div><div className="student-ideas">{group.members.map((member) => { const label = viewpoints.find((item) => item.id === member.viewpoint) ?? viewpoints[0]; return <article className={label.color} key={member.id}><span>Anonymous idea · {label.badge}</span><strong>“{member.claim}”</strong><small>Evidence named: “{member.evidence}”</small></article>; })}</div><div className="counterpoint-box"><span className="tiny-label">Counterpoint question</span><strong>What observation, example, or condition would change your mind?</strong><textarea aria-label="Counterpoint question" value={counterpoint} onChange={(event) => setCounterpoint(event.target.value)} placeholder="Write one question your group should test…" /></div><div className="revision-box exit-ticket"><div><span className="tiny-label">Independent exit ticket · 2 questions</span><p>Your teacher sees only the response you choose to submit; this is formative evidence, not a grade.</p></div><label htmlFor="claim">1. After the discussion, my best claim is…</label><textarea id="claim" value={claim} onChange={(event) => setClaim(event.target.value)} /><label htmlFor="evidence">2. The evidence that mattered was…</label><textarea id="evidence" value={evidence} onChange={(event) => setEvidence(event.target.value)} /><fieldset className="reasoning-signal"><legend>My thinking after discussion</legend><label><input type="radio" name="shift" value="changed" checked={shift === "changed"} onChange={() => setShift("changed")} /> It changed</label><label><input type="radio" name="shift" value="strengthened" checked={shift === "strengthened"} onChange={() => setShift("strengthened")} /> It strengthened</label><label><input type="radio" name="shift" value="still-thinking" checked={shift === "still-thinking"} onChange={() => setShift("still-thinking")} /> I am still thinking</label></fieldset>{error && <p className="form-error">{error}</p>}<button className="primary" onClick={submit}>Save exit ticket <span>{icon.arrow}</span></button></div></section></div>;
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
  const impactSignal = revision ? formatReasoningShift(revision.shift) : null;
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

  return <div className="fade-in"><PageIntro eyebrow="Step 05 / Impact loop" title="A better next conversation, not a grade." text="Counterpoint makes a small, reviewable bridge from the reasoning students brought in to the evidence they choose to name after discussion." /><div className="evidence-layout"><section className="evidence-card"><div className="evidence-head"><div><span className="tiny-label">Classroom evidence</span><h2>Reasoning before and after the conversation</h2></div><span className="review-pill">Teacher review</span></div><div className="flow-chart"><div><strong>Before discussion</strong>{paths.map((path) => <span className={`bar ${path.className}`} style={{ width: `${Math.max(20, (counts[path.key] / responses.length) * 100)}%` }} key={path.key}>{counts[path.key]} {path.label}</span>)}</div><div className="flow-arrow">→</div><div><strong>After discussion</strong><span className="after-evidence"><b>{revision ? "1" : "0"}</b> submitted exit ticket{revision ? "" : "s"}</span><small>Counterpoint never invents a class-wide shift. It records only submitted, independent reflections.</small></div></div><div className="impact-loop"><span className="tiny-label">Two-question impact loop</span><div><strong>1. Best claim</strong><strong>2. Evidence that mattered</strong></div>{revision && <p><b>{icon.check}</b> Learner signal: <em>{impactSignal}</em></p>}</div><div className="evidence-quote"><span>{revision ? "Saved exit ticket" : "Revision signal"}</span><p>{revision ? `“${revision.claim}”` : "No student exit ticket has been saved in this demo session yet."}</p>{revision && <><strong>Evidence named:</strong><small>“{revision.evidence}” · anonymous student reflection</small>{revision.counterpoint && <small>Counterpoint question: “{revision.counterpoint}”</small>}</>}</div></section><aside className="next-step"><span className="spark">{icon.spark}</span><span className="tiny-label">Suggested next move</span><h3>{nextMove}</h3><p>Export a short teacher-owned note for planning or reflection. It is not a grade, compliance record, or student profile.</p><button className="outline full" onClick={copyNote}>Copy evidence note {icon.edit}</button><button className="text-action" onClick={downloadNote}>Download .txt</button></aside></div><div className="page-actions"><p><span>{icon.check}</span> Evidence note stays editable and teacher-owned.</p><button className="primary" onClick={onRestart}>Restart the demo <span>↻</span></button></div></div>;
}

function PageIntro({ eyebrow, title, text }: { eyebrow: string; title: string; text: string }) {
  return <header className="page-intro"><div className="eyebrow">{eyebrow}</div><h1>{title}</h1><p>{text}</p></header>;
}

createRoot(document.getElementById("root")!).render(<App />);

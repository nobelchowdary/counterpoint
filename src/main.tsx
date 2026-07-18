import { useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { lesson, responses, viewpoints } from "./lib/demo-data";
import { createDiverseGroups } from "./lib/grouping";
import type { DiscussionGroup, ViewpointKey } from "./lib/types";
import "./styles.css";

type Stage = "launch" | "map" | "groups" | "protocol" | "evidence";

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
  edit: "↗"
};

function App() {
  const [stage, setStage] = useState<Stage>("launch");
  const [activeViewpoint, setActiveViewpoint] = useState<ViewpointKey>("weight");
  const [rotation, setRotation] = useState(0);
  const [approved, setApproved] = useState(false);
  const [studentPreview, setStudentPreview] = useState(false);
  const [revised, setRevised] = useState(false);

  const groups = useMemo(() => createDiverseGroups(responses, rotation), [rotation]);
  const currentIndex = stageMeta.findIndex((item) => item.id === stage);
  const nextStage = () => setStage(stageMeta[Math.min(currentIndex + 1, stageMeta.length - 1)].id);

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
              className={`stage-link ${stage === item.id ? "active" : ""} ${index <= currentIndex ? "seen" : ""}`}
              key={item.id}
              onClick={() => index <= currentIndex && setStage(item.id)}
              disabled={index > currentIndex}
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
          <div className="topbar-right"><span className="demo-pill">Demo data</span><button className="help" aria-label="Help">?</button></div>
        </header>

        <section className="content">
          {stage === "launch" && <Launch onBegin={() => setStage("map")} />}
          {stage === "map" && <ThinkingMap activeViewpoint={activeViewpoint} onSelect={setActiveViewpoint} onContinue={() => setStage("groups")} />}
          {stage === "groups" && <Groups groups={groups} onRebalance={() => setRotation((value) => value + 1)} onApprove={() => { setApproved(true); setStage("protocol"); }} />}
          {stage === "protocol" && <Protocol approved={approved} studentPreview={studentPreview} setStudentPreview={setStudentPreview} onComplete={() => { setRevised(true); setStage("evidence"); }} />}
          {stage === "evidence" && <Evidence revised={revised} onRestart={() => { setApproved(false); setRevised(false); setStudentPreview(false); setStage("launch"); }} />}
        </section>
      </section>
    </main>
  );
}

function Launch({ onBegin }: { onBegin: () => void }) {
  return <div className="launch-wrap fade-in">
    <div className="eyebrow">A ten-minute formative conversation</div>
    <h1>Make the thinking<br />in the room useful<br />to the room.</h1>
    <p className="lede">Counterpoint turns a class’s written reasoning into an anonymous, teacher-approved peer conversation — not another answer from a bot.</p>
    <div className="lesson-card">
      <div className="lesson-head"><span>Today’s learning goal</span><span className="goal-check">{icon.check}</span></div>
      <p>{lesson.learningGoal}</p>
      <div className="prompt-box"><span>Question</span><strong>{lesson.question}</strong></div>
      <div className="response-row"><div className="response-stack">{responses.slice(0, 5).map((response, index) => <span key={response.id} style={{ transform: `rotate(${(index - 2) * 3}deg) translateX(${index * 5}px)` }} />)}</div><div><strong>12 responses ready</strong><small>Anonymous reasoning, collected in class</small></div></div>
    </div>
    <div className="launch-actions"><button className="primary" onClick={onBegin}>Reveal the thinking <span>{icon.arrow}</span></button><p><span>{icon.shield}</span> Nothing reaches students without your review.</p></div>
  </div>;
}

function ThinkingMap({ activeViewpoint, onSelect, onContinue }: { activeViewpoint: ViewpointKey; onSelect: (id: ViewpointKey) => void; onContinue: () => void }) {
  const active = viewpoints.find((viewpoint) => viewpoint.id === activeViewpoint)!;
  const selectedResponses = responses.filter((response) => response.viewpoint === activeViewpoint);
  return <div className="fade-in">
    <PageIntro eyebrow="Step 02 / Teacher review" title="Three ways your class is thinking." text="GPT-5.6 organized the reasoning — not the learners — into anonymous viewpoints. Review every interpretation before it leaves this page." />
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
        <h3>{active.title}</h3><p>{active.teacherNote}</p>
        <div className="source-list"><span>Source responses</span>{selectedResponses.map((response) => <article key={response.id}><div className="source-avatar">{response.alias.slice(0, 1)}</div><div><strong>{response.claim}</strong><small>“{response.evidence}”</small></div></article>)}</div>
        <button className="quiet-button">Edit viewpoint label {icon.edit}</button>
      </aside>
    </div>
    <div className="page-actions"><p><span>{icon.check}</span> All summaries link to source reasoning.</p><button className="primary" onClick={onContinue}>Build discussion groups <span>{icon.arrow}</span></button></div>
  </div>;
}

function Groups({ groups, onRebalance, onApprove }: { groups: DiscussionGroup[]; onRebalance: () => void; onApprove: () => void }) {
  return <div className="fade-in">
    <PageIntro eyebrow="Step 03 / Teacher review" title="Design for productive disagreement." text="Counterpoint balances reasoning paths. You can rebalance, lock, or change any group before students receive a prompt." />
    <div className="group-toolbar"><div><span className="tiny-label">Grouping rule</span><strong>One contrasting explanation per group</strong></div><button className="outline" onClick={onRebalance}>↻ Rebalance groups</button></div>
    <div className="groups-grid">
      {groups.map((group, index) => <GroupCard group={group} index={index} key={group.id} />)}
    </div>
    <div className="group-note"><span>{icon.shield}</span><p><strong>Teacher approval required.</strong> Student names stay private, and Counterpoint never labels a learner as correct or incorrect.</p></div>
    <div className="page-actions"><p><span>{icon.people}</span> 4 mixed groups, 12 anonymous responses</p><button className="primary" onClick={onApprove}>Approve discussion plan <span>{icon.arrow}</span></button></div>
  </div>;
}

function GroupCard({ group, index }: { group: DiscussionGroup; index: number }) {
  const labels = group.members.map((member) => viewpoints.find((viewpoint) => viewpoint.id === member.viewpoint)!);
  return <article className="group-card"><div className="group-title"><span>Group {String.fromCharCode(65 + index)}</span><button aria-label={`Lock group ${index + 1}`}>⌁</button></div><div className="member-orbit">{group.members.map((member, memberIndex) => <div className={`member-token ${labels[memberIndex].color}`} key={member.id}><span>{member.alias.slice(0, 1)}</span><small>{labels[memberIndex].badge}</small></div>)}</div><p>{group.reason}</p><div className="group-labels">{labels.map((label) => <span className={label.color} key={label.id}>{label.title}</span>)}</div></article>;
}

function Protocol({ approved, studentPreview, setStudentPreview, onComplete }: { approved: boolean; studentPreview: boolean; setStudentPreview: (value: boolean) => void; onComplete: () => void }) {
  if (studentPreview) return <StudentPreview onBack={() => setStudentPreview(false)} onComplete={onComplete} />;
  return <div className="fade-in">
    <PageIntro eyebrow="Step 04 / Teacher-approved protocol" title="Give students a reason to listen." text="The conversation asks students to test an explanation with evidence, not to vote for a right answer." />
    <div className="protocol-layout"><section className="protocol-card"><div className="protocol-top"><div><span className="tiny-label">Group protocol</span><h2>Why do the spheres fall this way?</h2></div><span className="duration">10 min</span></div><ol className="timeline"><li><span>01</span><div><strong>Take a private position</strong><p>Re-read your original claim. Notice what evidence you used.</p></div><em>1 min</em></li><li><span>02</span><div><strong>Share before you challenge</strong><p>Each person explains their idea. Your job is to understand it accurately.</p></div><em>4 min</em></li><li><span>03</span><div><strong>Test the evidence</strong><p>Ask one real question. Compare what would happen if air were removed.</p></div><em>3 min</em></li><li><span>04</span><div><strong>Revise independently</strong><p>Keep or revise your claim. Name the evidence that mattered.</p></div><em>2 min</em></li></ol></section><aside className="protocol-side"><div className="approved-stamp">{approved ? icon.check : "…"}<span>{approved ? "Approved" : "Draft"}</span></div><h3>Teacher move</h3><p>Listen for whether students distinguish force from acceleration. Do not resolve the debate until every group has named its evidence.</p><div className="prompt-callout"><span>Student prompt</span><strong>“What would you expect to see if we removed the air?”</strong></div><button className="outline full" onClick={() => setStudentPreview(true)}>Preview student experience {icon.arrow}</button></aside></div>
    <div className="page-actions"><p><span>{icon.shield}</span> No AI answer appears in student view.</p><button className="primary" onClick={() => setStudentPreview(true)}>Open student preview <span>{icon.arrow}</span></button></div>
  </div>;
}

function StudentPreview({ onBack, onComplete }: { onBack: () => void; onComplete: () => void }) {
  const [selection, setSelection] = useState("They land together if nothing slows them down.");
  return <div className="student-shell fade-in"><div className="student-top"><button onClick={onBack}>← Teacher view</button><span>Group C · Student view</span><div className="student-avatar">H</div></div><section className="student-card"><div className="eyebrow">Your group’s question</div><h1>What would you expect to see if we removed the air?</h1><p>Read the anonymous ideas below. Start by asking a question before you defend your own claim.</p><div className="student-ideas"><article className="rose"><span>One person thinks</span><strong>“The heavy sphere lands first because gravity pulls harder.”</strong></article><article className="blue"><span>One person thinks</span><strong>“They land together because both are pulled by gravity.”</strong></article><article className="gold"><span>One person wonders</span><strong>“Maybe the shape and the air make the difference.”</strong></article></div><div className="revision-box"><label htmlFor="claim">After the discussion, my best claim is…</label><textarea id="claim" value={selection} onChange={(event) => setSelection(event.target.value)} /><label htmlFor="evidence">The evidence that mattered was…</label><textarea id="evidence" defaultValue="If there is no air, the shape cannot slow either sphere down." /><button className="primary" onClick={onComplete}>Save my revision <span>{icon.arrow}</span></button></div></section></div>;
}

function Evidence({ revised, onRestart }: { revised: boolean; onRestart: () => void }) {
  return <div className="fade-in"><PageIntro eyebrow="Step 05 / Evidence timeline" title="A better next conversation, not a grade." text="Counterpoint gives the teacher a small, reviewable record of how reasoning shifted — then points toward the next instructional move." /><div className="evidence-layout"><section className="evidence-card"><div className="evidence-head"><div><span className="tiny-label">Classroom evidence</span><h2>How the explanation changed</h2></div><span className="review-pill">Teacher review</span></div><div className="flow-chart"><div><strong>Before discussion</strong><span className="bar rose-bar" style={{ width: "42%" }}>5 weight-first</span><span className="bar blue-bar" style={{ width: "33%" }}>4 gravity-first</span><span className="bar gold-bar" style={{ width: "25%" }}>3 context-first</span></div><div className="flow-arrow">→</div><div><strong>After discussion</strong><span className="bar rose-bar" style={{ width: "14%" }}>1 weight-first</span><span className="bar blue-bar" style={{ width: "58%" }}>7 evidence-based revisions</span><span className="bar gold-bar" style={{ width: "28%" }}>4 questions about air</span></div></div><div className="evidence-quote"><span>Revision signal</span><p>“I still think gravity pulls harder on the heavy one, but now I see that it also has more mass. I want to test what happens without air.”</p><small>Anonymous student reflection · {revised ? "just saved" : "demo example"}</small></div></section><aside className="next-step"><span className="spark">{icon.spark}</span><span className="tiny-label">Suggested next move</span><h3>Run the same drop in a vacuum simulation.</h3><p>Ask students to predict first, then name which part of their explanation changed after the observation.</p><button className="outline full">Copy evidence note {icon.edit}</button></aside></div><div className="page-actions"><p><span>{icon.check}</span> Evidence note stays editable and teacher-owned.</p><button className="primary" onClick={onRestart}>Restart the demo <span>↻</span></button></div></div>;
}

function PageIntro({ eyebrow, title, text }: { eyebrow: string; title: string; text: string }) {
  return <header className="page-intro"><div className="eyebrow">{eyebrow}</div><h1>{title}</h1><p>{text}</p></header>;
}

createRoot(document.getElementById("root")!).render(<App />);

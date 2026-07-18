import type { StudentResponse, Viewpoint } from "./types";

export const lesson = {
  title: "Forces & motion",
  learningGoal: "Use evidence to explain how mass and gravity affect falling objects.",
  question: "Two metal spheres, one heavy and one light, are dropped at the same time. Which lands first — and why?"
};

export const viewpoints: Viewpoint[] = [
  {
    id: "weight",
    title: "More weight means faster",
    badge: "Weight-first",
    color: "rose",
    summary: "Students connect a stronger downward pull with a faster fall, but do not yet account for the object's mass.",
    teacherNote: "A productive contrast with the gravity-first view. Ask: what changes when mass increases too?"
  },
  {
    id: "gravity",
    title: "Gravity accelerates both",
    badge: "Gravity-first",
    color: "blue",
    summary: "Students reason that gravity affects both spheres equally and predict a shared landing time.",
    teacherNote: "Invite this group to explain its evidence without simply announcing a correct answer."
  },
  {
    id: "air",
    title: "It depends on the air",
    badge: "Context-first",
    color: "gold",
    summary: "Students notice that air resistance could matter and ask for missing conditions in the question.",
    teacherNote: "A useful bridge to experimental design and the limits of the simplified model."
  }
];

export const responses: StudentResponse[] = [
  { id: "s1", alias: "Aster", claim: "The heavy sphere lands first.", evidence: "Gravity pulls harder on something heavy.", confidence: 82, viewpoint: "weight" },
  { id: "s2", alias: "Birch", claim: "It could depend on which one has more air pushing on it.", evidence: "A feather falls slowly because of air.", confidence: 56, viewpoint: "air" },
  { id: "s3", alias: "Cedar", claim: "They land together.", evidence: "Gravity is pulling both down at the same time.", confidence: 74, viewpoint: "gravity" },
  { id: "s4", alias: "Dune", claim: "The heavier ball wins.", evidence: "If it weighs more, it has more force going down.", confidence: 68, viewpoint: "weight" },
  { id: "s5", alias: "Ember", claim: "I need to know their shapes.", evidence: "A flat thing hits more air than a round thing.", confidence: 61, viewpoint: "air" },
  { id: "s6", alias: "Flint", claim: "The heavy one falls quicker.", evidence: "More weight means more gravity.", confidence: 88, viewpoint: "weight" },
  { id: "s7", alias: "Grove", claim: "They should tie.", evidence: "They are both dropped from the same height.", confidence: 65, viewpoint: "gravity" },
  { id: "s8", alias: "Harbor", claim: "They land together if nothing slows them down.", evidence: "Everything is pulled toward Earth.", confidence: 79, viewpoint: "gravity" },
  { id: "s9", alias: "Indigo", claim: "The lighter one might float more.", evidence: "Air pushes up when something falls.", confidence: 49, viewpoint: "air" },
  { id: "s10", alias: "Juniper", claim: "Heavy lands first.", evidence: "It has more downward force so it should speed up more.", confidence: 77, viewpoint: "weight" },
  { id: "s11", alias: "Kite", claim: "They both hit at once.", evidence: "The heavy one has more pull but also more mass to move.", confidence: 71, viewpoint: "gravity" },
  { id: "s12", alias: "Lumen", claim: "I think air makes the difference.", evidence: "A bigger surface could make either ball slower.", confidence: 58, viewpoint: "air" }
];

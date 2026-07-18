export type ViewpointKey = "weight" | "gravity" | "air";

export type Lesson = {
  title: string;
  learningGoal: string;
  question: string;
};

export type StudentResponse = {
  id: string;
  alias: string;
  claim: string;
  evidence: string;
  confidence: number;
  viewpoint: ViewpointKey;
};

export type Viewpoint = {
  id: ViewpointKey;
  title: string;
  badge: string;
  color: "rose" | "blue" | "gold";
  summary: string;
  teacherNote: string;
};

export type DiscussionGroup = {
  id: string;
  members: StudentResponse[];
  reason: string;
};

export type ProtocolStep = {
  id: string;
  title: string;
  description: string;
  duration: string;
};

export type Revision = {
  claim: string;
  evidence: string;
  shift: "changed" | "strengthened" | "still-thinking";
  counterpoint?: string;
  savedAt: string;
};

export type AnalysisResult = {
  model: string;
  viewpoints: Viewpoint[];
  responseViewpoints: Record<string, ViewpointKey>;
  protocol: ProtocolStep[];
  teacherMove: string;
  studentPrompt: string;
  nextMove: string;
};

export type CounterpointDraft = {
  lesson: Lesson;
  responses: StudentResponse[];
  excludedResponses?: StudentResponse[];
  viewpoints: Viewpoint[];
  reviewedViewpointIds?: ViewpointKey[];
  mapApproved?: boolean;
  protocol: ProtocolStep[];
  teacherMove: string;
  studentPrompt: string;
  nextMove: string;
  revision?: Revision;
  updatedAt: string;
};

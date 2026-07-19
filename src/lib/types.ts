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
  id?: string;
  groupId?: string;
  claim: string;
  evidence: string;
  shift: "changed" | "strengthened" | "still-thinking";
  counterpoint?: string;
  namedNewEvidence?: boolean;
  savedAt: string;
};

export type IntakeIssue = {
  id: string;
  line: number;
  status: "needs-review" | "blocked";
  reason: string;
};

export type DraftStage = "launch" | "map" | "groups" | "protocol" | "evidence";
export type DraftAnalysisState = "idle" | "loading" | "live" | "demo";

export type DraftWorkflow = {
  stage: DraftStage;
  furthestStage: number;
  rotation: number;
  lockedGroupIds: string[];
  groupsApproved: boolean;
  activeViewpoint: ViewpointKey;
  analysisState: Exclude<DraftAnalysisState, "loading">;
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
  version?: 2;
  lesson: Lesson;
  responses: StudentResponse[];
  excludedResponses?: StudentResponse[];
  needsReviewItems?: IntakeIssue[];
  viewpoints: Viewpoint[];
  reviewedViewpointIds?: ViewpointKey[];
  mapApproved?: boolean;
  protocol: ProtocolStep[];
  teacherMove: string;
  studentPrompt: string;
  nextMove: string;
  revision?: Revision;
  exitTickets?: Revision[];
  workflow?: DraftWorkflow;
  updatedAt: string;
};

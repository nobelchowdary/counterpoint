export type ViewpointKey = "weight" | "gravity" | "air";

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

// Shapes returned by /public-data/crm/* endpoints. Kept in sync by hand —
// no shared types package between web and api yet.

export interface PipelineStage {
  id: string;
  organizationId: string;
  name: string;
  color: string | null;
  order: number;
  isDefault: boolean;
  isTerminal: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PipelineDealAssignee {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string;
}

export interface PipelineDealStageRef {
  id: string;
  name: string;
  color: string | null;
  isTerminal: boolean;
}

export interface PipelineDealParcel {
  bbl: string;
  address: string | null;
  borough: string;
  zipCode: string | null;
  buildingClass: string | null;
  distressScore: number | null;
}

export interface PipelineDeal {
  id: string;
  parcelId: string;
  organizationId: string;
  stageId: string;
  stage: PipelineDealStageRef;
  parcel: PipelineDealParcel;
  assignedToUserId: string | null;
  assignedToUser: PipelineDealAssignee | null;
  assignedAt: string | null;
  nextFollowUpAt: string | null;
  lastContactedAt: string | null;
  lastContactedByUserId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PipelineDealsResponse {
  deals: PipelineDeal[];
}

export interface PipelineStagesResponse {
  stages: PipelineStage[];
}

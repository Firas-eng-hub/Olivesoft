export type LeadStage = "detected" | "researched" | "matched" | "proposal_ready" | "failed";
export type MatchStatus = "supported" | "partial" | "unsupported" | "unknown";
export type JobState = "queued" | "running" | "completed" | "failed";
export type ProfileAssessment = "matches_profile" | "review_required" | "low_fit" | "insufficient_evidence";

export interface Evidence {
  id: string;
  title: string;
  source: string;
  url?: string;
  excerpt: string;
  retrievedAt: string;
  assetRef?: string;
}

export interface RequirementMatch {
  id: string;
  label: string;
  mandatory: boolean;
  status: MatchStatus;
  evidenceIds: string[];
  note: string;
}

export interface Artifact {
  id: string;
  kind: "pptx" | "pdf";
  name: string;
  demo: boolean;
}

export interface Job {
  id: string;
  leadId: string;
  operation: "intake" | "proposal" | "retry";
  state: JobState;
  stage: string;
  progress: number;
  createdAt: string;
  error?: string;
}

export interface Lead {
  id: string;
  title: string;
  organization: string;
  sector: string;
  location: string;
  summary: string;
  stage: LeadStage;
  score: number | null;
  relevanceScore?: number | null;
  assessment?: ProfileAssessment;
  mandatoryGaps?: number;
  sourceUrl?: string;
  acceptedAt?: string | null;
  acceptanceComments?: string;
  acceptancePriorities?: string;
  acceptanceExclusions?: string;
  coverage: number | null;
  deadline: string | null;
  detectedAt: string;
  tags: string[];
  requirements: RequirementMatch[];
  evidence: Evidence[];
  artifacts: Artifact[];
  priority: "High" | "Medium" | "Low";
  source: string;
}

export interface DashboardData {
  leads: Lead[];
  jobs: Job[];
}

export interface DashboardAdapter {
  load(): Promise<DashboardData>;
  save(data: DashboardData): Promise<void>;
}

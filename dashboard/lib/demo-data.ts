import type { DashboardData, Evidence, Lead, RequirementMatch } from "./types";

const evidence = (id: string, title: string, source: string, excerpt: string, assetRef?: string): Evidence => ({
  id,
  title,
  source,
  excerpt,
  assetRef,
  retrievedAt: "2026-09-25T11:20:00.000Z",
});

const match = (id: string, label: string, status: RequirementMatch["status"], evidenceIds: string[], mandatory = true, note = ""): RequirementMatch => ({
  id,
  label,
  status,
  evidenceIds,
  mandatory,
  note,
});

const cloudEvidence = [
  evidence("e-1", "Cloud platform delivery", "Internal project · PRJ-014", "Migration of 120 workloads to a managed cloud platform with a phased cutover and rollback plan.", "PRJ-014"),
  evidence("e-2", "Platform engineer profile", "Internal CV · CV-008", "Eight years of Kubernetes and infrastructure automation experience across regulated environments.", "CV-008"),
  evidence("e-3", "Security operating model", "Internal project · PRJ-006", "Documented access controls, audit trails, and security review gates for a public-sector delivery.", "PRJ-006"),
  evidence("e-4", "City digital transformation program", "Public opportunity brief · demo fixture", "The city seeks a scalable platform with secure migration, observability, and knowledge transfer."),
];

export const seedData: DashboardData = {
  leads: [
    {
      id: "OS-2026-041", title: "National Cloud Modernization Program", organization: "Ministry of Digital Affairs", sector: "Public sector", location: "Tunis, Tunisia", summary: "Modernize critical public services through a secure cloud platform, phased migration, and a strong operational handover.", stage: "matched", score: 94, coverage: 63, deadline: "2026-10-18", detectedAt: "2026-09-25T09:25:00.000Z", tags: ["Cloud", "DevOps", "Security"], priority: "High", source: "Public procurement portal", evidence: cloudEvidence, artifacts: [],
      requirements: [
        match("R-01", "Cloud migration strategy", "supported", ["e-1", "e-4"], true, "Relevant delivery experience and a documented migration approach."),
        match("R-02", "Kubernetes platform engineering", "supported", ["e-2"], true, "Candidate profile demonstrates platform experience; availability requires confirmation."),
        match("R-03", "Security and audit controls", "partial", ["e-3"], true, "Relevant controls exist, but the requested certification is unverified."),
        match("R-04", "24/7 managed support", "unknown", [], false, "No evidence of the requested support coverage in the demo corpus."),
      ],
    },
    {
      id: "OS-2026-040", title: "Smart Mobility Data Platform", organization: "MetroLink Group", sector: "Transport", location: "Paris, France", summary: "A unified data platform for mobility operations, real-time analytics, and passenger insights.", stage: "proposal_ready", score: 91, coverage: 83, deadline: "2026-10-14", detectedAt: "2026-09-24T14:10:00.000Z", tags: ["Data", "AI", "Analytics"], priority: "High", source: "Partner referral", evidence: [evidence("e-5", "Mobility analytics delivery", "Internal project · PRJ-021", "Delivered a streaming analytics platform for transport operations.", "PRJ-021"), evidence("e-6", "Data engineer profile", "Internal CV · CV-003", "Experience building event pipelines and dashboards for high-volume operational data.", "CV-003")],
      requirements: [match("R-01", "Real-time data ingestion", "supported", ["e-5", "e-6"]), match("R-02", "Passenger insight dashboard", "supported", ["e-5"]), match("R-03", "On-premise deployment", "partial", ["e-5"], false)],
      artifacts: [{ id: "demo-pptx-040", kind: "pptx", name: "MetroLink_Proposal_DEMO.pptx", demo: true }, { id: "demo-pdf-040", kind: "pdf", name: "MetroLink_Proposal_DEMO.pdf", demo: true }],
    },
    {
      id: "OS-2026-039", title: "Digital Patient Experience", organization: "Medica Health Network", sector: "Healthcare", location: "Lyon, France", summary: "A patient-first digital portal and interoperable service layer for care teams.", stage: "researched", score: 86, coverage: null, deadline: "2026-10-22", detectedAt: "2026-09-23T16:45:00.000Z", tags: ["UX", "Integration", "Healthcare"], priority: "High", source: "Public tender portal", evidence: [evidence("e-7", "Healthcare integration case", "Internal project · PRJ-009", "Integrated patient scheduling and clinical systems with a secure API layer.", "PRJ-009")], requirements: [match("R-01", "Interoperable patient services", "unknown", ["e-7"], true, "Awaiting requirement matching."), match("R-02", "Accessible portal experience", "unknown", [], true, "Awaiting requirement matching.")], artifacts: [],
    },
    {
      id: "OS-2026-038", title: "Enterprise Cyber Resilience", organization: "Aster Bank", sector: "Financial services", location: "Brussels, Belgium", summary: "Modernize security operations and introduce an organization-wide resilience framework.", stage: "matched", score: 79, coverage: 50, deadline: "2026-10-28", detectedAt: "2026-09-22T10:05:00.000Z", tags: ["Cybersecurity", "Risk"], priority: "Medium", source: "Public tender portal", evidence: [evidence("e-8", "Security review project", "Internal project · PRJ-006", "Security reviews and audit controls implemented in a regulated setting.", "PRJ-006")], requirements: [match("R-01", "Security operations design", "supported", ["e-8"]), match("R-02", "Banking sector reference", "unsupported", [], true, "No banking reference found in the demo corpus."), match("R-03", "Incident response playbooks", "partial", ["e-8"])], artifacts: [],
    },
    {
      id: "OS-2026-037", title: "Open Government Services", organization: "City of Sfax", sector: "Public sector", location: "Sfax, Tunisia", summary: "Consolidate citizen-facing services into one accessible digital experience.", stage: "detected", score: 74, coverage: null, deadline: "2026-11-04", detectedAt: "2026-09-21T12:35:00.000Z", tags: ["Public sector", "Web"], priority: "Medium", source: "Public tender portal", evidence: [], requirements: [match("R-01", "Citizen service portal", "unknown", [], true, "Research and matching pending.")], artifacts: [],
    },
    {
      id: "OS-2026-036", title: "Industrial IoT Operations Hub", organization: "Northstar Manufacturing", sector: "Manufacturing", location: "Berlin, Germany", summary: "Connect factory telemetry and operations data for predictive maintenance.", stage: "matched", score: 72, coverage: 50, deadline: "2026-11-09", detectedAt: "2026-09-20T08:15:00.000Z", tags: ["IoT", "Data", "Operations"], priority: "Medium", source: "Partner referral", evidence: [evidence("e-9", "Industrial data project", "Internal project · PRJ-017", "Built a factory telemetry pipeline and operational reporting layer.", "PRJ-017")], requirements: [match("R-01", "Telemetry ingestion", "supported", ["e-9"]), match("R-02", "Predictive maintenance", "partial", ["e-9"]), match("R-03", "Edge deployment", "unknown", [])], artifacts: [],
    },
    {
      id: "OS-2026-035", title: "University Learning Ecosystem", organization: "Università Nova", sector: "Education", location: "Milan, Italy", summary: "A digital learning environment with unified identity and insights.", stage: "failed", score: null, coverage: null, deadline: null, detectedAt: "2026-09-19T17:05:00.000Z", tags: ["Education", "Identity"], priority: "Low", source: "Manual intake", evidence: [], requirements: [], artifacts: [],
    },
    {
      id: "OS-2026-034", title: "Renewable Energy Forecasting Suite", organization: "Helios Energy", sector: "Energy", location: "Madrid, Spain", summary: "Forecast renewable output and visualize performance across a distributed portfolio.", stage: "proposal_ready", score: 89, coverage: 100, deadline: "2026-10-11", detectedAt: "2026-09-18T11:00:00.000Z", tags: ["AI", "Energy", "Analytics"], priority: "High", source: "Public tender portal", evidence: [evidence("e-10", "Forecasting project", "Internal project · PRJ-025", "Developed operational forecasts and dashboards for distributed assets.", "PRJ-025")], requirements: [match("R-01", "Forecasting models", "supported", ["e-10"]), match("R-02", "Portfolio visualization", "supported", ["e-10"])], artifacts: [{ id: "demo-pptx-034", kind: "pptx", name: "Helios_Proposal_DEMO.pptx", demo: true }, { id: "demo-pdf-034", kind: "pdf", name: "Helios_Proposal_DEMO.pdf", demo: true }],
    },
  ],
  jobs: [
    { id: "JOB-2198", leadId: "OS-2026-040", operation: "proposal", state: "completed", stage: "Exports verified", progress: 100, createdAt: "2026-09-25T08:40:00.000Z" },
    { id: "JOB-2197", leadId: "OS-2026-041", operation: "intake", state: "completed", stage: "Requirement matching", progress: 100, createdAt: "2026-09-25T09:25:00.000Z" },
    { id: "JOB-2196", leadId: "OS-2026-035", operation: "intake", state: "failed", stage: "Source extraction", progress: 31, createdAt: "2026-09-19T17:05:00.000Z", error: "The supplied source text did not contain enough tender details." },
  ],
};

export function createLead(input: { title: string; organization: string; summary: string; deadline: string }): Lead {
  const id = `OS-DEMO-${Date.now().toString(36).toUpperCase()}`;
  return {
    id,
    title: input.title.trim(),
    organization: input.organization.trim(),
    sector: "Unclassified",
    location: "Location pending",
    summary: input.summary.trim(),
    stage: "detected",
    score: null,
    coverage: null,
    deadline: input.deadline || null,
    detectedAt: new Date().toISOString(),
    tags: ["New intake"],
    requirements: [],
    evidence: [],
    artifacts: [],
    priority: "Medium",
    source: "Demo intake",
  };
}

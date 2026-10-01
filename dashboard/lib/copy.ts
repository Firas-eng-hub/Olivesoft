import type { Job, JobState, MatchStatus } from "./types";

export const jobStateLabels: Record<JobState, string> = {
  queued: "Waiting",
  running: "In progress",
  completed: "Completed",
  failed: "Needs attention",
};

export const operationLabels: Record<Job["operation"], string> = {
  intake: "New tender",
  retry: "Retry",
  proposal: "Proposal",
};

export const matchLabels: Record<MatchStatus, string> = {
  supported: "Supported",
  partial: "Partially supported",
  unsupported: "Not supported yet",
  unknown: "To be confirmed",
};

export function friendlyError(cause: unknown, fallback: string): string {
  if (cause instanceof Error) console.error(cause.message);
  else console.error(cause);
  return fallback;
}

import { seedData } from "./demo-data";
import type { DashboardAdapter, DashboardData } from "./types";

const KEY = "olivesoft-dashboard-demo-v1";

function cloneSeed(): DashboardData {
  return structuredClone(seedData);
}

export const demoAdapter: DashboardAdapter = {
  async load() {
    if (typeof window === "undefined") return cloneSeed();
    const stored = window.localStorage.getItem(KEY);
    if (!stored) return cloneSeed();
    try {
      const parsed: unknown = JSON.parse(stored);
      if (typeof parsed === "object" && parsed !== null && "leads" in parsed && "jobs" in parsed && Array.isArray(parsed.leads) && Array.isArray(parsed.jobs)) {
        return parsed as DashboardData;
      }
    } catch {
      // A broken local demo cache should never block the dashboard.
    }
    return cloneSeed();
  },
  async save(data) {
    window.localStorage.setItem(KEY, JSON.stringify(data));
  },
};

export async function resetDemo(): Promise<DashboardData> {
  window.localStorage.removeItem(KEY);
  return cloneSeed();
}

// A live adapter can implement DashboardAdapter when the authenticated n8n
// read and action webhook paths are finalized. Keep credentials server-side.

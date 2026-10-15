export type User = {
  id: string;
  name: string;
  email: string;
  is_demo: boolean;
  workspace_slug: string;
  created_at: string;
};
export type Service = {
  id: string;
  name: string;
  url: string;
  description: string;
  status: "operational" | "degraded" | "down" | "unknown";
  last_checked: string | null;
  latency_ms: number | null;
  uptime: number | null;
  is_public: boolean;
  is_sample: boolean;
  created_at: string;
};
export type Check = {
  id: string;
  service_id: string;
  status: string;
  latency_ms: number | null;
  status_code: number | null;
  error: string | null;
  checked_at: string;
  is_sample: boolean;
};
export type Incident = {
  id: string;
  title: string;
  description: string;
  severity: "critical" | "major" | "minor";
  status: "investigating" | "identified" | "monitoring" | "resolved";
  service_id: string | null;
  service_name: string | null;
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
  is_sample: boolean;
  updates: {
    id: string;
    message: string;
    status: string;
    created_at: string;
  }[];
};
export type Task = {
  id: string;
  title: string;
  description: string;
  status: "todo" | "in_progress" | "done";
  priority: "low" | "medium" | "high" | "urgent";
  incident_id: string | null;
  created_at: string;
  updated_at: string;
  is_sample: boolean;
};
export type ActivityEntry = {
  id: string;
  type: string;
  message: string;
  created_at: string;
  is_sample: boolean;
};
export type Stats = {
  total_services: number;
  operational_services: number;
  active_incidents: number;
  open_tasks: number;
  uptime: number | null;
  average_latency_ms: number | null;
  total_checks: number;
  is_demo: boolean;
};
export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}
export async function api<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const res = await fetch(`/api${path}`, {
    ...options,
    credentials: "include",
    headers: { "Content-Type": "application/json", ...options.headers },
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const detail = data?.detail;
    throw new ApiError(
      typeof detail === "string"
        ? detail
        : Array.isArray(detail)
          ? detail.map((x: { msg: string }) => x.msg).join(". ")
          : "Something went wrong. Please try again.",
      res.status,
    );
  }
  return data as T;
}
export const post = <T>(path: string, body: unknown = {}) =>
  api<T>(path, { method: "POST", body: JSON.stringify(body) });
export const patch = <T>(path: string, body: unknown) =>
  api<T>(path, { method: "PATCH", body: JSON.stringify(body) });
export const remove = (path: string) =>
  api<{ ok: boolean }>(path, { method: "DELETE" });
export function download(
  content: string,
  filename: string,
  mime = "text/plain",
) {
  const url = URL.createObjectURL(new Blob([content], { type: mime }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function ago(date: string | null) {
  if (!date) return "Not checked";
  const seconds = Math.max(
    0,
    Math.round((Date.now() - new Date(date).getTime()) / 1000),
  );
  return seconds < 60
    ? "Just now"
    : seconds < 3600
      ? `${Math.floor(seconds / 60)}m ago`
      : seconds < 86400
        ? `${Math.floor(seconds / 3600)}h ago`
        : `${Math.floor(seconds / 86400)}d ago`;
}
export function label(value: string) {
  return value.replaceAll("_", " ").replace(/^\w/, (c) => c.toUpperCase());
}

import "server-only";
import { headers } from "next/headers";

export const ADMIN_REQUEST_HEADER = "x-bughub-admin-request";
export const ADMIN_MODE_HEADER = "x-bughub-admin-mode";
export const ADMIN_PATH_HEADER = "x-bughub-admin-path";

export function safeAdminNextPath(value: string | null | undefined, fallback = "/"): string {
  const candidate = value?.trim();
  if (!candidate || !candidate.startsWith("/") || candidate.startsWith("//")) return fallback;
  if (candidate.includes("\\") || /[\u0000-\u001f\u007f]/.test(candidate)) return fallback;
  try {
    const parsed = new URL(candidate, "https://bughub-admin.invalid");
    if (parsed.origin !== "https://bughub-admin.invalid") return fallback;
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return fallback;
  }
}

export function adminHref(cleanPath: string): string {
  const safePath = safeAdminNextPath(cleanPath);
  if (headers().get(ADMIN_MODE_HEADER) === "clean") return safePath;
  const parsed = new URL(safePath, "https://bughub-admin.invalid");
  const pathname = parsed.pathname === "/" ? "" : parsed.pathname;
  return `/admin${pathname}${parsed.search}${parsed.hash}`;
}

export function currentAdminCleanPath(): string {
  return safeAdminNextPath(headers().get(ADMIN_PATH_HEADER));
}

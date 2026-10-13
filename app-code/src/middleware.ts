import { NextRequest, NextResponse } from "next/server";
import { ADMIN_SESSION_COOKIE, passwordFingerprint, verifyAdminSessionToken } from "@/lib/admin-session";

const ADMIN_REQUEST_HEADER = "x-bughub-admin-request";
const ADMIN_MODE_HEADER = "x-bughub-admin-mode";
const ADMIN_PATH_HEADER = "x-bughub-admin-path";

function configuredAdminHostname(): string {
  const configured = process.env.ADMIN_HOST?.trim() || "admin.bughub.vip";
  try {
    return new URL(configured.includes("://") ? configured : `https://${configured}`).hostname.toLowerCase();
  } catch {
    return "admin.bughub.vip";
  }
}

function requestHostname(request: NextRequest): string {
  const raw = request.headers.get("host")
    || request.headers.get("x-forwarded-host")
    || request.nextUrl.host
    || "";
  let host = raw.split(",")[0].trim().toLowerCase();
  if (host.startsWith("[")) {
    // IPv6 literal，例如 [::1]:3100
    const end = host.indexOf("]");
    host = end === -1 ? host.replace(/^\[/, "") : host.slice(1, end);
  } else {
    host = host.replace(/:\d+$/, "");
  }
  return host;
}

function hasPathPrefix(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

/** 不需要会话就能访问的后台路径：登录页，以及退出（没登录时退出也无害，不该被弹去登录）。 */
function isPublicAdminPath(cleanPath: string): boolean {
  return hasPathPrefix(cleanPath, "/login") || cleanPath === "/logout";
}

function cleanRequestHeaders(request: NextRequest): Headers {
  const requestHeaders = new Headers(request.headers);
  requestHeaders.delete(ADMIN_REQUEST_HEADER);
  requestHeaders.delete(ADMIN_MODE_HEADER);
  requestHeaders.delete(ADMIN_PATH_HEADER);
  return requestHeaders;
}

function markAdminRequest(requestHeaders: Headers, mode: "clean" | "prefixed", cleanPath: string): void {
  requestHeaders.set(ADMIN_REQUEST_HEADER, "1");
  requestHeaders.set(ADMIN_MODE_HEADER, mode);
  requestHeaders.set(ADMIN_PATH_HEADER, cleanPath);
}

function withAdminSecurityHeaders(response: NextResponse): NextResponse {
  response.headers.set("Cache-Control", "no-store, max-age=0");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Referrer-Policy", "same-origin");
  response.headers.set("X-Robots-Tag", "noindex, nofollow");
  return response;
}

async function hasValidAdminSession(request: NextRequest): Promise<boolean> {
  const username = process.env.ADMIN_USERNAME?.trim() || "";
  const passwordHash = process.env.ADMIN_PASSWORD_HASH?.trim() || "";
  const secret = process.env.ADMIN_SESSION_SECRET || "";
  if (!username || !passwordHash || secret.length < 32) return false;
  const token = request.cookies.get(ADMIN_SESSION_COOKIE)?.value;
  if (!token) return false;
  // 会话绑定了密码指纹：管理员改密码后，旧会话在这里就会被拒绝。
  const fingerprint = await passwordFingerprint(passwordHash, secret);
  const session = await verifyAdminSessionToken(token, secret, fingerprint);
  return session?.username === username;
}

function adminRobotsResponse(): NextResponse {
  return withAdminSecurityHeaders(new NextResponse("User-agent: *\nDisallow: /\n", {
    status: 200,
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  }));
}

function loginRedirect(
  request: NextRequest,
  mode: "clean" | "prefixed",
  cleanPath: string,
): NextResponse {
  const loginUrl = request.nextUrl.clone();
  loginUrl.pathname = mode === "clean" ? "/login" : "/admin/login";
  loginUrl.search = "";
  loginUrl.searchParams.set("next", `${cleanPath}${request.nextUrl.search}`);
  return withAdminSecurityHeaders(NextResponse.redirect(loginUrl));
}

export async function middleware(request: NextRequest): Promise<NextResponse> {
  const pathname = request.nextUrl.pathname;
  const hostname = requestHostname(request);
  const requestHeaders = cleanRequestHeaders(request);
  const onAdminHost = hostname === configuredAdminHostname();
  const isLocalhost = hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
  const isDevelopment = process.env.NODE_ENV !== "production";
  const isInternalAdminPath = hasPathPrefix(pathname, "/admin");

  if (onAdminHost) {
    if (isInternalAdminPath) {
      const redirectUrl = request.nextUrl.clone();
      redirectUrl.pathname = pathname.slice("/admin".length) || "/";
      return withAdminSecurityHeaders(NextResponse.redirect(redirectUrl));
    }
    if (pathname === "/robots.txt") return adminRobotsResponse();
    markAdminRequest(requestHeaders, "clean", pathname);
    if (!isPublicAdminPath(pathname) && !(await hasValidAdminSession(request))) {
      return loginRedirect(request, "clean", pathname);
    }
    const rewriteUrl = request.nextUrl.clone();
    rewriteUrl.pathname = pathname === "/" ? "/admin" : `/admin${pathname}`;
    return withAdminSecurityHeaders(NextResponse.rewrite(rewriteUrl, { request: { headers: requestHeaders } }));
  }

  if (isDevelopment && isLocalhost && isInternalAdminPath) {
    const cleanPath = pathname.slice("/admin".length) || "/";
    markAdminRequest(requestHeaders, "prefixed", cleanPath);
    if (!isPublicAdminPath(cleanPath) && !(await hasValidAdminSession(request))) {
      return loginRedirect(request, "prefixed", cleanPath);
    }
    return withAdminSecurityHeaders(NextResponse.next({ request: { headers: requestHeaders } }));
  }

  const isCleanAdminPath = hasPathPrefix(pathname, "/login") || hasPathPrefix(pathname, "/bugs");
  if (process.env.NODE_ENV === "production" && (isInternalAdminPath || isCleanAdminPath)) {
    return withAdminSecurityHeaders(new NextResponse("Not Found", {
      status: 404,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    }));
  }

  return NextResponse.next({ request: { headers: requestHeaders } });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};

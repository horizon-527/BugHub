import { NextRequest, NextResponse } from "next/server";
import { ADMIN_SESSION_COOKIE, adminSessionCookieOptions } from "@/lib/admin-session";
import { adminHref } from "@/lib/admin-routing";

export const dynamic = "force-dynamic";

/**
 * 退出登录。做成普通表单 POST + 303，而不是 Server Action：
 * Server Action 改了 Cookie 后，Next 会在同一个响应里重新渲染当前页，
 * 布局发现没有会话就会自己 redirect 到登录页，抢在我们的跳转前面，
 * 结果丢掉“已安全退出”的提示。整页 POST + 303 不经过任何页面重渲染。
 */
export async function POST(request: NextRequest) {
  // 最基本的 CSRF 防护：浏览器带了 Origin 的话，必须和当前 Host 一致。
  const origin = request.headers.get("origin");
  if (origin) {
    let originHost = "";
    try {
      originHost = new URL(origin).host;
    } catch {
      return new NextResponse("Bad Request", { status: 400 });
    }
    if (originHost !== request.headers.get("host")) {
      return new NextResponse("Forbidden", { status: 403 });
    }
  }
  // 相对路径的 Location 是合法的，浏览器会按当前域名解析，避免在代理后面拼错 origin。
  const response = new NextResponse(null, {
    status: 303,
    headers: { Location: adminHref("/login?loggedOut=1"), "Cache-Control": "no-store" },
  });
  response.cookies.set(ADMIN_SESSION_COOKIE, "", { ...adminSessionCookieOptions(), maxAge: 0 });
  return response;
}

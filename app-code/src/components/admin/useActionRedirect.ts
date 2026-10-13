"use client";

import { useEffect } from "react";

/**
 * Server Action 返回 redirectTo 后，由浏览器做整页跳转。
 * 用 location.assign 而不是 router.push：整页请求会带着真实的 Host，
 * 中间件才能正确识别后台域名（原因见 app/admin/actions.ts 顶部注释）。
 * 返回 true 表示正在跳转，可用来禁用按钮。
 */
export function useActionRedirect(redirectTo: string | undefined): boolean {
  useEffect(() => {
    if (redirectTo) window.location.assign(redirectTo);
  }, [redirectTo]);
  return Boolean(redirectTo);
}

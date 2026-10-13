"use server";

/**
 * 关于 redirectTo：
 * 后台是按域名区分的（admin.bughub.vip 由中间件改写到 /admin/*）。
 * Server Action 里调用 redirect() 时，Next 会在服务端用 localhost 内部再请求一次目标页，
 * 这次内部请求的 Host 不是后台域名，会被当成公开站，导致登录后在后台域名下渲染出公开首页。
 * 所以这里的 action 一律只返回 redirectTo，由浏览器做整页跳转（Host 正确）。
 */

import { revalidatePath } from "next/cache";
import { getClientIp, loginAdmin, optionalAdminSession } from "@/lib/admin-auth";
import {
  createBug,
  deleteAdminBug,
  importCard,
  isBugStatus,
  setBugStatus,
  updateBug,
  type AdminBugFormState,
  type AdminBugFormValues,
} from "@/lib/admin-data";
import { adminHref, currentAdminCleanPath, safeAdminNextPath } from "@/lib/admin-routing";

export type LoginFormState = {
  globalError?: string;
  username?: string;
  redirectTo?: string;
};

export type DeleteFormState = {
  globalError?: string;
  redirectTo?: string;
};

export type StatusFormState = {
  globalError?: string;
  redirectTo?: string;
};

export type ImportFormState = {
  errors?: string[];
  globalError?: string;
  redirectTo?: string;
  created?: { id: string; title: string; status: "published" | "draft"; editHref: string };
};

const IMPORT_MAX_LENGTH = 300000;

function formString(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function formValues(formData: FormData): AdminBugFormValues {
  return {
    title: formString(formData, "title"),
    bodyMarkdown: formString(formData, "bodyMarkdown"),
    // 非法值不在这里悄悄改成 published，原样交给 validateForm 报“状态无效”。
    status: formString(formData, "status") as AdminBugFormValues["status"],
    categoryId: formString(formData, "categoryId"),
    subcategoryId: formString(formData, "subcategoryId"),
  };
}

/**
 * 只给“原地刷新”的操作用（列表页的发布/下线）。
 * 注意：任何一次 revalidatePath 都会让 Next 在同一个响应里把“当前页”重新渲染一遍。
 * 对会跳转的操作（新建/保存/删除）千万别调用：删除后当前页变成 404，
 * 按钮组件被卸载，跳转的 effect 就再也不会执行。整页跳转本身就会拿到最新数据，不需要它。
 * 公开站的页面都是 force-dynamic，没有需要失效的缓存。
 */
function refreshAdminList(): void {
  revalidatePath("/admin");
}

function sessionExpired(): { globalError: string; redirectTo: string } {
  const next = encodeURIComponent(currentAdminCleanPath());
  return { globalError: "登录已过期，正在跳转到登录页…", redirectTo: adminHref(`/login?next=${next}`) };
}

export async function loginAction(
  _previousState: LoginFormState,
  formData: FormData,
): Promise<LoginFormState> {
  const username = formString(formData, "username").trim().slice(0, 200);
  const password = formString(formData, "password");
  const next = safeAdminNextPath(formString(formData, "next"));
  if (!username || !password || password.length > 1024) {
    return { username, globalError: "账号或密码错误，请重试" };
  }

  const result = await loginAdmin(username, password, getClientIp());
  if (!result.ok) {
    if (result.reason === "not-configured") {
      return { username, globalError: "后台认证配置不完整，请联系管理员" };
    }
    if (result.reason === "rate-limited") {
      return { username, globalError: "登录尝试次数过多，请 15 分钟后再试" };
    }
    return { username, globalError: "账号或密码错误，请重试" };
  }
  return { username, redirectTo: adminHref(next) };
}

export async function createBugAction(
  _previousState: AdminBugFormState,
  formData: FormData,
): Promise<AdminBugFormState> {
  if (!(await optionalAdminSession())) return { ..._previousState, ...sessionExpired() };
  const result = createBug(formValues(formData));
  if (!result.ok) return result.state;
  return { redirectTo: adminHref("/?success=created") };
}

export async function updateBugAction(
  _previousState: AdminBugFormState,
  formData: FormData,
): Promise<AdminBugFormState> {
  if (!(await optionalAdminSession())) return { ..._previousState, ...sessionExpired() };
  const result = updateBug(
    formString(formData, "originalId"),
    formValues(formData),
    formString(formData, "expectedUpdatedAt"),
  );
  if (!result.ok) return result.state;
  return { redirectTo: adminHref("/?success=updated") };
}

export async function importCardAction(
  _previousState: ImportFormState,
  formData: FormData,
): Promise<ImportFormState> {
  if (!(await optionalAdminSession())) return sessionExpired();
  const card = formString(formData, "card");
  if (!card.trim()) return { errors: ["请先粘贴卡片内容"] };
  if (card.length > IMPORT_MAX_LENGTH) return { errors: [`内容过长（上限 ${IMPORT_MAX_LENGTH} 个字符）`] };
  const result = importCard(card, { forceDraft: formData.get("asDraft") === "on" });
  if (!result.ok) return { errors: result.errors };
  // 不跳转：留在本页方便接着贴下一张，由客户端清空输入框并展示成功信息。
  return {
    created: {
      id: result.id,
      title: result.title,
      status: result.status,
      editHref: adminHref(`/bugs/${encodeURIComponent(result.id)}/edit`),
    },
  };
}

export async function setStatusAction(
  _previousState: StatusFormState,
  formData: FormData,
): Promise<StatusFormState> {
  if (!(await optionalAdminSession())) return sessionExpired();
  const status = formString(formData, "status");
  if (!isBugStatus(status)) return { globalError: "状态无效" };
  const result = setBugStatus(formString(formData, "id"), status, formString(formData, "expectedUpdatedAt"));
  if (!result.ok) return { globalError: result.error };
  // 不跳转：revalidatePath 之后 Next 会在同一个响应里带回刷新后的列表。
  refreshAdminList();
  return {};
}

export async function deleteBugAction(
  _previousState: DeleteFormState,
  formData: FormData,
): Promise<DeleteFormState> {
  if (!(await optionalAdminSession())) return sessionExpired();
  const result = deleteAdminBug(
    formString(formData, "id"),
    formString(formData, "expectedUpdatedAt"),
  );
  if (!result.ok) return { globalError: result.error };
  return { redirectTo: adminHref("/?success=deleted") };
}

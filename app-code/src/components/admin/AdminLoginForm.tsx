"use client";

import { useFormState, useFormStatus } from "react-dom";
import { loginAction, type LoginFormState } from "@/app/admin/actions";
import { useActionRedirect } from "@/components/admin/useActionRedirect";

type AdminLoginFormProps = {
  next: string;
  configured: boolean;
  missing: string[];
};

const initialState: LoginFormState = {};

function LoginSubmit({ disabled, redirecting }: { disabled: boolean; redirecting: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button className="admin-button admin-button-primary admin-login-submit" type="submit" disabled={disabled || pending || redirecting}>
      {pending ? "正在验证…" : redirecting ? "登录成功，正在跳转…" : "登录"}
    </button>
  );
}

export default function AdminLoginForm({ next, configured, missing }: AdminLoginFormProps) {
  const [state, formAction] = useFormState(loginAction, initialState);
  const redirecting = useActionRedirect(state.redirectTo);
  return (
    <form className="admin-login-form" action={formAction}>
      <input type="hidden" name="next" value={next} />
      {!configured && (
        <div className="admin-alert admin-alert-warning" role="alert">
          <strong>后台认证尚未配置完整</strong>
          <span>缺少或格式无效：{missing.join("、")}</span>
          {missing.includes("ADMIN_PASSWORD_HASH") && (
            <span>提示：密码哈希里的 $ 在 .env 中必须写成 \$；用 npm run admin:hash-password 生成的结果已经转义好，可直接粘贴。</span>
          )}
        </div>
      )}
      {state.globalError && <div className="admin-alert admin-alert-error" role="alert">{state.globalError}</div>}
      <label className="admin-field">
        <span className="admin-label">账号</span>
        <input
          className="admin-input"
          name="username"
          type="text"
          autoComplete="username"
          defaultValue={state.username || ""}
          maxLength={200}
          required
          autoFocus
        />
      </label>
      <label className="admin-field">
        <span className="admin-label">密码</span>
        <input
          className="admin-input"
          name="password"
          type="password"
          autoComplete="current-password"
          maxLength={1024}
          required
        />
      </label>
      <LoginSubmit disabled={!configured} redirecting={redirecting} />
    </form>
  );
}

"use client";

import type { FormEvent } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { setStatusAction, type StatusFormState } from "@/app/admin/actions";
import { useActionRedirect } from "@/components/admin/useActionRedirect";

type AdminStatusToggleProps = {
  id: string;
  status: "published" | "draft";
  expectedUpdatedAt: string;
};

const initialState: StatusFormState = {};

function ToggleSubmit({ unpublishing }: { unpublishing: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button className="admin-inline-button" type="submit" disabled={pending}>
      {pending ? "处理中…" : unpublishing ? "下线" : "发布"}
    </button>
  );
}

export default function AdminStatusToggle({ id, status, expectedUpdatedAt }: AdminStatusToggleProps) {
  const [state, formAction] = useFormState(setStatusAction, initialState);
  useActionRedirect(state.redirectTo);
  const unpublishing = status === "published";
  const target = unpublishing ? "draft" : "published";

  function confirmUnpublish(event: FormEvent<HTMLFormElement>) {
    // 下线会让公开页面立刻 404，只对这个方向二次确认。
    if (unpublishing && !window.confirm(`确定要下线 ${id} 吗？下线后公开页面将无法访问。`)) event.preventDefault();
  }

  return (
    <form className="admin-inline-form" action={formAction} onSubmit={confirmUnpublish}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="status" value={target} />
      <input type="hidden" name="expectedUpdatedAt" value={expectedUpdatedAt} />
      <ToggleSubmit unpublishing={unpublishing} />
      {state.globalError && <span className="admin-field-error" role="alert">{state.globalError}</span>}
    </form>
  );
}

"use client";

import type { FormEvent } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { deleteBugAction, type DeleteFormState } from "@/app/admin/actions";
import { useActionRedirect } from "@/components/admin/useActionRedirect";

type AdminDeleteButtonProps = {
  id: string;
  expectedUpdatedAt: string;
};

const initialState: DeleteFormState = {};

function DeleteSubmit({ redirecting }: { redirecting: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button className="admin-button admin-button-danger" type="submit" disabled={pending || redirecting}>
      {pending ? "正在删除…" : redirecting ? "已删除，正在跳转…" : "删除内容"}
    </button>
  );
}

export default function AdminDeleteButton({ id, expectedUpdatedAt }: AdminDeleteButtonProps) {
  const [state, formAction] = useFormState(deleteBugAction, initialState);
  const redirecting = useActionRedirect(state.redirectTo);
  function confirmDelete(event: FormEvent<HTMLFormElement>) {
    if (!window.confirm(`确定要永久删除 ${id} 吗？此操作不可恢复。`)) event.preventDefault();
  }

  return (
    <form className="admin-delete-form" action={formAction} onSubmit={confirmDelete}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="expectedUpdatedAt" value={expectedUpdatedAt} />
      {state.globalError && <p className="admin-field-error" role="alert">{state.globalError}</p>}
      <DeleteSubmit redirecting={redirecting} />
    </form>
  );
}

/** 把数据库里的 UTC 时间格式化成上海时区的 “YYYY/MM/DD HH:mm”。纯函数，服务端/客户端都可用。 */
export function formatAdminTime(value: string): string {
  const normalized = value.includes("T") ? value : `${value.replace(" ", "T")}Z`;
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

export const STATUS_LABELS = { published: "已发布", draft: "草稿" } as const;

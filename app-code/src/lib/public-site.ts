/** 公开站点的 origin，用于后台里“预览公开页面”的链接。只接受 http/https，其余回退到默认值。 */
export function publicSiteOrigin(): string {
  const fallback = "https://bughub.vip";
  const configured = process.env.PUBLIC_SITE_URL?.trim() || fallback;
  try {
    const parsed = new URL(configured);
    return parsed.protocol === "http:" || parsed.protocol === "https:" ? parsed.origin : fallback;
  } catch {
    return fallback;
  }
}

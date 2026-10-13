import gfm from "@bytemd/plugin-gfm";
import gfmLocale from "@bytemd/plugin-gfm/locales/zh_Hans.json";
import highlightSsr from "@bytemd/plugin-highlight-ssr";
import type { BytemdPlugin } from "bytemd";

export function bytemdPlugins(): BytemdPlugin[] {
  return [gfm({ locale: gfmLocale }), highlightSsr()];
}

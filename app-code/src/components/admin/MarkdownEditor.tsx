"use client";

import { useMemo } from "react";
import { Editor } from "@bytemd/react";
import zhHans from "bytemd/locales/zh_Hans.json";
import { bytemdPlugins } from "@/lib/bytemd-plugins";
import "bytemd/dist/index.css";
import "github-markdown-css/github-markdown-light.css";
import "highlight.js/styles/github.css";

type MarkdownEditorProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
};

export default function MarkdownEditor({ value, onChange, placeholder }: MarkdownEditorProps) {
  const plugins = useMemo(() => bytemdPlugins(), []);
  return (
    <Editor
      value={value}
      plugins={plugins}
      locale={zhHans}
      placeholder={placeholder}
      onChange={onChange}
    />
  );
}

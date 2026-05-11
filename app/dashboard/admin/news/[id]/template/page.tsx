"use client";

// Template editor route. Працює з News-записами, що мають `templateKind`.
// Якщо templateKind=null — TemplateEditor показує помилку і пропонує відкрити
// звичайний редактор (block-canvas).

import dynamic from "next/dynamic";
import { useParams } from "next/navigation";

const TemplateEditor = dynamic(
  () => import("../../_components/template-editor/TemplateEditor"),
  {
    ssr: false,
    loading: () => (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 300 }}>
        <div style={{ width: 32, height: 32, border: "3px solid #1C3A2E", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
      </div>
    ),
  },
);

export default function TemplateEditorPage() {
  const params = useParams();
  const id = Array.isArray(params.id) ? params.id[0] : (params.id as string);
  if (!id) return null;
  return <TemplateEditor newsId={id} />;
}

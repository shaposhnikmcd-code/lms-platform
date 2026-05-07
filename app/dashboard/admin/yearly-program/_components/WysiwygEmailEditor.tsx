'use client';

import { useEditor, EditorContent } from '@tiptap/react';
import { Extension } from '@tiptap/core';
import { Plugin } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import Link from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import { useEffect } from 'react';
import { SkeletonBox, SkeletonFooterTick } from './EmailEditorParts';

/// ProseMirror decoration: робить `{xxx}` та `{{xxx}}` токени візуальними амбер-чіпами.
/// Не модифікує документ — `editor.getHTML()` повертає plain текст як було.
/// Підтримує обидва формати, бо payment/reminder-шаблони використовують `{x}`,
/// а cohort welcome — `{{x}}`.
const PLACEHOLDER_REGEX = /\{\{?[a-zA-Z][a-zA-Z0-9_-]*\}\}?/g;

const PlaceholderHighlight = Extension.create({
  name: 'placeholderHighlight',
  addProseMirrorPlugins() {
    return [
      new Plugin({
        props: {
          decorations(state) {
            const decorations: Decoration[] = [];
            state.doc.descendants((node, pos) => {
              if (!node.isText) return;
              const text = node.text ?? '';
              const re = new RegExp(PLACEHOLDER_REGEX);
              let m: RegExpExecArray | null;
              while ((m = re.exec(text)) !== null) {
                const from = pos + m.index;
                const to = from + m[0].length;
                decorations.push(
                  Decoration.inline(from, to, {
                    class: 'tiptap-placeholder-chip',
                  }),
                );
              }
            });
            return DecorationSet.create(state.doc, decorations);
          },
        },
      }),
    ];
  },
});
import {
  HiOutlineBold,
  HiOutlineItalic,
  HiOutlineUnderline,
  HiOutlineListBullet,
  HiOutlineQueueList,
  HiOutlineLink,
  HiOutlineH1,
  HiOutlineH2,
  HiOutlineCodeBracket,
} from 'react-icons/hi2';

type Theme = 'light' | 'dark';

/// WYSIWYG-редактор для тіла листа (TipTap). Менеджер бачить лише текст і базові кнопки
/// форматування — без HTML-тегів. Output — HTML-фрагмент (inner content), який API
/// обгортає у стандартний UIMP-layout перед збереженням і рендером прев'ю.
export default function WysiwygEmailEditor({
  value,
  onChange,
  theme,
  placeholders,
  placeholderFormat = 'single',
  paperMaxWidth = 640,
}: {
  value: string;
  onChange: (innerHtml: string) => void;
  theme: Theme;
  placeholders?: string[];
  /// `single` → `{name}` (payment/reminder templates), `double` → `{{name}}` (cohort welcome).
  placeholderFormat?: 'single' | 'double';
  /// Максимальна ширина паперового блоку всередині редактора. Default 640 — як EmailPreviewFrame
  /// (візуальна симетрія з прев'ю). У side-by-side layout (Listі Нагадування) передається
  /// `null`/менше значення, щоб редактор займав всю колонку без зайвого порожнього простору.
  paperMaxWidth?: number | null;
}) {
  const dark = theme === 'dark';

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
      }),
      Underline,
      Link.configure({
        openOnClick: false,
        autolink: true,
        linkOnPaste: true,
        HTMLAttributes: { rel: 'noopener', style: 'color: #b08d3f;' },
      }),
      Placeholder.configure({ placeholder: 'Введіть текст листа…' }),
      PlaceholderHighlight,
    ],
    content: value || '',
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
    editorProps: {
      attributes: {
        // `tiptap-email-body` нижче глобально перебиває font-family/size/spacing щоб
        // редактор рендерив текст 1-в-1 як email iframe (Arial 16px, line-height 1.6).
        // Без `prose` — повний контроль через явні правила, без ризику drift-у з оновленням
        // @tailwindcss/typography.
        class: `tiptap-email-body max-w-none focus:outline-none min-h-[320px] px-6 py-6 ${
          dark ? 'text-slate-100' : 'text-stone-800'
        }`,
      },
    },
  });

  // Sync якщо value змінилось ззовні (наприклад, після Скинути до дефолту).
  useEffect(() => {
    if (!editor) return;
    if (editor.getHTML() === value) return;
    editor.commands.setContent(value || '', { emitUpdate: false });
  }, [value, editor]);

  if (!editor) {
    // Skeleton-плейсхолдер імітує реальний редактор: тулбар-смужка зверху + контент-область знизу.
    // Layout 1:1, тому коли TipTap піднімається — нічого не стрибає.
    return (
      <div className={`rounded-lg border overflow-hidden ${
        dark ? 'border-white/10 bg-zinc-900' : 'border-stone-300 bg-white'
      }`}>
        <div className={`px-2 py-2 border-b flex items-center gap-1.5 flex-wrap ${
          dark ? 'border-white/[0.06] bg-white/[0.02]' : 'border-stone-200 bg-stone-50/60'
        }`}>
          {Array.from({ length: 9 }).map((_, i) => (
            <SkeletonBox key={i} dark={dark} width="28px" height="26px" delay={i * 50} rounded="rounded-md" />
          ))}
          <span className={`mx-1 h-5 w-px ${dark ? 'bg-white/10' : 'bg-stone-300'}`} />
          {Array.from({ length: 4 }).map((_, i) => (
            <SkeletonBox key={i} dark={dark} width="60px" height="22px" delay={450 + i * 50} rounded="rounded-md" />
          ))}
        </div>
        <div className="px-4 py-4 space-y-2.5 min-h-[260px]">
          <SkeletonBox dark={dark} width="62%" height="11px" delay={300} />
          <SkeletonBox dark={dark} width="92%" height="9px" delay={360} />
          <SkeletonBox dark={dark} width="88%" height="9px" delay={420} />
          <SkeletonBox dark={dark} width="74%" height="9px" delay={480} />
          <div className="h-2" />
          <SkeletonBox dark={dark} width="40%" height="11px" delay={540} />
          <SkeletonBox dark={dark} width="80%" height="9px" delay={600} />
          <SkeletonBox dark={dark} width="55%" height="9px" delay={660} />
        </div>
        <SkeletonFooterTick dark={dark} label="Завантажую редактор…" />
      </div>
    );
  }

  const promptLink = () => {
    const prev = editor.getAttributes('link').href as string | undefined;
    const url = window.prompt('URL посилання (порожнє — прибрати):', prev ?? 'https://');
    if (url === null) return;
    if (url === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
  };

  const insertPlaceholder = (name: string) => {
    const token = placeholderFormat === 'double' ? `{{${name}}}` : `{${name}}`;
    editor.chain().focus().insertContent(token).run();
  };

  const placeholderLabel = (name: string) => placeholderFormat === 'double' ? `{{${name}}}` : `{${name}}`;

  return (
    <div className={`rounded-lg border overflow-hidden ${dark ? 'border-white/10 bg-zinc-950' : 'border-stone-300 bg-stone-100'}`}>
      {/* Глобальні стилі: типографіка редактора 1-в-1 з email-iframe-ом (Arial 16px,
          line-height 1.6, такі ж розміри h2/h3, padding-и, list-стилі). Це гарантує
          що менеджер бачить ТОЧНО таке саме форматування у редакторі і у прев'ю,
          без візуального drift-у. Окремо — амбер-чіпи плейсхолдерів. */}
      <style jsx global>{`
        .tiptap-email-body {
          font-family: Arial, Helvetica, sans-serif;
          font-size: 16px;
          line-height: 1.6;
        }
        .tiptap-email-body p,
        .tiptap-email-body li {
          font-family: Arial, Helvetica, sans-serif;
          font-size: 16px;
          line-height: 1.6;
          margin: 0 0 12px;
        }
        .tiptap-email-body h2 {
          font-family: Arial, Helvetica, sans-serif;
          font-size: 22px;
          line-height: 1.3;
          font-weight: 700;
          margin: 0 0 16px;
        }
        .tiptap-email-body h3 {
          font-family: Arial, Helvetica, sans-serif;
          font-size: 18px;
          line-height: 1.3;
          font-weight: 700;
          margin: 24px 0 8px;
        }
        .tiptap-email-body ul,
        .tiptap-email-body ol {
          margin: 0 0 16px;
          padding-left: 20px;
        }
        .tiptap-email-body ul { list-style: disc; }
        .tiptap-email-body ol { list-style: decimal; }
        .tiptap-email-body li { margin-bottom: 8px; }
        .tiptap-email-body a {
          color: #b08d3f;
          text-decoration: underline;
        }
        .tiptap-email-body strong, .tiptap-email-body b { font-weight: 700; }
        .tiptap-email-body em, .tiptap-email-body i { font-style: italic; }

        /* Амбер-чіпи плейсхолдерів усередині редактора. */
        .tiptap-placeholder-chip {
          background: rgba(212, 168, 67, 0.18);
          color: #92400e;
          padding: 1px 5px;
          margin: 0 1px;
          border-radius: 5px;
          border: 1px solid rgba(212, 168, 67, 0.40);
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
          font-size: 0.92em;
          font-weight: 600;
          letter-spacing: -0.01em;
          white-space: nowrap;
        }
        .dark .tiptap-placeholder-chip,
        [data-theme="dark"] .tiptap-placeholder-chip {
          background: rgba(212, 168, 67, 0.20);
          color: #fde68a;
          border-color: rgba(212, 168, 67, 0.50);
        }
      `}</style>
      {/* Chrome row 1 — toolbar форматування. Фіксована висота, без wrap-у щоб
          chrome завжди займав 1 рядок і вирівнювався з title-bar-ом прев'ю. */}
      <div className={`flex items-center gap-0.5 px-3 py-2 border-b overflow-x-auto [scrollbar-width:thin] ${
        dark ? 'border-white/10 bg-white/[0.03]' : 'border-stone-200 bg-stone-50'
      }`}>
        <ToolbarBtn dark={dark} active={editor.isActive('bold')} onClick={() => editor.chain().focus().toggleBold().run()} title="Жирний (Ctrl+B)">
          <HiOutlineBold />
        </ToolbarBtn>
        <ToolbarBtn dark={dark} active={editor.isActive('italic')} onClick={() => editor.chain().focus().toggleItalic().run()} title="Курсив (Ctrl+I)">
          <HiOutlineItalic />
        </ToolbarBtn>
        <ToolbarBtn dark={dark} active={editor.isActive('underline')} onClick={() => editor.chain().focus().toggleUnderline().run()} title="Підкреслення (Ctrl+U)">
          <HiOutlineUnderline />
        </ToolbarBtn>
        <ToolbarSep dark={dark} />
        <ToolbarBtn dark={dark} active={editor.isActive('heading', { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} title="Заголовок 2">
          <HiOutlineH1 />
        </ToolbarBtn>
        <ToolbarBtn dark={dark} active={editor.isActive('heading', { level: 3 })} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} title="Заголовок 3">
          <HiOutlineH2 />
        </ToolbarBtn>
        <ToolbarSep dark={dark} />
        <ToolbarBtn dark={dark} active={editor.isActive('bulletList')} onClick={() => editor.chain().focus().toggleBulletList().run()} title="Маркований список">
          <HiOutlineListBullet />
        </ToolbarBtn>
        <ToolbarBtn dark={dark} active={editor.isActive('orderedList')} onClick={() => editor.chain().focus().toggleOrderedList().run()} title="Нумерований список">
          <HiOutlineQueueList />
        </ToolbarBtn>
        <ToolbarSep dark={dark} />
        <ToolbarBtn dark={dark} active={editor.isActive('link')} onClick={promptLink} title="Посилання">
          <HiOutlineLink />
        </ToolbarBtn>
      </div>

      {/* Chrome row 2 — placeholder-пілюлі, окремою смужкою. Висота +/- однакова
          з 2-ою смужкою прев'ю (шапка з адресою) щоб chrome editor-а і preview-а
          сумарно дорівнювали по висоті — і контент стартував на одному Y. */}
      {placeholders && placeholders.length > 0 && (
        <div className={`flex items-center gap-1.5 px-3 py-1.5 border-b overflow-x-auto [scrollbar-width:thin] ${
          dark ? 'border-white/[0.06] bg-white/[0.015]' : 'border-stone-200/70 bg-stone-50/40'
        }`}>
          <span className={`shrink-0 inline-flex items-center gap-1 text-[10px] uppercase tracking-wider font-semibold mr-1 ${dark ? 'text-slate-500' : 'text-stone-500'}`}>
            <HiOutlineCodeBracket className="text-[12px]" />
            Поля:
          </span>
          {placeholders.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => insertPlaceholder(p)}
              title={`Вставити поле ${placeholderLabel(p)}`}
              className={`shrink-0 px-2 py-0.5 rounded text-[10.5px] font-mono transition-colors ${
                dark
                  ? 'bg-amber-500/15 text-amber-300 hover:bg-amber-500/25 border border-amber-400/30'
                  : 'bg-amber-100 text-amber-900 hover:bg-amber-200 border border-amber-300/60'
              }`}
            >
              {placeholderLabel(p)}
            </button>
          ))}
        </div>
      )}

      {/* Editor "viewport" — фоновий шар (як email-клієнт), а всередині паперовий блок
          по центру (default 640px), що візуально матчиться з прев'ю-листом. У side-by-side
          layout-і paperMaxWidth=null → редактор розгортається на всю ширину колонки.
          py-3 (12px) + EditorContent внутрішнє py-6 (24px) = 36px від chrome до контенту,
          точно як у iframe-прев'ю (body padding 12px + email layout padding 24px). */}
      <div className={`px-4 py-3 sm:px-6 sm:py-3 ${dark ? 'bg-zinc-950' : 'bg-stone-100'}`}>
        <div
          className={`mx-auto rounded shadow-sm overflow-hidden ${dark ? 'bg-zinc-900' : 'bg-white'}`}
          style={paperMaxWidth ? { maxWidth: paperMaxWidth } : undefined}
        >
          <EditorContent editor={editor} />
        </div>
      </div>
    </div>
  );
}

function ToolbarBtn({
  dark, active, onClick, title, children,
}: {
  dark: boolean;
  active: boolean;
  onClick: () => void;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={`w-7 h-7 flex items-center justify-center rounded transition-colors text-[14px] ${
        active
          ? dark
            ? 'bg-amber-500/25 text-amber-200'
            : 'bg-amber-200 text-amber-900'
          : dark
            ? 'text-slate-300 hover:bg-white/[0.06]'
            : 'text-stone-700 hover:bg-stone-200'
      }`}
    >
      {children}
    </button>
  );
}

function ToolbarSep({ dark }: { dark: boolean }) {
  return <div className={`w-px h-5 mx-0.5 ${dark ? 'bg-white/10' : 'bg-stone-300'}`} />;
}

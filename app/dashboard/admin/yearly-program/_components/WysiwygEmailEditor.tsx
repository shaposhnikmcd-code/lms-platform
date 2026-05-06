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
}: {
  value: string;
  onChange: (innerHtml: string) => void;
  theme: Theme;
  placeholders?: string[];
  /// `single` → `{name}` (payment/reminder templates), `double` → `{{name}}` (cohort welcome).
  placeholderFormat?: 'single' | 'double';
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
        class: `tiptap-email-body prose prose-sm max-w-none focus:outline-none min-h-[320px] px-4 py-3 ${
          dark ? 'text-slate-100' : 'text-stone-800'
        }`,
        style: 'font-family: Arial, Helvetica, sans-serif; line-height: 1.6;',
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
    return (
      <div className={`rounded-lg border min-h-[320px] flex items-center justify-center text-[12px] ${
        dark ? 'border-white/10 bg-white/[0.03] text-slate-500' : 'border-stone-300 bg-stone-50 text-stone-500'
      }`}>
        Завантажую редактор…
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
    <div className={`rounded-lg border overflow-hidden ${dark ? 'border-white/10 bg-zinc-950/50' : 'border-stone-300 bg-white'}`}>
      {/* Стилі для амбер-чіпів плейсхолдерів усередині редактора. */}
      <style jsx global>{`
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
      {/* Toolbar */}
      <div className={`flex flex-wrap items-center gap-0.5 px-2 py-1.5 border-b ${
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
        <ToolbarSep dark={dark} />
        {placeholders && placeholders.length > 0 && (
          <div className="flex items-center gap-1 ml-1 flex-wrap">
            <span className={`text-[10px] uppercase tracking-wider font-semibold ${dark ? 'text-slate-500' : 'text-stone-500'}`}>
              <HiOutlineCodeBracket className="inline -mt-0.5 mr-0.5" />
              Дані:
            </span>
            {placeholders.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => insertPlaceholder(p)}
                title={`Вставити поле ${placeholderLabel(p)}`}
                className={`px-1.5 py-0.5 rounded text-[10.5px] font-mono transition-colors ${
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
      </div>

      {/* Editor */}
      <EditorContent editor={editor} />
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

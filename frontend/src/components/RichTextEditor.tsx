'use client';

import React, { useCallback, useState } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import TextAlign from '@tiptap/extension-text-align';
import Placeholder from '@tiptap/extension-placeholder';
import Paragraph from '@tiptap/extension-paragraph';
import {
  Undo2,
  Redo2,
  ChevronUp,
  ChevronDown,
  Bold,
  Italic,
  Underline as UnderlineIcon,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  List,
  ListOrdered,
  Indent,
  Outdent,
  Quote,
  Strikethrough,
  ChevronsUpDown,
} from 'lucide-react';

// Custom Paragraph extension to support font-size, line-height, and paragraph indentation
const CustomParagraph = Paragraph.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      fontSize: {
        default: null,
        parseHTML: (element) => element.style.fontSize || null,
        renderHTML: (attributes) => {
          if (!attributes.fontSize) return {};
          return { style: `font-size: ${attributes.fontSize}` };
        },
      },
      lineHeight: {
        default: null,
        parseHTML: (element) => element.style.lineHeight || null,
        renderHTML: (attributes) => {
          if (!attributes.lineHeight) return {};
          return { style: `line-height: ${attributes.lineHeight}` };
        },
      },
      indent: {
        default: 0,
        parseHTML: (element) => {
          const ml = element.style.marginLeft || '0';
          return parseInt(ml, 10) / 24 || 0;
        },
        renderHTML: (attributes) => {
          if (!attributes.indent) return {};
          return { style: `margin-left: ${attributes.indent * 24}px` };
        },
      },
    };
  },
});

interface RichTextEditorProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
}

const FONT_SIZES = ['12px', '14px', '16px', '18px', '22px', '28px'];
const LINE_HEIGHTS = ['1.2', '1.4', '1.6', '1.8', '2.0'];

export default function RichTextEditor({
  value,
  onChange,
  placeholder = 'Type Your Reply...',
}: RichTextEditorProps) {
  const [currentFontSizeIndex, setCurrentFontSizeIndex] = useState(1); // default '14px'
  const [currentLineHeightIndex, setCurrentLineHeightIndex] = useState(2); // default '1.6'

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        paragraph: false,
        bulletList: {
          keepMarks: true,
          keepAttributes: false,
        },
        orderedList: {
          keepMarks: true,
          keepAttributes: false,
        },
      }),
      CustomParagraph,
      Underline,
      TextAlign.configure({
        types: ['paragraph', 'heading'],
      }),
      Placeholder.configure({
        placeholder,
        emptyEditorClass: 'is-editor-empty',
      }),
    ],
    content: value,
    onUpdate: ({ editor }) => {
      const html = editor.getHTML();
      onChange(html === '<p></p>' ? '' : html);
    },
    editorProps: {
      attributes: {
        class:
          'w-full min-h-[180px] max-h-[320px] p-4 text-sm text-gray-900 focus:outline-none overflow-y-auto [&_p]:my-1.5 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_blockquote]:border-l-2 [&_blockquote]:border-gray-300 [&_blockquote]:pl-3 [&_blockquote]:italic [&_blockquote]:text-gray-600 [&_blockquote]:my-2',
      },
    },
  });

  // Font Size Stepper
  const changeFontSize = useCallback(
    (direction: 'up' | 'down') => {
      if (!editor) return;
      let nextIndex = direction === 'up' ? currentFontSizeIndex + 1 : currentFontSizeIndex - 1;
      if (nextIndex < 0) nextIndex = 0;
      if (nextIndex >= FONT_SIZES.length) nextIndex = FONT_SIZES.length - 1;
      setCurrentFontSizeIndex(nextIndex);
      const size = FONT_SIZES[nextIndex];
      editor.chain().focus().updateAttributes('paragraph', { fontSize: size }).run();
    },
    [editor, currentFontSizeIndex]
  );

  // Line Height Stepper
  const changeLineHeight = useCallback(
    (direction: 'up' | 'down') => {
      if (!editor) return;
      let nextIndex = direction === 'up' ? currentLineHeightIndex + 1 : currentLineHeightIndex - 1;
      if (nextIndex < 0) nextIndex = 0;
      if (nextIndex >= LINE_HEIGHTS.length) nextIndex = LINE_HEIGHTS.length - 1;
      setCurrentLineHeightIndex(nextIndex);
      const lh = LINE_HEIGHTS[nextIndex];
      editor.chain().focus().updateAttributes('paragraph', { lineHeight: lh }).run();
    },
    [editor, currentLineHeightIndex]
  );

  // Text Alignment Toggle (Cycle Left -> Center -> Right)
  const cycleTextAlign = useCallback(() => {
    if (!editor) return;
    if (editor.isActive({ textAlign: 'left' })) {
      editor.chain().focus().setTextAlign('center').run();
    } else if (editor.isActive({ textAlign: 'center' })) {
      editor.chain().focus().setTextAlign('right').run();
    } else {
      editor.chain().focus().setTextAlign('left').run();
    }
  }, [editor]);

  // Indent / Outdent
  const changeIndent = useCallback(
    (delta: number) => {
      if (!editor) return;
      const currentIndent = (editor.getAttributes('paragraph').indent as number) || 0;
      const nextIndent = Math.max(0, Math.min(8, currentIndent + delta));
      editor.chain().focus().updateAttributes('paragraph', { indent: nextIndent }).run();
    },
    [editor]
  );

  // Block alignment toggle
  const toggleBlockAlign = useCallback(() => {
    if (!editor) return;
    if (editor.isActive({ textAlign: 'justify' })) {
      editor.chain().focus().setTextAlign('left').run();
    } else {
      editor.chain().focus().setTextAlign('justify').run();
    }
  }, [editor]);

  if (!editor) {
    return null;
  }

  // Current alignment icon
  const AlignIcon = editor.isActive({ textAlign: 'center' })
    ? AlignCenter
    : editor.isActive({ textAlign: 'right' })
    ? AlignRight
    : AlignLeft;

  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden mt-4 bg-white shadow-2xs">
      {/* TipTap Custom Toolbar matching exact specified layout */}
      <div className="px-3 py-2 bg-gray-50/70 border-b border-gray-200 flex flex-wrap items-center gap-1 text-gray-600 select-none">
        {/* Group 1: [ undo | redo ] */}
        <button
          type="button"
          title="Undo"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => editor.chain().focus().undo().run()}
          disabled={!editor.can().undo()}
          className="p-1.5 hover:bg-gray-200/60 rounded text-gray-600 disabled:opacity-40 transition-colors"
        >
          <Undo2 className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          title="Redo"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => editor.chain().focus().redo().run()}
          disabled={!editor.can().redo()}
          className="p-1.5 hover:bg-gray-200/60 rounded text-gray-600 disabled:opacity-40 transition-colors"
        >
          <Redo2 className="w-3.5 h-3.5" />
        </button>

        {/* Separator */}
        <div className="w-[1px] h-4 bg-gray-300 mx-1"></div>

        {/* Group 2: [ font size (Tt with up/down stepper) ] */}
        <div className="flex items-center px-1.5 py-0.5 rounded text-gray-700 bg-white/80 border border-gray-200/80 shadow-2xs">
          <span className="text-xs font-semibold tracking-tight text-gray-800 pr-1">Tt</span>
          <div className="flex flex-col -space-y-1">
            <button
              type="button"
              title="Increase font size"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => changeFontSize('up')}
              className="p-0.5 hover:text-black hover:bg-gray-100 rounded"
            >
              <ChevronUp className="w-2.5 h-2.5 stroke-[2.5]" />
            </button>
            <button
              type="button"
              title="Decrease font size"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => changeFontSize('down')}
              className="p-0.5 hover:text-black hover:bg-gray-100 rounded"
            >
              <ChevronDown className="w-2.5 h-2.5 stroke-[2.5]" />
            </button>
          </div>
        </div>

        {/* Separator */}
        <div className="w-[1px] h-4 bg-gray-300 mx-1"></div>

        {/* Group 3: [ Bold | Italic | Underline ] */}
        <button
          type="button"
          title="Bold"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => editor.chain().focus().toggleBold().run()}
          className={`p-1.5 rounded transition-colors ${
            editor.isActive('bold')
              ? 'bg-gray-200 text-gray-900 font-bold shadow-2xs'
              : 'text-gray-600 hover:bg-gray-200/60'
          }`}
        >
          <Bold className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          title="Italic"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => editor.chain().focus().toggleItalic().run()}
          className={`p-1.5 rounded transition-colors ${
            editor.isActive('italic')
              ? 'bg-gray-200 text-gray-900 italic shadow-2xs'
              : 'text-gray-600 hover:bg-gray-200/60'
          }`}
        >
          <Italic className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          title="Underline"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          className={`p-1.5 rounded transition-colors ${
            editor.isActive('underline')
              ? 'bg-gray-200 text-gray-900 underline shadow-2xs'
              : 'text-gray-600 hover:bg-gray-200/60'
          }`}
        >
          <UnderlineIcon className="w-3.5 h-3.5" />
        </button>

        {/* Separator */}
        <div className="w-[1px] h-4 bg-gray-300 mx-1"></div>

        {/* Group 4: [ text align | line-height (up/down) ] */}
        <button
          type="button"
          title="Cycle Text Align"
          onMouseDown={(e) => e.preventDefault()}
          onClick={cycleTextAlign}
          className="p-1.5 hover:bg-gray-200/60 rounded text-gray-600 transition-colors"
        >
          <AlignIcon className="w-3.5 h-3.5" />
        </button>

        {/* Line-height up/down stepper */}
        <div className="flex items-center px-1 py-0.5 rounded text-gray-700 bg-white/80 border border-gray-200/80 shadow-2xs">
          <ChevronsUpDown className="w-3 h-3 text-gray-500 mr-0.5" />
          <div className="flex flex-col -space-y-1">
            <button
              type="button"
              title="Increase line height"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => changeLineHeight('up')}
              className="p-0.5 hover:text-black hover:bg-gray-100 rounded"
            >
              <ChevronUp className="w-2.5 h-2.5 stroke-[2.5]" />
            </button>
            <button
              type="button"
              title="Decrease line height"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => changeLineHeight('down')}
              className="p-0.5 hover:text-black hover:bg-gray-100 rounded"
            >
              <ChevronDown className="w-2.5 h-2.5 stroke-[2.5]" />
            </button>
          </div>
        </div>

        {/* Separator */}
        <div className="w-[1px] h-4 bg-gray-300 mx-1"></div>

        {/* Group 5: [ ordered list | bullet list | indent | outdent | blockquote | align-block ] */}
        <button
          type="button"
          title="Ordered List (1, 2.)"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          className={`p-1.5 rounded transition-colors ${
            editor.isActive('orderedList')
              ? 'bg-gray-200 text-gray-900 shadow-2xs'
              : 'text-gray-600 hover:bg-gray-200/60'
          }`}
        >
          <ListOrdered className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          title="Bullet List"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          className={`p-1.5 rounded transition-colors ${
            editor.isActive('bulletList')
              ? 'bg-gray-200 text-gray-900 shadow-2xs'
              : 'text-gray-600 hover:bg-gray-200/60'
          }`}
        >
          <List className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          title="Increase Indent"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => changeIndent(1)}
          className="p-1.5 hover:bg-gray-200/60 rounded text-gray-600 transition-colors"
        >
          <Indent className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          title="Decrease Indent"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => changeIndent(-1)}
          className="p-1.5 hover:bg-gray-200/60 rounded text-gray-600 transition-colors"
        >
          <Outdent className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          title="Blockquote (66)"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          className={`p-1.5 rounded transition-colors ${
            editor.isActive('blockquote')
              ? 'bg-gray-200 text-gray-900 shadow-2xs'
              : 'text-gray-600 hover:bg-gray-200/60'
          }`}
        >
          <Quote className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          title="Block Alignment (Justify)"
          onMouseDown={(e) => e.preventDefault()}
          onClick={toggleBlockAlign}
          className={`p-1.5 rounded transition-colors ${
            editor.isActive({ textAlign: 'justify' })
              ? 'bg-gray-200 text-gray-900 shadow-2xs'
              : 'text-gray-600 hover:bg-gray-200/60'
          }`}
        >
          <AlignJustify className="w-3.5 h-3.5" />
        </button>

        {/* Separator */}
        <div className="w-[1px] h-4 bg-gray-300 mx-1"></div>

        {/* Group 6: [ strikethrough ] */}
        <button
          type="button"
          title="Strikethrough"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => editor.chain().focus().toggleStrike().run()}
          className={`p-1.5 rounded transition-colors ${
            editor.isActive('strike')
              ? 'bg-gray-200 text-gray-900 line-through shadow-2xs'
              : 'text-gray-600 hover:bg-gray-200/60'
          }`}
        >
          <Strikethrough className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* TipTap Editor Content */}
      <EditorContent editor={editor} />
    </div>
  );
}

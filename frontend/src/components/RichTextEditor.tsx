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
} from 'lucide-react';

const LINE_HEIGHT_STEPS = ['1.0', '1.15', '1.5', '1.75', '2.0', '2.5'];
const DEFAULT_LINE_HEIGHT = '1.5';
const FONT_SIZES = ['12px', '14px', '16px', '18px', '22px', '28px'];

// Custom Paragraph extension to support font-size, line-height, and paragraph indentation
const CustomParagraph = Paragraph.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      fontSize: {
        default: null,
        parseHTML: (element) => element.style.fontSize || null,
      },
      lineHeight: {
        default: DEFAULT_LINE_HEIGHT,
        parseHTML: (element) => element.style.lineHeight || null,
      },
      indent: {
        default: 0,
        parseHTML: (element) => {
          const ml = element.style.marginLeft || '0';
          return parseInt(ml, 10) / 24 || 0;
        },
      },
    };
  },
  renderHTML({ HTMLAttributes }) {
    const styles: string[] = [];
    if (HTMLAttributes.fontSize) {
      styles.push(`font-size: ${HTMLAttributes.fontSize}`);
    }
    if (HTMLAttributes.lineHeight) {
      styles.push(`line-height: ${HTMLAttributes.lineHeight}`);
    }
    if (HTMLAttributes.indent) {
      styles.push(`margin-left: ${HTMLAttributes.indent * 24}px`);
    }

    const { fontSize, lineHeight, indent, style, ...rest } = HTMLAttributes;
    if (styles.length > 0) {
      rest.style = style ? `${style}; ${styles.join('; ')}` : styles.join('; ');
    }

    return ['p', rest, 0];
  },
});

interface RichTextEditorProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
}

export default function RichTextEditor({
  value,
  onChange,
  placeholder = 'Type Your Reply...',
}: RichTextEditorProps) {
  const [currentFontSizeIndex, setCurrentFontSizeIndex] = useState(1); // default '14px'

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

  // Read current paragraph's line-height
  const rawLineHeight =
    (editor?.getAttributes('paragraph')?.lineHeight as string) || DEFAULT_LINE_HEIGHT;
  let activeLhIndex = LINE_HEIGHT_STEPS.indexOf(rawLineHeight);
  if (activeLhIndex === -1) {
    const numeric = parseFloat(rawLineHeight);
    if (!isNaN(numeric)) {
      activeLhIndex = LINE_HEIGHT_STEPS.reduce((prevIdx, currVal, currIdx) => {
        const prevDiff = Math.abs(parseFloat(LINE_HEIGHT_STEPS[prevIdx]) - numeric);
        const currDiff = Math.abs(parseFloat(currVal) - numeric);
        return currDiff < prevDiff ? currIdx : prevIdx;
      }, 2);
    } else {
      activeLhIndex = 2; // '1.5'
    }
  }

  const isLhAtMin = activeLhIndex <= 0;
  const isLhAtMax = activeLhIndex >= LINE_HEIGHT_STEPS.length - 1;

  // Line Height Handlers
  const handleLineHeightUp = useCallback(() => {
    if (!editor || isLhAtMax) return;
    const nextLh = LINE_HEIGHT_STEPS[activeLhIndex + 1];
    editor.chain().focus().updateAttributes('paragraph', { lineHeight: nextLh }).run();
  }, [editor, activeLhIndex, isLhAtMax]);

  const handleLineHeightDown = useCallback(() => {
    if (!editor || isLhAtMin) return;
    const nextLh = LINE_HEIGHT_STEPS[activeLhIndex - 1];
    editor.chain().focus().updateAttributes('paragraph', { lineHeight: nextLh }).run();
  }, [editor, activeLhIndex, isLhAtMin]);

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
        <div className="flex items-center px-1.5 py-0.5 rounded border border-gray-200 bg-white/80 shadow-2xs">
          <span className="text-xs font-semibold tracking-tight text-gray-800 pr-1 select-none">Tt</span>
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

        {/* Group 4: [ text align ] */}
        <button
          type="button"
          title="Cycle Text Align"
          onMouseDown={(e) => e.preventDefault()}
          onClick={cycleTextAlign}
          className="p-1.5 hover:bg-gray-200/60 rounded text-gray-600 transition-colors"
        >
          <AlignIcon className="w-3.5 h-3.5" />
        </button>

        {/* Vertical divider */}
        <div className="w-[1px] h-4 bg-gray-300 mx-1"></div>

        {/* Line-height stepper: two plain chevrons stacked, up on top, down below, no icon/label, thin box outline */}
        <div className="flex flex-col justify-center items-center px-1.5 py-0.5 rounded border border-gray-200 bg-white/80 shadow-2xs">
          <button
            type="button"
            title={
              isLhAtMax
                ? 'Line height: 2.5 (Max)'
                : `Increase line height to ${LINE_HEIGHT_STEPS[activeLhIndex + 1]}`
            }
            onMouseDown={(e) => e.preventDefault()}
            onClick={handleLineHeightUp}
            disabled={isLhAtMax}
            className={`p-0.5 rounded transition-colors ${
              isLhAtMax
                ? 'opacity-30 cursor-not-allowed text-gray-400'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
            }`}
          >
            <ChevronUp className="w-2.5 h-2.5 stroke-[2.5]" />
          </button>
          <button
            type="button"
            title={
              isLhAtMin
                ? 'Line height: 1.0 (Min)'
                : `Decrease line height to ${LINE_HEIGHT_STEPS[activeLhIndex - 1]}`
            }
            onMouseDown={(e) => e.preventDefault()}
            onClick={handleLineHeightDown}
            disabled={isLhAtMin}
            className={`p-0.5 rounded transition-colors ${
              isLhAtMin
                ? 'opacity-30 cursor-not-allowed text-gray-400'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
            }`}
          >
            <ChevronDown className="w-2.5 h-2.5 stroke-[2.5]" />
          </button>
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

import { Editor } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import TextAlign from "@tiptap/extension-text-align";
import Underline from "@tiptap/extension-underline";
import FontFamily from "@tiptap/extension-font-family";
import { TextStyle } from "@tiptap/extension-text-style";
import Highlight from "@tiptap/extension-highlight";
import Subscript from "@tiptap/extension-subscript";
import Superscript from "@tiptap/extension-superscript";
import FontSize from "@tiptap/extension-font-size";

export interface EditorOptions {
  element: HTMLElement;
  initialContent?: object;
  placeholder?: string;
  onUpdate?: (content: object) => void;
}

export class DocumentEditor {
  private editor: Editor;
  private onUpdateCallback?: (content: object) => void;

  constructor(options: EditorOptions) {
    this.onUpdateCallback = options.onUpdate;

    this.editor = new Editor({
      element: options.element,
      extensions: [
        StarterKit.configure({
          heading: {
            levels: [1, 2, 3],
          },
        }),
        Placeholder.configure({
          placeholder:
            options.placeholder || "Start typing or use voice input...",
        }),
        TextAlign.configure({
          types: ["heading", "paragraph"],
        }),
        Underline,
        TextStyle,
        FontFamily,
        FontSize,
        Highlight.configure({
          multicolor: true,
        }),
        Subscript,
        Superscript,
      ],
      content: options.initialContent || "",
      onUpdate: ({ editor }) => {
        if (this.onUpdateCallback) {
          this.onUpdateCallback(editor.getJSON());
        }
      },
    });
  }

  // Get content as JSON
  getJSON(): object {
    return this.editor.getJSON();
  }

  // Get content as HTML
  getHTML(): string {
    return this.editor.getHTML();
  }

  // Get content as plain text
  getText(): string {
    return this.editor.getText();
  }

  // Set content from JSON
  setContent(content: object): void {
    this.editor.commands.setContent(content);
  }

  // Clear editor content
  clear(): void {
    this.editor.commands.clearContent();
  }

  // Focus the editor
  focus(): void {
    this.editor.commands.focus();
  }

  // Check if editor is empty
  isEmpty(): boolean {
    return this.editor.isEmpty;
  }

  // Word count
  getWordCount(): number {
    const text = this.getText();
    if (!text.trim()) return 0;
    return text.trim().split(/\s+/).length;
  }

  // Character count
  getCharacterCount(): number {
    return this.getText().length;
  }

  // ============ Formatting Commands ============

  toggleBold(): void {
    this.editor.chain().focus().toggleBold().run();
  }

  toggleItalic(): void {
    this.editor.chain().focus().toggleItalic().run();
  }

  toggleStrike(): void {
    this.editor.chain().focus().toggleStrike().run();
  }

  toggleUnderline(): void {
    this.editor.chain().focus().toggleUnderline().run();
  }

  setTextAlign(align: "left" | "center" | "right" | "justify"): void {
    this.editor.chain().focus().setTextAlign(align).run();
  }

  toggleHeading(level: 1 | 2 | 3): void {
    this.editor.chain().focus().toggleHeading({ level }).run();
  }

  toggleBulletList(): void {
    this.editor.chain().focus().toggleBulletList().run();
  }

  toggleOrderedList(): void {
    this.editor.chain().focus().toggleOrderedList().run();
  }

  toggleBlockquote(): void {
    this.editor.chain().focus().toggleBlockquote().run();
  }

  setHorizontalRule(): void {
    this.editor.chain().focus().setHorizontalRule().run();
  }

  undo(): void {
    this.editor.chain().focus().undo().run();
  }

  redo(): void {
    this.editor.chain().focus().redo().run();
  }

  // ============ New Formatting Commands ============

  setFontFamily(font: string): void {
    this.editor.chain().focus().setFontFamily(font).run();
  }

  setFontSize(size: string): void {
    this.editor.chain().focus().setFontSize(size).run();
  }

  toggleHighlight(color?: string): void {
    if (color) {
      this.editor.chain().focus().toggleHighlight({ color }).run();
    } else {
      this.editor.chain().focus().toggleHighlight().run();
    }
  }

  toggleSuperscript(): void {
    this.editor.chain().focus().toggleSuperscript().run();
  }

  toggleSubscript(): void {
    this.editor.chain().focus().toggleSubscript().run();
  }

  clearFormatting(): void {
    this.editor.chain().focus().unsetAllMarks().clearNodes().run();
  }

  // ============ State Checks ============

  isActive(nameOrAttrs: string | object, attrs?: object): boolean {
    // Use type assertion to handle TipTap's overloaded isActive
    return (this.editor.isActive as Function)(nameOrAttrs, attrs);
  }

  isBoldActive(): boolean {
    return this.editor.isActive("bold");
  }

  isItalicActive(): boolean {
    return this.editor.isActive("italic");
  }

  isStrikeActive(): boolean {
    return this.editor.isActive("strike");
  }

  isUnderlineActive(): boolean {
    return this.editor.isActive("underline");
  }

  isHighlightActive(): boolean {
    return this.editor.isActive("highlight");
  }

  isSuperscriptActive(): boolean {
    return this.editor.isActive("superscript");
  }

  isSubscriptActive(): boolean {
    return this.editor.isActive("subscript");
  }

  isHeadingActive(level: number): boolean {
    return this.editor.isActive("heading", { level });
  }

  isBulletListActive(): boolean {
    return this.editor.isActive("bulletList");
  }

  isOrderedListActive(): boolean {
    return this.editor.isActive("orderedList");
  }

  // Insert text at cursor position
  insertText(text: string): void {
    this.editor.chain().focus().insertContent(text).run();
  }

  // Destroy editor instance
  destroy(): void {
    this.editor.destroy();
  }

  // Get the underlying TipTap editor instance
  getEditor(): Editor {
    return this.editor;
  }
}

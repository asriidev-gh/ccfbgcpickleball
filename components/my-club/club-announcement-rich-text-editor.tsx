"use client";

import Image from "@tiptap/extension-image";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import {
  Bold,
  Heading2,
  ImagePlus,
  Italic,
  Link2,
  List,
  ListOrdered,
  Loader2,
  Unlink,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

async function uploadAnnouncementImage(file: File): Promise<string> {
  const formData = new FormData();
  formData.append("photo", file);
  const response = await fetch("/api/my-club/announcements/upload-image", {
    method: "POST",
    body: formData,
  });
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.message ?? "Failed to upload image.");
  }
  return payload.photoUrl as string;
}

function extractClipboardImage(event: ClipboardEvent): File | null {
  const items = event.clipboardData?.items;
  if (!items) return null;
  for (const item of items) {
    if (item.type.startsWith("image/")) {
      return item.getAsFile();
    }
  }
  return null;
}

type ClubAnnouncementRichTextEditorProps = {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  imageUploadConfigured?: boolean;
  maxLength: number;
  placeholder?: string;
};

export function ClubAnnouncementRichTextEditor({
  value,
  onChange,
  disabled = false,
  imageUploadConfigured = true,
  maxLength,
  placeholder = "Write your community post. Paste text, lists, links, or images.",
}: ClubAnnouncementRichTextEditorProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const isInsertingImageRef = useRef(false);
  const insertImageFileRef = useRef<(file: File) => Promise<void>>(async () => undefined);

  const editor = useEditor({
    immediatelyRender: false,
    editable: !disabled,
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
      }),
      Link.configure({
        openOnClick: false,
        autolink: true,
        defaultProtocol: "https",
      }),
      Image.configure({
        inline: false,
        allowBase64: false,
        HTMLAttributes: {
          class: "club-announcement-editor__image",
        },
      }),
      Placeholder.configure({ placeholder }),
    ],
    content: value || "<p></p>",
    onUpdate: ({ editor: currentEditor }) => {
      onChange(currentEditor.getHTML());
    },
    editorProps: {
      handlePaste: (view, event) => {
        const clipboardImage = extractClipboardImage(event);
        if (!clipboardImage || !imageUploadConfigured) return false;

        event.preventDefault();
        void insertImageFileRef.current(clipboardImage);
        return true;
      },
      handleDrop: (view, event) => {
        const file = event.dataTransfer?.files?.[0];
        if (!file || !file.type.startsWith("image/") || !imageUploadConfigured) return false;

        event.preventDefault();
        void insertImageFileRef.current(file);
        return true;
      },
    },
  });

  insertImageFileRef.current = async (file: File) => {
    if (!editor || disabled || uploadingImage || isInsertingImageRef.current) return;
    if (!imageUploadConfigured) {
      toast.error("Image upload is not configured on this server.");
      return;
    }

    isInsertingImageRef.current = true;
    setUploadingImage(true);
    try {
      const photoUrl = await uploadAnnouncementImage(file);
      editor.chain().focus().setImage({ src: photoUrl, alt: "Community post image" }).run();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not upload image.");
    } finally {
      setUploadingImage(false);
      isInsertingImageRef.current = false;
    }
  };

  useEffect(() => {
    if (!editor) return;
    editor.setEditable(!disabled);
  }, [disabled, editor]);

  useEffect(() => {
    if (!editor) return;
    const currentHtml = editor.getHTML();
    const nextHtml = value || "<p></p>";
    if (currentHtml !== nextHtml) {
      editor.commands.setContent(nextHtml, { emitUpdate: false });
    }
  }, [editor, value]);

  const toggleLink = () => {
    if (!editor) return;
    const previousUrl = editor.getAttributes("link").href as string | undefined;
    const url = window.prompt("Link URL", previousUrl ?? "https://");
    if (url === null) return;
    const trimmed = url.trim();
    if (!trimmed) {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange("link").setLink({ href: trimmed }).run();
  };

  const toolbarButtonClass = (active: boolean) =>
    cn(
      "h-8 w-8 shrink-0",
      active && "bg-muted text-foreground",
    );

  const length = value.length;
  const lengthExceeded = length > maxLength;

  return (
    <div className="space-y-2">
      <div className="overflow-hidden rounded-xl border border-border/70 bg-background shadow-sm">
        <div className="flex flex-wrap items-center gap-1 border-b border-border/60 bg-muted/20 p-1.5">
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className={toolbarButtonClass(editor?.isActive("bold") ?? false)}
            disabled={disabled || !editor}
            onClick={() => editor?.chain().focus().toggleBold().run()}
            aria-label="Bold"
          >
            <Bold className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className={toolbarButtonClass(editor?.isActive("italic") ?? false)}
            disabled={disabled || !editor}
            onClick={() => editor?.chain().focus().toggleItalic().run()}
            aria-label="Italic"
          >
            <Italic className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className={toolbarButtonClass(editor?.isActive("heading", { level: 2 }) ?? false)}
            disabled={disabled || !editor}
            onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()}
            aria-label="Heading"
          >
            <Heading2 className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className={toolbarButtonClass(editor?.isActive("bulletList") ?? false)}
            disabled={disabled || !editor}
            onClick={() => editor?.chain().focus().toggleBulletList().run()}
            aria-label="Bullet list"
          >
            <List className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className={toolbarButtonClass(editor?.isActive("orderedList") ?? false)}
            disabled={disabled || !editor}
            onClick={() => editor?.chain().focus().toggleOrderedList().run()}
            aria-label="Numbered list"
          >
            <ListOrdered className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className={toolbarButtonClass(editor?.isActive("link") ?? false)}
            disabled={disabled || !editor}
            onClick={toggleLink}
            aria-label="Add link"
          >
            <Link2 className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="h-8 w-8 shrink-0"
            disabled={disabled || !editor}
            onClick={() => editor?.chain().focus().unsetLink().run()}
            aria-label="Remove link"
          >
            <Unlink className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="h-8 w-8 shrink-0"
            disabled={disabled || !editor || uploadingImage || !imageUploadConfigured}
            onClick={() => fileInputRef.current?.click()}
            aria-label="Insert image"
          >
            {uploadingImage ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <ImagePlus className="h-4 w-4" />
            )}
          </Button>
        </div>

        <EditorContent
          editor={editor}
          className={cn(
            "club-announcement-editor min-h-[12rem] px-3 py-3 text-sm leading-relaxed",
            disabled && "opacity-70",
          )}
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
        <p>Paste or drop images, or use the image button for infographics.</p>
        <span className={cn("tabular-nums", lengthExceeded && "text-destructive")}>
          {length}/{maxLength}
        </span>
      </div>

      {!imageUploadConfigured ? (
        <p className="text-xs text-muted-foreground">
          Image upload is not configured. You can still format text and links.
        </p>
      ) : null}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="sr-only"
        disabled={disabled || uploadingImage || !imageUploadConfigured}
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (file) void insertImageFileRef.current(file);
        }}
      />
    </div>
  );
}

"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState } from "react";

import { Button, Skeleton, Spinner } from "@heroui/react";
import type { OnMount } from "@monaco-editor/react";
import { useAsyncDebouncedCallback } from "@tanstack/react-pacer";
import { Sparkles } from "lucide-react";
import type {
  editor as MonacoEditorNS,
  languages,
  Position,
  CancellationToken,
} from "monaco-editor";

import { cn } from "@chia/ui/utils/cn.util";

import { generateAIContentComplete } from "@/resources/ai.resource";

const MEditor = dynamic(() => import("@monaco-editor/react"), {
  ssr: false,
  loading: () => <Skeleton className="min-h-[700px] w-full rounded-xl" />,
});

export interface MarkdownEditorProps {
  value: string;
  onChange: (value: string | undefined) => void;
  title: string;
  locale: string;
  theme?: "vs-dark" | "light";
  height?: string;
  className?: string;
}

export const MarkdownEditor = ({
  value,
  onChange,
  title,
  locale,
  theme = "light",
  height = "700px",
  className,
}: MarkdownEditorProps) => {
  const [aiEnabled, setAiEnabled] = useState(true);

  const debouncedComplete = useAsyncDebouncedCallback(
    async (params: {
      title: string;
      textBeforeCursor: string;
      locale: string;
    }) => generateAIContentComplete(params),
    { wait: 600 }
  );

  const editorRef = useRef<MonacoEditorNS.IStandaloneCodeEditor | null>(null);
  // Tracks the last completion text we returned. If the text before cursor
  // ends with this value on the next trigger, the user just committed the
  // suggestion — skip the API call to avoid an immediate re-trigger.
  const lastCompletionRef = useRef("");

  const handleMount: OnMount = useCallback(
    (editor, monaco) => {
      // Local flag — updated by the content-change listener below.
      // Using a closure variable instead of a ref keeps things self-contained
      // and avoids extra state leaking out of this callback.
      let lastChangeWasDeletion = false;

      editor.onDidChangeModelContent((e) => {
        // A "deletion" is any change that only removes text (no new text inserted).
        // This covers Backspace, Delete, Ctrl+Backspace, selection delete, and cut.
        lastChangeWasDeletion =
          e.changes.length > 0 &&
          e.changes.every((c) => c.rangeLength > 0 && c.text === "");
      });

      editorRef.current = monaco.languages.registerInlineCompletionsProvider(
        "markdown",
        {
          provideInlineCompletions: async (
            model: MonacoEditorNS.ITextModel,
            position: Position,
            _ctx: languages.InlineCompletionContext,
            token: CancellationToken
          ) => {
            const textBeforeCursor = model.getValueInRange({
              startLineNumber: 1,
              startColumn: 1,
              endLineNumber: position.lineNumber,
              endColumn: position.column,
            });

            // Guard: deletion detected — don't suggest while user is removing text.
            if (lastChangeWasDeletion) return { items: [] };

            // Guard: cursor text ends with the last completion → user just
            // committed it. Skip once and clear the guard.
            if (
              lastCompletionRef.current &&
              textBeforeCursor.trimEnd().endsWith(lastCompletionRef.current)
            ) {
              lastCompletionRef.current = "";
              return { items: [] };
            }

            if (textBeforeCursor.trim().length < 20) {
              return { items: [] };
            }

            if (!title) return { items: [] };

            try {
              const completion = await debouncedComplete({
                title,
                textBeforeCursor,
                locale,
              });

              if (token.isCancellationRequested || !completion) {
                lastCompletionRef.current = "";
                return { items: [] };
              }

              lastCompletionRef.current = completion;
              return {
                items: [{ insertText: completion }],
                enableForwardStability: true,
              };
            } catch {
              lastCompletionRef.current = "";
              return { items: [] };
            }
          },
          freeInlineCompletions: (
            _completions: languages.InlineCompletions
          ) => {
            void _completions;
          },
        }
      );
    },
    [title, locale, debouncedComplete]
  );

  useEffect(() => {
    return () => {
      editorRef.current?.dispose();
    };
  }, []);

  return (
    <div
      className={cn(
        "relative w-full overflow-hidden rounded-2xl shadow-lg",
        className
      )}>
      <div className="flex items-center justify-end border-b border-gray-200 px-3 py-2 dark:border-gray-700">
        <Button
          size="sm"
          variant={aiEnabled ? "secondary" : "tertiary"}
          onPress={() => setAiEnabled((v) => !v)}
          aria-label={
            aiEnabled ? "Disable AI completion" : "Enable AI completion"
          }
          className="h-6.5 gap-1.5 text-xs">
          <Sparkles className={cn("size-3.5", !aiEnabled && "opacity-40")} />
          <span className={cn(!aiEnabled && "opacity-40")}>AI</span>
        </Button>
      </div>
      <MEditor
        className="bg-white py-5 dark:bg-[#1e1e1e]"
        height={height}
        defaultLanguage="markdown"
        theme={theme}
        loading={<Spinner />}
        onMount={handleMount}
        onChange={onChange}
        value={value}
        options={{
          minimap: { enabled: false },
          wordWrap: "on",
          scrollBeyondLastLine: false,
          scrollbar: { vertical: "auto" },
          lineNumbers: "off",
          quickSuggestions: false,
          inlineSuggest: { enabled: aiEnabled },
        }}
      />
    </div>
  );
};

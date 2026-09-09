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

export interface EditorSelection {
  text: string;
  startLine: number;
  endLine: number;
}

/** An entry on the editor's own context menu, offered while text is selected. */
export interface EditorSelectionAction {
  id: string;
  label: string;
  run: (selection: EditorSelection) => void;
}

export interface MarkdownEditorProps {
  value: string;
  onChange: (value: string | undefined) => void;
  title: string;
  locale: string;
  theme?: "vs-dark" | "light";
  height?: string;
  className?: string;
  selectionActions?: readonly EditorSelectionAction[];
}

/** The selected text with its line range, or `null` when nothing is selected. */
const readSelection = (
  editor: MonacoEditorNS.IStandaloneCodeEditor
): EditorSelection | null => {
  const selection = editor.getSelection();
  const model = editor.getModel();
  if (!selection || !model || selection.isEmpty()) return null;
  const text = model.getValueInRange(selection).trim();
  if (!text) return null;
  const end = selection.getEndPosition();
  // A selection that ends at the start of a line does not include that line.
  const endLine =
    end.column === 1 && end.lineNumber > selection.startLineNumber
      ? end.lineNumber - 1
      : end.lineNumber;
  return { text, startLine: selection.startLineNumber, endLine };
};

export const MarkdownEditor = ({
  value,
  onChange,
  title,
  locale,
  theme = "light",
  height = "700px",
  className,
  selectionActions,
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
  // Actions are registered once on mount; the menu runs whatever the latest render passed.
  const actionsRef = useRef(selectionActions);
  actionsRef.current = selectionActions;
  // Last completion we returned. If the text before the cursor ends with it, the user just
  // committed the suggestion; skip the API call to avoid an immediate re-trigger.
  const lastCompletionRef = useRef("");

  const handleMount: OnMount = useCallback(
    (editor, monaco) => {
      // Closure flag (not a ref) updated by the content-change listener below.
      let lastChangeWasDeletion = false;

      editor.onDidChangeModelContent((e) => {
        // A deletion is any change that only removes text.
        lastChangeWasDeletion =
          e.changes.length > 0 &&
          e.changes.every((c) => c.rangeLength > 0 && c.text === "");
      });

      for (const [index, action] of (actionsRef.current ?? []).entries()) {
        editor.addAction({
          id: `agent.${action.id}`,
          label: action.label,
          contextMenuGroupId: "agent",
          contextMenuOrder: index,
          precondition: "editorHasSelection",
          run: () => {
            const selection = readSelection(editor);
            if (!selection) return;
            actionsRef.current
              ?.find((entry) => entry.id === action.id)
              ?.run(selection);
          },
        });
      }

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

            if (lastChangeWasDeletion) return { items: [] };

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
      <div className="flex items-center justify-end border-b border-gray-200 bg-white px-3 py-2 dark:border-gray-700 dark:bg-[#1e1e1e]">
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

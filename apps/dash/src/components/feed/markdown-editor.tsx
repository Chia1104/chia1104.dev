"use client";

import dynamic from "next/dynamic";
import {
  useCallback,
  useDeferredValue,
  useEffect,
  useEffectEvent,
  useRef,
  useState,
} from "react";

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
import { lineChangesOf, textChangesOf } from "@chia/utils/text/diff";

import { generateAIContentComplete } from "@/resources/ai.resource";

const MEditor = dynamic(() => import("@monaco-editor/react"), {
  ssr: false,
  loading: () => <Skeleton className="min-h-[700px] w-full rounded-3xl" />,
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
  /**
   * Names the text being edited. Each path keeps its own Monaco model, so switching between
   * paths keeps every text's undo history, cursor and scroll position.
   */
  path: string;
  /**
   * What the text should hold. A value that did not come from typing here, such as another
   * writer's change, is applied as the smallest edits rather than replacing the text.
   */
  value: string;
  onChange: (value: string | undefined) => void;
  title: string;
  locale: string;
  theme?: "vs-dark" | "light";
  height?: string;
  className?: string;
  selectionActions?: readonly EditorSelectionAction[];
  /**
   * The text the change bar compares against: what the post holds. `null` or omitted draws
   * no bar, as for a draft that was never applied, where every line would be new.
   */
  baseline?: string | null;
}

/**
 * Brings the model to `next` by editing only what differs, as one undo step of its own, so the
 * cursor, the selection and the rest of the undo history stay where they are. `applyEdits` is
 * not an option: it skips the undo stack, which then replays against text it no longer matches.
 */
const applyExternalValue = (model: MonacoEditorNS.ITextModel, next: string) => {
  const changes = textChangesOf(model.getValue(), next);
  if (changes.length === 0) return;
  model.pushStackElement();
  model.pushEditOperations(
    null,
    changes.map((change) => {
      const start = model.getPositionAt(change.start);
      const end = model.getPositionAt(change.end);
      return {
        range: {
          startLineNumber: start.lineNumber,
          startColumn: start.column,
          endLineNumber: end.lineNumber,
          endColumn: end.column,
        },
        text: change.text,
      };
    }),
    () => null
  );
  model.pushStackElement();
};

/** Styled in `globals.css`; Monaco only takes class names. */
const CHANGE_BAR_CLASS = {
  added: "draft-change-added",
  modified: "draft-change-modified",
  deleted: "draft-change-deleted",
} as const;

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
  path,
  value,
  onChange,
  title,
  locale,
  theme = "light",
  height = "700px",
  className,
  selectionActions,
  baseline,
}: MarkdownEditorProps) => {
  const [aiEnabled, setAiEnabled] = useState(true);
  // State, not a ref: the change bar is drawn by an effect that has to run once Monaco mounts.
  const [instance, setInstance] =
    useState<MonacoEditorNS.IStandaloneCodeEditor | null>(null);
  const changeBar = useRef<MonacoEditorNS.IEditorDecorationsCollection | null>(
    null
  );
  // Typing stays ahead of the diff; the bar catches up on the next idle render.
  const compared = useDeferredValue(value);

  useEffect(() => {
    if (!instance) return;
    changeBar.current ??= instance.createDecorationsCollection();
    changeBar.current.set(
      baseline === null || baseline === undefined
        ? []
        : lineChangesOf(baseline, compared).map((change) => ({
            range: {
              startLineNumber: change.startLine,
              startColumn: 1,
              endLineNumber: change.endLine,
              endColumn: 1,
            },
            options: {
              isWholeLine: true,
              linesDecorationsClassName: CHANGE_BAR_CLASS[change.kind],
            },
          }))
    );
  }, [instance, baseline, compared]);

  // What this editor last reported, and for which text. A `value` equal to it is typing coming
  // back round, not a change from outside, even when the model has already moved on by a
  // keystroke. Another path's text may read the same and still be a change to its own model.
  const lastEmitted = useRef<{ path: string; value: string } | null>(null);
  const handleChange = useCallback(
    (next: string | undefined) => {
      lastEmitted.current = { path, value: next ?? "" };
      onChange(next);
    },
    [onChange, path]
  );
  // Reads the value of the render it runs in, which may be later than the one that set it up.
  const applyValue = useEffectEvent(() => {
    const model = instance?.getModel();
    if (model) applyExternalValue(model, value);
  });

  useEffect(() => {
    const model = instance?.getModel();
    if (
      !instance ||
      !model ||
      model.getValue() === value ||
      (lastEmitted.current?.path === path &&
        lastEmitted.current.value === value)
    )
      return;
    // Editing under an input method would break the composition; wait for it to finish.
    if (!instance.inComposition) {
      applyValue();
      return;
    }
    const composed = instance.onDidCompositionEnd(() => {
      composed.dispose();
      applyValue();
    });
    return () => composed.dispose();
  }, [instance, path, value]);

  // Models outlive a path switch on purpose; they go when the editor does.
  const shown = useRef(new Set<string>());
  useEffect(() => {
    shown.current.add(path);
  }, [path]);
  const monacoRef = useRef<Parameters<OnMount>[1] | null>(null);
  useEffect(
    () => () => {
      const paths = shown.current;
      for (const model of monacoRef.current?.editor.getModels() ?? []) {
        if (paths.has(model.uri.path.replace(/^\//, ""))) model.dispose();
      }
    },
    []
  );

  // The completion provider is registered once; it reads what the latest render passed.
  const titleRef = useRef(title);
  titleRef.current = title;
  const localeRef = useRef(locale);
  localeRef.current = locale;

  const debouncedComplete = useAsyncDebouncedCallback(
    async (params: {
      title: string;
      textBeforeCursor: string;
      locale: string;
    }) => generateAIContentComplete(params),
    { wait: 600 }
  );

  const completionProvider = useRef<{ dispose: () => void } | null>(null);
  // Actions are registered once on mount; the menu runs whatever the latest render passed.
  const actionsRef = useRef(selectionActions);
  actionsRef.current = selectionActions;
  // Last completion we returned. If the text before the cursor ends with it, the user just
  // committed the suggestion; skip the API call to avoid an immediate re-trigger.
  const lastCompletionRef = useRef("");

  const handleMount: OnMount = useCallback(
    (editor, monaco) => {
      setInstance(editor);
      monacoRef.current = monaco;
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

      completionProvider.current =
        monaco.languages.registerInlineCompletionsProvider("markdown", {
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

            if (!titleRef.current) return { items: [] };

            try {
              const completion = await debouncedComplete({
                title: titleRef.current,
                textBeforeCursor,
                locale: localeRef.current,
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
        });
    },
    [debouncedComplete]
  );

  useEffect(() => {
    return () => {
      completionProvider.current?.dispose();
    };
  }, []);

  return (
    <div
      className={cn(
        "relative w-full overflow-hidden rounded-3xl shadow-lg",
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
        onChange={handleChange}
        path={path}
        defaultValue={value}
        keepCurrentModel
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

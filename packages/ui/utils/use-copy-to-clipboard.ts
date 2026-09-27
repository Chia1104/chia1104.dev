import { useCallback, useState } from "react";

export interface UseClipboardProps {
  /**
   * The time in milliseconds to wait before resetting the clipboard.
   * @default 2000
   */
  timeout?: number;
}

const transformValue = (text: string) => {
  // Manually replace all &nbsp; to avoid get different unicode characters;
  return text.replace(/[\u00A0]/g, " ");
};

export function useClipboard({ timeout = 2000 }: UseClipboardProps = {}) {
  const [error, setError] = useState<Error | null>(null);
  const [copied, setCopied] = useState(false);
  const [copyTimeout, setCopyTimeout] = useState<ReturnType<
    typeof setTimeout
  > | null>(null);

  const onClearTimeout = useCallback(() => {
    if (copyTimeout) {
      clearTimeout(copyTimeout);
    }
  }, [copyTimeout]);

  const handleCopyResult = useCallback(
    (value: boolean) => {
      onClearTimeout();
      setCopyTimeout(setTimeout(() => setCopied(false), timeout));
      setCopied(value);
    },
    [onClearTimeout, timeout]
  );

  const write = useCallback(
    (writeTo: (clipboard: Clipboard) => Promise<void>) => {
      if ("clipboard" in navigator) {
        writeTo(navigator.clipboard)
          .then(() => handleCopyResult(true))
          .catch((err) => {
            if (err instanceof Error) {
              setError(err);
            }
          });
      } else {
        setError(
          new Error("useClipboard: navigator.clipboard is not supported")
        );
      }
    },
    [handleCopyResult]
  );

  const copy = useCallback(
    (valueToCopy: string) =>
      write((clipboard) => clipboard.writeText(transformValue(valueToCopy))),
    [write]
  );

  /** Text still loading at the click. Safari drops the click's user activation across an await; a pending `ClipboardItem` keeps it. */
  const copyPending = useCallback(
    (pending: Promise<string>) =>
      write((clipboard) =>
        clipboard.write([
          new ClipboardItem({
            "text/plain": pending.then(
              (text) => new Blob([transformValue(text)], { type: "text/plain" })
            ),
          }),
        ])
      ),
    [write]
  );

  const reset = useCallback(() => {
    setCopied(false);
    setError(null);
    onClearTimeout();
  }, [onClearTimeout]);

  return { copy, copyPending, reset, error, copied };
}

export type UseClipboardReturn = ReturnType<typeof useClipboard>;

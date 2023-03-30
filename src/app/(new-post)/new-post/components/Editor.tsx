"use client";

import { ErrorBoundary, Textarea, type TextAreaRef } from "@chia/ui";
import MDXRemote from "./MDXRemote";
import {
  type ChangeEvent,
  useCallback,
  useRef,
  useState,
  useTransition,
} from "react";
import { serialize } from "next-mdx-remote/serialize";
import { type MDXRemoteSerializeResult } from "next-mdx-remote";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import rehypeCodeTitles from "rehype-code-titles";
import { toast } from "sonner";
import { useCopyToClipboard } from "usehooks-ts";
import { useDarkMode, useIsMounted } from "@chia/hooks";

const Editor = () => {
  const [content, setContent] = useState<MDXRemoteSerializeResult | null>(null);
  const [isPending, startTransition] = useTransition();
  const textAreaRef = useRef<TextAreaRef>(null);
  const [, copy] = useCopyToClipboard();
  const { isDarkMode, toggle } = useDarkMode();
  const isMounted = useIsMounted();

  const handleChange = useCallback(
    (e: ChangeEvent<HTMLTextAreaElement>) => {
      let { value } = e.target;
      if (!value) {
        setContent(null);
        return;
      }

      startTransition(() => {
        value = value.trim().replace(/\{([^}]+)\}/g, "");
        serialize(value, {
          parseFrontmatter: false,
          mdxOptions: {
            remarkPlugins: [[remarkGfm, { singleTilde: false }]],
            rehypePlugins: [rehypeHighlight, rehypeCodeTitles],
          },
        }).then((mdxSource) => {
          setContent(mdxSource);
        });
      });
    },
    [startTransition]
  );

  const handleCopy = useCallback(() => {
    const source = textAreaRef.current?.value;
    copy(source ?? "")
      .then((r) => {
        if (r) {
          toast.success("Copied to clipboard.");
        }
      })
      .catch(() => {
        toast.error("Failed to copy to clipboard.");
      });
  }, [copy]);

  return (
    <div className="flex grid h-full w-full grid-cols-2">
      <div className="relative col-span-1">
        <div className="absolute right-0 top-0 mr-3 mt-3 flex gap-2">
          <button
            aria-label={"Light or Dark"}
            onClick={toggle}
            className="mr-3 transition ease-in-out hover:text-secondary">
            {isMounted && isDarkMode ? (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-5 w-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}>
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"
                />
              </svg>
            ) : (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-5 w-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}>
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"
                />
              </svg>
            )}
          </button>
          <button
            className="hover:c-bg-secondary inline-flex rounded-lg p-1 text-sm"
            onClick={handleCopy}>
            <span>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-5 w-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.7}>
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                />
              </svg>
            </span>
            <span className="hidden sm:ml-1 sm:block">COPY</span>
          </button>
        </div>
        <Textarea
          ref={textAreaRef}
          style={{
            resize: "none",
          }}
          className="c-scroll-bar h-full w-full p-10"
          onChange={handleChange}
          placeholder="Write something..."
        />
      </div>
      <div className="col-span-1 pr-3">
        <div className="c-bg-secondary c-scroll-bar relative h-full max-h-screen w-full overflow-y-scroll rounded-xl p-10">
          {isPending && (
            <div className="absolute right-0 top-0 mr-5 mt-5">
              <svg
                aria-hidden="true"
                className="h-8 w-8 animate-spin fill-blue-600 text-gray-200 dark:text-gray-600"
                viewBox="0 0 100 101"
                fill="none"
                xmlns="http://www.w3.org/2000/svg">
                <path
                  d="M100 50.5908C100 78.2051 77.6142 100.591 50 100.591C22.3858 100.591 0 78.2051 0 50.5908C0 22.9766 22.3858 0.59082 50 0.59082C77.6142 0.59082 100 22.9766 100 50.5908ZM9.08144 50.5908C9.08144 73.1895 27.4013 91.5094 50 91.5094C72.5987 91.5094 90.9186 73.1895 90.9186 50.5908C90.9186 27.9921 72.5987 9.67226 50 9.67226C27.4013 9.67226 9.08144 27.9921 9.08144 50.5908Z"
                  fill="currentColor"
                />
                <path
                  d="M93.9676 39.0409C96.393 38.4038 97.8624 35.9116 97.0079 33.5539C95.2932 28.8227 92.871 24.3692 89.8167 20.348C85.8452 15.1192 80.8826 10.7238 75.2124 7.41289C69.5422 4.10194 63.2754 1.94025 56.7698 1.05124C51.7666 0.367541 46.6976 0.446843 41.7345 1.27873C39.2613 1.69328 37.813 4.19778 38.4501 6.62326C39.0873 9.04874 41.5694 10.4717 44.0505 10.1071C47.8511 9.54855 51.7191 9.52689 55.5402 10.0491C60.8642 10.7766 65.9928 12.5457 70.6331 15.2552C75.2735 17.9648 79.3347 21.5619 82.5849 25.841C84.9175 28.9121 86.7997 32.2913 88.1811 35.8758C89.083 38.2158 91.5421 39.6781 93.9676 39.0409Z"
                  fill="currentFill"
                />
              </svg>
            </div>
          )}
          <ErrorBoundary
            errorMessage={
              content
                ? "Seems like there is an error in your markdown. Please check your markdown syntax."
                : "Seems like the current version of `next-mdx-remote` is not compatible with my editor. Please try again later."
            }>
            {content && <MDXRemote serializeResult={content} />}
          </ErrorBoundary>
        </div>
      </div>
    </div>
  );
};

export default Editor;

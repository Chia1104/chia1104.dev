type NovelNextProps = {
  extensions?: import("@tiptap/core").Extensions;
  completionApi?: string;
  handleCompletion?: {
    onResponse?: (response: Response) => void | Promise<void>;
    onFinish?: (prompt: string, completion: string) => void;
    onError?: (e: Error) => void;
  };
  /**
   * @todo integrate with other libraries (e.g. uploadthing, next-s3-upload)
   */
  handleImageUpload?: {
    startImageUpload?: (file: File) => void;
    onFinish?: () => void;
    onError?: (e: Error) => void;
  };
};

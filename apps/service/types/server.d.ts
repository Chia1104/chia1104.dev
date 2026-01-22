export declare const app: import("hono/hono-base").HonoBase<
  HonoContext<undefined, Variables>,
  | import("hono/types").BlankSchema
  | import("hono/types").MergeSchemaPath<
      {
        "*": {
          $get: {
            input: {};
            output: {};
            outputFormat: string;
            status: import("hono/utils/http-status").StatusCode;
          };
          $post: {
            input: {};
            output: {};
            outputFormat: string;
            status: import("hono/utils/http-status").StatusCode;
          };
        };
      },
      "/api/v1/auth"
    >
  | import("hono/types").MergeSchemaPath<
      {
        "/public/feeds:meta": {
          $get:
            | {
                input: {};
                output: {
                  status?: number | undefined;
                  code: string;
                  errors?:
                    | {
                        field: string;
                        message: string;
                        code?: string | undefined;
                      }[]
                    | null
                    | undefined;
                };
                outputFormat: "json";
                status: 500;
              }
            | {
                input: {};
                output: {
                  total: number;
                };
                outputFormat: "json";
                status: import("hono/utils/http-status").ContentfulStatusCode;
              };
        };
      } & {
        "/public/feeds": {
          $get:
            | {
                input: {
                  query: {
                    type?: "post" | "note" | "all" | undefined;
                    sortOrder?: "asc" | "desc" | undefined;
                    limit?: string | undefined;
                    nextCursor?: string | undefined;
                    withContent?: string | undefined;
                    published?: string | undefined;
                    locale?: "en" | "zh-TW" | undefined;
                    orderBy?:
                      | "updatedAt"
                      | "createdAt"
                      | "id"
                      | "slug"
                      | undefined;
                  };
                };
                output: {
                  status?: number | undefined;
                  code: string;
                  errors?:
                    | {
                        field: string;
                        message: string;
                        code?: string | undefined;
                      }[]
                    | null
                    | undefined;
                };
                outputFormat: "json";
                status: 400;
              }
            | {
                input: {
                  query: {
                    type?: "post" | "note" | "all" | undefined;
                    sortOrder?: "asc" | "desc" | undefined;
                    limit?: string | undefined;
                    nextCursor?: string | undefined;
                    withContent?: string | undefined;
                    published?: string | undefined;
                    locale?: "en" | "zh-TW" | undefined;
                    orderBy?:
                      | "updatedAt"
                      | "createdAt"
                      | "id"
                      | "slug"
                      | undefined;
                  };
                };
                output: {
                  items: {
                    createdAt: string;
                    updatedAt: string;
                    translations: {
                      createdAt: string;
                      updatedAt: string;
                      content: {
                        createdAt: string;
                        updatedAt: string;
                        content: string | null;
                        id: number;
                        feedTranslationId: number;
                        source: string | null;
                        unstableSerializedSource: string | null;
                      } | null;
                      locale: "en" | "zh-TW";
                      id: number;
                      description: string | null;
                      feedId: number;
                      title: string;
                      excerpt: string | null;
                      summary: string | null;
                      readTime: number | null;
                      embedding: number[] | null;
                      embedding512: number[] | null;
                    }[];
                    type: "post" | "note";
                    id: number;
                    slug: string;
                    userId: string;
                    published: boolean;
                    mainImage: string | null;
                    contentType: "mdx" | "notion" | "tiptap" | "plate";
                    defaultLocale: "en" | "zh-TW";
                    feedsToTags: {
                      tagId: number;
                      feedId: number;
                      tag: {
                        updatedAt: string;
                        createdAt: string;
                        id: number;
                        slug: string;
                        translations: {
                          locale: "en" | "zh-TW";
                          id: number;
                          name: string;
                          tagId: number;
                          description: string | null;
                        }[];
                      } | null;
                    }[];
                  }[];
                  nextCursor: string | number | null;
                };
                outputFormat: "json";
                status: import("hono/utils/http-status").ContentfulStatusCode;
              };
        };
      } & {
        "/public/feeds/:slug": {
          $get:
            | {
                input: {
                  query?:
                    | {
                        locale?: "en" | "zh-TW" | undefined;
                      }
                    | undefined;
                } & {
                  param: {
                    slug: string;
                  };
                };
                output: {
                  status?: number | undefined;
                  code: string;
                  errors?:
                    | {
                        field: string;
                        message: string;
                        code?: string | undefined;
                      }[]
                    | null
                    | undefined;
                };
                outputFormat: "json";
                status: 404;
              }
            | {
                input: {
                  query?:
                    | {
                        locale?: "en" | "zh-TW" | undefined;
                      }
                    | undefined;
                } & {
                  param: {
                    slug: string;
                  };
                };
                output: {
                  status?: number | undefined;
                  code: string;
                  errors?:
                    | {
                        field: string;
                        message: string;
                        code?: string | undefined;
                      }[]
                    | null
                    | undefined;
                };
                outputFormat: "json";
                status: 400;
              }
            | {
                input: {
                  query?:
                    | {
                        locale?: "en" | "zh-TW" | undefined;
                      }
                    | undefined;
                } & {
                  param: {
                    slug: string;
                  };
                };
                output: {
                  createdAt: string;
                  updatedAt: string;
                  translations: {
                    createdAt: string;
                    updatedAt: string;
                    content: {
                      createdAt: string;
                      updatedAt: string;
                      content: string | null;
                      id: number;
                      feedTranslationId: number;
                      source: string | null;
                      unstableSerializedSource: string | null;
                    } | null;
                    locale: "en" | "zh-TW";
                    id: number;
                    description: string | null;
                    feedId: number;
                    title: string;
                    excerpt: string | null;
                    summary: string | null;
                    readTime: number | null;
                    embedding: number[] | null;
                    embedding512: number[] | null;
                  }[];
                  type: "post" | "note";
                  id: number;
                  slug: string;
                  userId: string;
                  published: boolean;
                  mainImage: string | null;
                  contentType: "mdx" | "notion" | "tiptap" | "plate";
                  defaultLocale: "en" | "zh-TW";
                  feedsToTags: {
                    tagId: number;
                    feedId: number;
                    tag: {
                      updatedAt: string;
                      createdAt: string;
                      id: number;
                      slug: string;
                      translations: {
                        locale: "en" | "zh-TW";
                        id: number;
                        name: string;
                        tagId: number;
                        description: string | null;
                      }[];
                    } | null;
                  }[];
                };
                outputFormat: "json";
                status: import("hono/utils/http-status").ContentfulStatusCode;
              };
        };
      } & {
        "/public/feeds:id/:id": {
          $get:
            | {
                input: {
                  param: {
                    id: string;
                  };
                } & {
                  query?:
                    | {
                        locale?: "en" | "zh-TW" | undefined;
                      }
                    | undefined;
                };
                output: {
                  status?: number | undefined;
                  code: string;
                  errors?:
                    | {
                        field: string;
                        message: string;
                        code?: string | undefined;
                      }[]
                    | null
                    | undefined;
                };
                outputFormat: "json";
                status: 404;
              }
            | {
                input: {
                  param: {
                    id: string;
                  };
                } & {
                  query?:
                    | {
                        locale?: "en" | "zh-TW" | undefined;
                      }
                    | undefined;
                };
                output: {
                  status?: number | undefined;
                  code: string;
                  errors?:
                    | {
                        field: string;
                        message: string;
                        code?: string | undefined;
                      }[]
                    | null
                    | undefined;
                };
                outputFormat: "json";
                status: 400;
              }
            | {
                input: {
                  param: {
                    id: string;
                  };
                } & {
                  query?:
                    | {
                        locale?: "en" | "zh-TW" | undefined;
                      }
                    | undefined;
                };
                output: {
                  createdAt: string;
                  updatedAt: string;
                  translations: {
                    createdAt: string;
                    updatedAt: string;
                    content: {
                      createdAt: string;
                      updatedAt: string;
                      content: string | null;
                      id: number;
                      feedTranslationId: number;
                      source: string | null;
                      unstableSerializedSource: string | null;
                    } | null;
                    locale: "en" | "zh-TW";
                    id: number;
                    description: string | null;
                    feedId: number;
                    title: string;
                    excerpt: string | null;
                    summary: string | null;
                    readTime: number | null;
                    embedding: number[] | null;
                    embedding512: number[] | null;
                  }[];
                  type: "post" | "note";
                  id: number;
                  slug: string;
                  userId: string;
                  published: boolean;
                  mainImage: string | null;
                  contentType: "mdx" | "notion" | "tiptap" | "plate";
                  defaultLocale: "en" | "zh-TW";
                  feedsToTags: {
                    tagId: number;
                    feedId: number;
                    tag: {
                      updatedAt: string;
                      createdAt: string;
                      id: number;
                      slug: string;
                      translations: {
                        locale: "en" | "zh-TW";
                        id: number;
                        name: string;
                        tagId: number;
                        description: string | null;
                      }[];
                    } | null;
                  }[];
                };
                outputFormat: "json";
                status: import("hono/utils/http-status").ContentfulStatusCode;
              };
        };
      } & {
        "/public/feeds:translation": {
          $post:
            | {
                input: {
                  json: {
                    feedId: string;
                    locale: "en" | "zh-TW";
                    title?: string | undefined;
                    excerpt?: string | null | undefined;
                    description?: string | null | undefined;
                    summary?: string | null | undefined;
                    readTime?: string | null | undefined;
                  };
                };
                output: {
                  status?: number | undefined;
                  code: string;
                  errors?:
                    | {
                        field: string;
                        message: string;
                        code?: string | undefined;
                      }[]
                    | null
                    | undefined;
                };
                outputFormat: "json";
                status: 400;
              }
            | {
                input: {
                  json: {
                    feedId: string;
                    locale: "en" | "zh-TW";
                    title?: string | undefined;
                    excerpt?: string | null | undefined;
                    description?: string | null | undefined;
                    summary?: string | null | undefined;
                    readTime?: string | null | undefined;
                  };
                };
                output: null;
                outputFormat: "body";
                status: 204;
              };
        };
      } & {
        "/public/feeds:content": {
          $post:
            | {
                input: {
                  json: {
                    feedTranslationId: string;
                    content?: string | null | undefined;
                    source?: string | null | undefined;
                    unstableSerializedSource?: string | null | undefined;
                  };
                };
                output: {
                  status?: number | undefined;
                  code: string;
                  errors?:
                    | {
                        field: string;
                        message: string;
                        code?: string | undefined;
                      }[]
                    | null
                    | undefined;
                };
                outputFormat: "json";
                status: 400;
              }
            | {
                input: {
                  json: {
                    feedTranslationId: string;
                    content?: string | null | undefined;
                    source?: string | null | undefined;
                    unstableSerializedSource?: string | null | undefined;
                  };
                };
                output: null;
                outputFormat: "body";
                status: 204;
              };
        };
      } & {
        "/public/feeds/:id": {
          $post:
            | {
                input: {
                  json: {
                    createdAt?: string | number | undefined;
                    updatedAt?: string | number | undefined;
                    type?: "post" | "note" | undefined;
                    slug?: string | undefined;
                    userId?: string | undefined;
                    published?: boolean | undefined;
                    mainImage?: string | null | undefined;
                    contentType?:
                      | "mdx"
                      | "notion"
                      | "tiptap"
                      | "plate"
                      | undefined;
                    defaultLocale?: "en" | "zh-TW" | undefined;
                  };
                } & {
                  param: {
                    id: string;
                  };
                };
                output: {
                  status?: number | undefined;
                  code: string;
                  errors?:
                    | {
                        field: string;
                        message: string;
                        code?: string | undefined;
                      }[]
                    | null
                    | undefined;
                };
                outputFormat: "json";
                status: 400;
              }
            | {
                input: {
                  json: {
                    createdAt?: string | number | undefined;
                    updatedAt?: string | number | undefined;
                    type?: "post" | "note" | undefined;
                    slug?: string | undefined;
                    userId?: string | undefined;
                    published?: boolean | undefined;
                    mainImage?: string | null | undefined;
                    contentType?:
                      | "mdx"
                      | "notion"
                      | "tiptap"
                      | "plate"
                      | undefined;
                    defaultLocale?: "en" | "zh-TW" | undefined;
                  };
                } & {
                  param: {
                    id: string;
                  };
                };
                output: {
                  userId: string;
                  mainImage: string | null;
                  createdAt: string;
                  updatedAt: string;
                  id: number;
                  slug: string;
                  type: "post" | "note";
                  contentType: "mdx" | "notion" | "tiptap" | "plate";
                  published: boolean;
                  defaultLocale: "en" | "zh-TW";
                };
                outputFormat: "json";
                status: import("hono/utils/http-status").ContentfulStatusCode;
              };
        };
      },
      "/api/v1/admin"
    >
  | import("hono/types").MergeSchemaPath<
      {
        "/": {
          $get:
            | {
                input: {
                  query: {
                    type?: "post" | "note" | "all" | undefined;
                    sortOrder?: "asc" | "desc" | undefined;
                    limit?: string | undefined;
                    nextCursor?: string | undefined;
                    withContent?: string | undefined;
                    published?: string | undefined;
                    locale?: "en" | "zh-TW" | undefined;
                    orderBy?:
                      | "updatedAt"
                      | "createdAt"
                      | "id"
                      | "slug"
                      | undefined;
                  };
                };
                output: {
                  status?: number | undefined;
                  code: string;
                  errors?:
                    | {
                        field: string;
                        message: string;
                        code?: string | undefined;
                      }[]
                    | null
                    | undefined;
                };
                outputFormat: "json";
                status: 400;
              }
            | {
                input: {
                  query: {
                    type?: "post" | "note" | "all" | undefined;
                    sortOrder?: "asc" | "desc" | undefined;
                    limit?: string | undefined;
                    nextCursor?: string | undefined;
                    withContent?: string | undefined;
                    published?: string | undefined;
                    locale?: "en" | "zh-TW" | undefined;
                    orderBy?:
                      | "updatedAt"
                      | "createdAt"
                      | "id"
                      | "slug"
                      | undefined;
                  };
                };
                output: {
                  items: {
                    createdAt: string;
                    updatedAt: string;
                    translations: {
                      createdAt: string;
                      updatedAt: string;
                      content: {
                        createdAt: string;
                        updatedAt: string;
                        content: string | null;
                        id: number;
                        feedTranslationId: number;
                        source: string | null;
                        unstableSerializedSource: string | null;
                      } | null;
                      locale: "en" | "zh-TW";
                      id: number;
                      description: string | null;
                      feedId: number;
                      title: string;
                      excerpt: string | null;
                      summary: string | null;
                      readTime: number | null;
                      embedding: number[] | null;
                      embedding512: number[] | null;
                    }[];
                    type: "post" | "note";
                    id: number;
                    slug: string;
                    userId: string;
                    published: boolean;
                    mainImage: string | null;
                    contentType: "mdx" | "notion" | "tiptap" | "plate";
                    defaultLocale: "en" | "zh-TW";
                    feedsToTags: {
                      tagId: number;
                      feedId: number;
                      tag: {
                        updatedAt: string;
                        createdAt: string;
                        id: number;
                        slug: string;
                        translations: {
                          locale: "en" | "zh-TW";
                          id: number;
                          name: string;
                          tagId: number;
                          description: string | null;
                        }[];
                      } | null;
                    }[];
                  }[];
                  nextCursor: string | number | null;
                };
                outputFormat: "json";
                status: import("hono/utils/http-status").ContentfulStatusCode;
              };
        };
      } & {
        "/public": {
          $get:
            | {
                input: {
                  query: {
                    type?: "post" | "note" | "all" | undefined;
                    sortOrder?: "asc" | "desc" | undefined;
                    limit?: string | undefined;
                    nextCursor?: string | undefined;
                    withContent?: string | undefined;
                    published?: string | undefined;
                    orderBy?:
                      | "updatedAt"
                      | "createdAt"
                      | "id"
                      | "slug"
                      | undefined;
                    locale?: "en" | "zh-TW" | undefined;
                  };
                };
                output: {
                  status?: number | undefined;
                  code: string;
                  errors?:
                    | {
                        field: string;
                        message: string;
                        code?: string | undefined;
                      }[]
                    | null
                    | undefined;
                };
                outputFormat: "json";
                status: 400;
              }
            | {
                input: {
                  query: {
                    type?: "post" | "note" | "all" | undefined;
                    sortOrder?: "asc" | "desc" | undefined;
                    limit?: string | undefined;
                    nextCursor?: string | undefined;
                    withContent?: string | undefined;
                    published?: string | undefined;
                    orderBy?:
                      | "updatedAt"
                      | "createdAt"
                      | "id"
                      | "slug"
                      | undefined;
                    locale?: "en" | "zh-TW" | undefined;
                  };
                };
                output: {
                  items: {
                    createdAt: string;
                    updatedAt: string;
                    translations: {
                      createdAt: string;
                      updatedAt: string;
                      content: {
                        createdAt: string;
                        updatedAt: string;
                        content: string | null;
                        id: number;
                        feedTranslationId: number;
                        source: string | null;
                        unstableSerializedSource: string | null;
                      } | null;
                      locale: "en" | "zh-TW";
                      id: number;
                      description: string | null;
                      feedId: number;
                      title: string;
                      excerpt: string | null;
                      summary: string | null;
                      readTime: number | null;
                      embedding: number[] | null;
                      embedding512: number[] | null;
                    }[];
                    type: "post" | "note";
                    id: number;
                    slug: string;
                    userId: string;
                    published: boolean;
                    mainImage: string | null;
                    contentType: "mdx" | "notion" | "tiptap" | "plate";
                    defaultLocale: "en" | "zh-TW";
                    feedsToTags: {
                      tagId: number;
                      feedId: number;
                      tag: {
                        updatedAt: string;
                        createdAt: string;
                        id: number;
                        slug: string;
                        translations: {
                          locale: "en" | "zh-TW";
                          id: number;
                          name: string;
                          tagId: number;
                          description: string | null;
                        }[];
                      } | null;
                    }[];
                  }[];
                  nextCursor: string | number | null;
                };
                outputFormat: "json";
                status: import("hono/utils/http-status").ContentfulStatusCode;
              };
        };
      } & {
        "/search": {
          $get:
            | {
                input: {
                  query: {
                    keyword?: string | undefined;
                    model?:
                      | "mxbai-embed-large"
                      | "nomic-embed-text"
                      | "all-minilm"
                      | "text-embedding-ada-002"
                      | "text-embedding-3-small"
                      | "text-embedding-3-large"
                      | undefined;
                    locale?: "en" | "zh-TW" | undefined;
                  };
                };
                output: {
                  status?: number | undefined;
                  code: string;
                  errors?:
                    | {
                        field: string;
                        message: string;
                        code?: string | undefined;
                      }[]
                    | null
                    | undefined;
                };
                outputFormat: "json";
                status: 400;
              }
            | {
                input: {
                  query: {
                    keyword?: string | undefined;
                    model?:
                      | "mxbai-embed-large"
                      | "nomic-embed-text"
                      | "all-minilm"
                      | "text-embedding-ada-002"
                      | "text-embedding-3-small"
                      | "text-embedding-3-large"
                      | undefined;
                    locale?: "en" | "zh-TW" | undefined;
                  };
                };
                output: {
                  id: number;
                  userId: string;
                  type: "post" | "note";
                  slug: string;
                  contentType: "mdx" | "notion" | "tiptap" | "plate";
                  published: boolean;
                  defaultLocale: "en" | "zh-TW";
                  mainImage: string | null;
                  createdAt: string;
                  updatedAt: string;
                  feedTranslationId: number;
                  locale: "en" | "zh-TW";
                  title: string;
                  excerpt: string | null;
                  description: string | null;
                  summary: string | null;
                  readTime: number | null;
                  similarity: number;
                }[];
                outputFormat: "json";
                status: import("hono/utils/http-status").ContentfulStatusCode;
              };
        };
      },
      "/api/v1/feeds"
    >
  | import("hono/types").MergeSchemaPath<
      import("hono/types").BlankSchema,
      "/api/v1/rpc"
    >
  | import("hono/types").MergeSchemaPath<
      {
        "/": {
          $get: {
            input: {};
            output: {
              status: string;
            };
            outputFormat: "json";
            status: import("hono/utils/http-status").ContentfulStatusCode;
          };
        };
      },
      "/api/v1/health"
    >
  | import("hono/types").MergeSchemaPath<
      {
        "/key:signed": {
          $post:
            | {
                input: {
                  json: {
                    apiKey: string;
                    provider?:
                      | "google"
                      | "openai"
                      | "anthropic"
                      | "deep-seek"
                      | undefined;
                  };
                };
                output: {
                  status?: number | undefined;
                  code: string;
                  errors?:
                    | {
                        field: string;
                        message: string;
                        code?: string | undefined;
                      }[]
                    | null
                    | undefined;
                };
                outputFormat: "json";
                status: 503;
              }
            | {
                input: {
                  json: {
                    apiKey: string;
                    provider?:
                      | "google"
                      | "openai"
                      | "anthropic"
                      | "deep-seek"
                      | undefined;
                  };
                };
                output: {
                  status?: number | undefined;
                  code: string;
                  errors?:
                    | {
                        field: string;
                        message: string;
                        code?: string | undefined;
                      }[]
                    | null
                    | undefined;
                };
                outputFormat: "json";
                status: 400;
              }
            | {
                input: {
                  json: {
                    apiKey: string;
                    provider?:
                      | "google"
                      | "openai"
                      | "anthropic"
                      | "deep-seek"
                      | undefined;
                  };
                };
                output: {
                  message: string;
                };
                outputFormat: "json";
                status: import("hono/utils/http-status").ContentfulStatusCode;
              };
        };
      } & {
        "/generate": {
          $post:
            | {
                input: {
                  json: {
                    messages: unknown[];
                    model?:
                      | {
                          provider: "openai";
                          id:
                            | "gpt-5"
                            | "gpt-5-mini"
                            | "gpt-5-nano"
                            | "gpt-4.1"
                            | "gpt-4o"
                            | "gpt-4o-mini"
                            | "gpt-4"
                            | "o3-mini"
                            | "o1"
                            | "o1-mini";
                        }
                      | {
                          provider: "anthropic";
                          id:
                            | "claude-3-5-haiku-latest"
                            | "claude-3-7-sonnet-latest"
                            | "claude-sonnet-4-0"
                            | "claude-opus-4-1";
                        }
                      | {
                          provider: "google";
                          id:
                            | "gemini-2.5-flash"
                            | "gemini-2.5-pro"
                            | "gemini-2.0-flash";
                        }
                      | {
                          provider: "deep-seek";
                          id: "deepseek-reasoner";
                        }
                      | undefined;
                    system?: string | undefined;
                    proxyUrl?: string | undefined;
                  };
                };
                output: {};
                outputFormat: string;
                status: import("hono/utils/http-status").StatusCode;
              }
            | {
                input: {
                  json: {
                    messages: unknown[];
                    model?:
                      | {
                          provider: "openai";
                          id:
                            | "gpt-5"
                            | "gpt-5-mini"
                            | "gpt-5-nano"
                            | "gpt-4.1"
                            | "gpt-4o"
                            | "gpt-4o-mini"
                            | "gpt-4"
                            | "o3-mini"
                            | "o1"
                            | "o1-mini";
                        }
                      | {
                          provider: "anthropic";
                          id:
                            | "claude-3-5-haiku-latest"
                            | "claude-3-7-sonnet-latest"
                            | "claude-sonnet-4-0"
                            | "claude-opus-4-1";
                        }
                      | {
                          provider: "google";
                          id:
                            | "gemini-2.5-flash"
                            | "gemini-2.5-pro"
                            | "gemini-2.0-flash";
                        }
                      | {
                          provider: "deep-seek";
                          id: "deepseek-reasoner";
                        }
                      | undefined;
                    system?: string | undefined;
                    proxyUrl?: string | undefined;
                  };
                };
                output: {
                  status?: number | undefined;
                  code: string;
                  errors?:
                    | {
                        field: string;
                        message: string;
                        code?: string | undefined;
                      }[]
                    | null
                    | undefined;
                };
                outputFormat: "json";
                status: 400;
              };
        };
      },
      "/api/v1/ai"
    >
  | import("hono/types").MergeSchemaPath<
      {
        "/playlist/:id": {
          $get:
            | {
                input: {
                  param: {
                    id: string;
                  };
                };
                output: {
                  status?: number | undefined;
                  code: string;
                  errors?:
                    | {
                        field: string;
                        message: string;
                        code?: string | undefined;
                      }[]
                    | null
                    | undefined;
                };
                outputFormat: "json";
                status: 500;
              }
            | {
                input: {
                  param: {
                    id: string;
                  };
                };
                output: {
                  collaborative: boolean;
                  description: string;
                  external_urls: {
                    spotify: string;
                  };
                  followers: {
                    href: string;
                    total: number;
                  };
                  href: string;
                  id: string;
                  images: {
                    url: string;
                    height: number;
                    width: number;
                  }[];
                  name: string;
                  owner: {
                    external_urls: {
                      spotify: string;
                    };
                    followers: {
                      href: string;
                      total: number;
                    };
                    href: string;
                    id: string;
                    type: string;
                    uri: string;
                    display_name: string;
                  };
                  public: boolean;
                  snapshot_id: string;
                  tracks: {
                    href: string;
                    limit: number;
                    next: string;
                    offset: number;
                    previous: string;
                    total: number;
                    items: {
                      added_at: string;
                      added_by: {
                        external_urls: {
                          spotify: string;
                        };
                        followers: {
                          href: string;
                          total: number;
                        };
                        href: string;
                        id: string;
                        type: string;
                        uri: string;
                      };
                      is_local: boolean;
                      track: {
                        album: {
                          album_type: string;
                          total_tracks: number;
                          available_markets: string[];
                          external_urls: {
                            spotify: string;
                          };
                          href: string;
                          id: string;
                          images: {
                            url: string;
                            height: number;
                            width: number;
                          }[];
                          name: string;
                          release_date: string;
                          release_date_precision: string;
                          restrictions: {
                            reason: string;
                          };
                          type: string;
                          uri: string;
                          artists: {
                            external_urls: {
                              spotify: string;
                            };
                            href: string;
                            id: string;
                            name: string;
                            type: string;
                            uri: string;
                          }[];
                        };
                        artists: {
                          external_urls: {
                            spotify: string;
                          };
                          followers: {
                            href: string;
                            total: number;
                          };
                          genres: string[];
                          href: string;
                          id: string;
                          images: {
                            url: string;
                            height: number;
                            width: number;
                          }[];
                          name: string;
                          popularity: number;
                          type: "artist";
                          uri: string;
                        }[];
                        available_markets: string[];
                        disc_number: number;
                        duration_ms: number;
                        explicit: boolean;
                        external_ids: {
                          isrc: string;
                          ean: string;
                          upc: string;
                        };
                        external_urls: {
                          spotify: string;
                        };
                        href: string;
                        id: string;
                        is_playable: boolean;
                        restrictions: {
                          reason: string;
                        };
                        name: string;
                        popularity: number;
                        preview_url: string;
                        track_number: number;
                        type: "track";
                        uri: string;
                        is_local: boolean;
                      };
                    }[];
                  };
                  type: string;
                  uri: string;
                };
                outputFormat: "json";
                status: import("hono/utils/http-status").ContentfulStatusCode;
              };
        };
      } & {
        "/playing": {
          $get:
            | {
                input: {};
                output: {
                  status?: number | undefined;
                  code: string;
                  errors?:
                    | {
                        field: string;
                        message: string;
                        code?: string | undefined;
                      }[]
                    | null
                    | undefined;
                };
                outputFormat: "json";
                status: 500;
              }
            | {
                input: {};
                output: {
                  timestamp: number;
                  context: {
                    external_urls: {
                      spotify: string;
                    };
                    href: string;
                    type: string;
                    uri: string;
                  };
                  progress_ms: number;
                  item: {
                    album: {
                      album_type: string;
                      artists: {
                        external_urls: {
                          spotify: string;
                        };
                        href: string;
                        id: string;
                        name: string;
                        type: string;
                        uri: string;
                      }[];
                      available_markets: string[];
                      external_urls: {
                        spotify: string;
                      };
                      href: string;
                      id: string;
                      images: {
                        url: string;
                        height: number;
                        width: number;
                      }[];
                      name: string;
                      release_date: string;
                      release_date_precision: string;
                      total_tracks: number;
                      type: string;
                      uri: string;
                    };
                    artists: {
                      external_urls: {
                        spotify: string;
                      };
                      href: string;
                      id: string;
                      name: string;
                      type: string;
                      uri: string;
                    }[];
                    available_markets: string[];
                    disc_number: number;
                    duration_ms: number;
                    explicit: boolean;
                    external_ids: {
                      isrc: string;
                    };
                    external_urls: {
                      spotify: string;
                    };
                    href: string;
                    id: string;
                    is_local: boolean;
                    name: string;
                    popularity: number;
                    preview_url: string;
                    track_number: number;
                    type: string;
                    uri: string;
                  };
                  currently_playing_type: string;
                  actions: {
                    disallows: {
                      resuming: boolean;
                    };
                  };
                  is_playing: boolean;
                } | null;
                outputFormat: "json";
                status: import("hono/utils/http-status").ContentfulStatusCode;
              };
        };
      },
      "/api/v1/spotify"
    >
  | import("hono/types").MergeSchemaPath<
      {
        "/send": {
          $post:
            | {
                input: {
                  json: {
                    email: string;
                    title: string;
                    message: string;
                  };
                };
                output: {
                  status?: number | undefined;
                  code: string;
                  errors?:
                    | {
                        field: string;
                        message: string;
                        code?: string | undefined;
                      }[]
                    | null
                    | undefined;
                };
                outputFormat: "json";
                status: 500;
              }
            | {
                input: {
                  json: {
                    email: string;
                    title: string;
                    message: string;
                  };
                };
                output: {
                  status?: number | undefined;
                  code: string;
                  errors?:
                    | {
                        field: string;
                        message: string;
                        code?: string | undefined;
                      }[]
                    | null
                    | undefined;
                };
                outputFormat: "json";
                status: 400;
              }
            | {
                input: {
                  json: {
                    email: string;
                    title: string;
                    message: string;
                  };
                };
                output: null;
                outputFormat: "json";
                status: import("hono/utils/http-status").ContentfulStatusCode;
              };
        };
      },
      "/api/v1/email"
    >
  | import("hono/types").MergeSchemaPath<
      {
        "/link-preview": {
          $post:
            | {
                input: {
                  json: {
                    href: string;
                  };
                };
                output: {
                  status?: number | undefined;
                  code: string;
                  errors?:
                    | {
                        field: string;
                        message: string;
                        code?: string | undefined;
                      }[]
                    | null
                    | undefined;
                };
                outputFormat: "json";
                status: 500;
              }
            | {
                input: {
                  json: {
                    href: string;
                  };
                };
                output: {
                  status?: number | undefined;
                  code: string;
                  errors?:
                    | {
                        field: string;
                        message: string;
                        code?: string | undefined;
                      }[]
                    | null
                    | undefined;
                };
                outputFormat: "json";
                status: 400;
              }
            | {
                input: {
                  json: {
                    href: string;
                  };
                };
                output: {
                  title?: string | null | undefined;
                  description?: string | null | undefined;
                  favicon?: string | null | undefined;
                  ogImage?: string | null | undefined;
                };
                outputFormat: "json";
                status: import("hono/utils/http-status").ContentfulStatusCode;
              };
        };
      },
      "/api/v1/toolings"
    >,
  "/api/v1",
  "/api/v1"
>;
export type AppRPC = typeof app;
declare const _default: {
  port: number;
  fetch: (
    request: Request,
    Env?: {} | undefined,
    executionCtx?: import("hono").ExecutionContext
  ) => Response | Promise<Response>;
};
export default _default;

# `@chia/ai`

AI provider configuration, model selection, embeddings, chunking and provider-facing utilities.

## Boundaries

- `provider.ts` is the canonical list of vendors, bring-your-own-key options and cookie names.
- `house-models.ts` is the only place to assign house-billed model IDs.
- `env.ts` owns embedding provider configuration, including `EMBEDDING_PROVIDER`, `EMBEDDING_API_KEY` and `OLLAMA_BASE_URL`.
- Keep provider SDKs and the tokenizer lazily loaded so importing shared modules does not inflate server startup or browser bundles.
- Indexing code must keep stored chunk text consistent with its embedding and provider dimensions.
- Read `docs/rag-architecture.md` before changing chunking, embeddings or context assembly.

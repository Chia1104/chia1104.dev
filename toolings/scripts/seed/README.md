# Database seed script

```bash
pnpm db:seed -- action=seedPost
```

## Options

| Name   | Description   | Required | Default |
| ------ | ------------- | -------- | ------- |
| env    | Environment   | No       | local   |
| action | Action to run | Yes      | -       |

Actions: `seedPost`, `seedNote`. Search chunks and vectors are not seeded —
they come from the indexing workflow (`docs/rag-architecture.md`); trigger a
reindex from the dashboard when the seeded rows should be searchable.

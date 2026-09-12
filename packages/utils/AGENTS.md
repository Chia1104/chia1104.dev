# `@chia/utils`

Cross-runtime, domain-neutral utilities shared across apps and packages.

## Boundaries

- Keep modules small and importable through their explicit export path; do not turn this package into a miscellaneous root barrel.
- `day` is the repository's date and timezone boundary. Consumers import it instead of importing `dayjs` directly.
- `config` owns shared endpoint resolution, including `withServiceEndpoint`.
- Keep server-only helpers under `server` and out of browser-importable modules.
- Domain rules belong in their owning package even when they could be expressed as a generic helper.

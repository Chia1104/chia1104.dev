# `@chia/meta`

Authoritative personal profile and timeline metadata for the site.

## Boundaries

- Edit `meta.pkl` and `timeline.pkl` as source; regenerate their JSON outputs with the package scripts.
- Keep the Pkl schemas aligned with authored data and generated JSON.
- `index.ts` exposes typed metadata helpers only; presentation and localization belong to consumers.

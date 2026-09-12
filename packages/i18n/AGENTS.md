# `@chia/i18n`

Static translation catalogs for the public site and shared agent UI.

## Boundaries

- Keep every locale in a namespace key-for-key compatible with the others.
- Add messages to the owning namespace instead of app-local duplicate catalogs.
- This package exports JSON data only; locale negotiation and rendering stay in consumers.

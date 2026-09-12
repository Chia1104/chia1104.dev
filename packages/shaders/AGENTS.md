# `@chia/shaders`

Reusable React Three Fiber shader scenes and their local rendering resources.

## Boundaries

- Keep shader materials, uniforms and rendering helpers local to this package.
- Export reusable visual components; app layout, content and product state stay in consumers.
- Avoid introducing a second design-token source. UI colors and themes come from `@chia/themes` or explicit shader inputs.

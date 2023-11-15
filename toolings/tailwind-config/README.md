# TailwindCSS Configuration

This package contains the TailwindCSS configuration for the [TailwindCSS](https://tailwindcss.com/) framework.

## Development

You can import the configuration in your tailwind config file by using the following import statement:

### TypeScript

Make sure your tailwind version is at least 3.3.0.

```ts
import type { Config } from "tailwindcss";
import baseConfig, { animation } from "@chia/tailwind-config";

export default {
  // other config
  presets: [animation, baseConfig],
} satisfies Config;
```

### JavaScript

```js
const baseConfig = require("@chia/tailwind-config");
const { animation } = require("@chia/tailwind-config");

module.exports = {
  // other config
  presets: [animation, baseConfig],
};
```

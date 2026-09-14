import { nodeConfig } from "@chia/test/config";

export default nodeConfig({
  test: {
    // react-tweet ships CSS modules, which only load once Vite transforms the package.
    server: { deps: { inline: ["react-tweet"] } },
  },
});

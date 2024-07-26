import { ConfigModule } from "@nestjs/config";

import { appEnvSchema } from "@/config/env";

export default ConfigModule.forRoot({
  validate(config) {
    appEnvSchema.parse(config);
    return config;
  },
});

export * from "./env";

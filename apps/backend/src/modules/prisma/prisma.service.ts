import { INestApplication, Injectable, OnModuleInit } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";
import * as process from "process";

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  async onModuleInit() {
    await this.$connect();
  }

  private async exitHandler(app: INestApplication) {
    await app.close();
  }

  async enableShutdownHooks(app: INestApplication) {
    process.on("exit", async () => {
      await this.exitHandler(app);
    });
    process.on("beforeExit", async () => {
      await this.exitHandler(app);
    });
    process.on("SIGINT", async () => {
      await this.exitHandler(app);
    });
    process.on("SIGTERM", async () => {
      await this.exitHandler(app);
    });
    process.on("SIGUSR2", async () => {
      await this.exitHandler(app);
    });
  }
}

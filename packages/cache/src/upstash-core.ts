import { createUpstash, type UpstashConfig } from "./create-upstash";
import { type SetCommandOptions } from "@upstash/redis";

interface Options extends UpstashConfig {
  prefix?: string;
}

export class Upstash<TValue = unknown> {
  constructor(private options: Options) {
    this.options.prefix = this.options.prefix || "cache";
  }

  private upstash = () => createUpstash(this.options);

  async get<TResult = TValue>(key: string) {
    return this.upstash().get<TResult>(`${this.options.prefix}:${key}`);
  }

  async set<Value = TValue>(
    key: string,
    value: Value,
    options?: SetCommandOptions
  ) {
    return this.upstash().set(`${this.options.prefix}:${key}`, value, options);
  }

  async del(...args: string[]) {
    return this.upstash().del(
      ...args.map((key) => `${this.options.prefix}:${key}`)
    );
  }
}

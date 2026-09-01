import { vi } from "vitest";

type KvValue =
  | string
  | number
  | boolean
  | null
  | readonly KvValue[]
  | { readonly [key: string]: KvValue };

const store = new Map<string, KvValue>();

const kv = {
  get: vi.fn((key: string) => store.get(key)),
  set: vi.fn((key: string, value: KvValue) => {
    store.set(key, value);
    return true;
  }),
  delete: vi.fn((key: string) => store.delete(key)),
};

export const kvStore = store;

export const getRedisKv = () => kv;

export const resetKvMocks = () => {
  store.clear();
  kv.get.mockClear();
  kv.set.mockClear();
  kv.delete.mockClear();
};

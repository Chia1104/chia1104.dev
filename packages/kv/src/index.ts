import Keyv from "keyv";

import { getClient } from "./clients";

export const kv = new Keyv(getClient());

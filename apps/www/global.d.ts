import type en from "./messages/en.json";
import type zh_tw from "./messages/zh-tw.json";

type Messages = typeof en & typeof zh_tw;

declare global {
  // Use type safe message keys with `next-intl`
  type IntlMessages = Messages;
}

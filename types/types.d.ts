import type { DiscordImporter } from "../src";

declare global {
  type SelectPartial<T, K extends keyof T> = Partial<Pick<T, K>> & Omit<T, K>;
  type PartialExcept<T, K extends keyof T> = Partial<
    Pick<T, Exclude<keyof T, K>>
  > &
    Pick<T, K>;

  var DiscordImporter: DiscordImporter;
}

export {};

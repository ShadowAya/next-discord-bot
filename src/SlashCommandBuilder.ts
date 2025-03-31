import {
  RESTPostAPIChatInputApplicationCommandsJSONBody,
  APIApplicationCommandSubcommandOption,
  ApplicationCommandOptionType,
} from "discord-api-types/v10";
import { PermissionsField } from "./Permissions";
import { SlashCommandInteraction } from "./Interactions";

type ExecuteFn = (interaction: SlashCommandInteraction) => Promise<any>;
type ExecuteFnWithPrev<Prev = any> = (
  interaction: SlashCommandInteraction,
  previous: Prev
) => Promise<any>;

type AsExport<T> = Omit<T, "execute" | "default_member_permissions"> &
  (T extends SlashRootCommandBuilderData
    ? {
        default_member_permissions: RESTPostAPIChatInputApplicationCommandsJSONBody["default_member_permissions"];
      }
    : {});

type SlashRootCommandBuilderData = Omit<
  RESTPostAPIChatInputApplicationCommandsJSONBody,
  "options" | "name" | "default_member_permissions" | "type"
> & {
  default_member_permissions?: PermissionsField;
  execute?: ExecuteFn;
};

type SlashSubCommandBuilderData<Prev = never> = Omit<
  APIApplicationCommandSubcommandOption,
  "options" | "name" | "type"
> & {
  execute: ExecuteFnWithPrev<Prev>;
};

export class SlashRootCommandBuilder {
  public data: SlashRootCommandBuilderData;
  public execute?: ExecuteFn;

  constructor(data: SlashRootCommandBuilderData) {
    const { execute, default_member_permissions, ...rest } = data;
    this.execute = execute;
    this.data = {
      ...rest,
      default_member_permissions: default_member_permissions,
    };
  }

  export() {
    const { execute, ...rest } = this.data;
    return {
      ...rest,
      default_member_permissions: rest.default_member_permissions
        ?.asNumber()
        .toString(),
    } satisfies AsExport<SlashRootCommandBuilderData>;
  }
}

export class SlashSubCommandBuilder<Prev = never> {
  public data: SlashRootCommandBuilderData;
  public execute: ExecuteFnWithPrev<Prev>;

  constructor(data: SlashSubCommandBuilderData<Prev>) {
    const { execute, ...rest } = data;
    this.execute = execute;
    this.data = {
      ...rest,
    };
  }

  export() {
    const { execute, ...rest } = this.data;
    return rest satisfies AsExport<SlashSubCommandBuilderData<Prev>>;
  }
}

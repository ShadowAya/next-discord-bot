import path from "path";
import fs from "fs";
import { pathToFileURL } from "url";
import type {
  SlashRootCommandBuilder,
  SlashSubCommandBuilder,
} from "./SlashCommandBuilder";
import {
  ApplicationCommandOptionType,
  type RESTPostAPIChatInputApplicationCommandsJSONBody,
} from "discord-api-types/v10";
import chalk from "chalk";

export type CommandStructure = {
  [name: string]: {
    root: SlashRootCommandBuilder;
    sub?: {
      [name: string]: {
        root: SlashSubCommandBuilder;
        sub?: {
          [name: string]: SlashSubCommandBuilder;
        };
      };
    };
  };
};

type ReturningCommands<
  T extends [string] | [string, string] | [string, string, string]
> = T extends [string]
  ? [SlashRootCommandBuilder]
  : T extends [string, string]
  ? [SlashRootCommandBuilder, SlashSubCommandBuilder<any>]
  : T extends [string, string, string]
  ? [
      SlashRootCommandBuilder,
      SlashSubCommandBuilder<any>,
      SlashSubCommandBuilder<any>
    ]
  : never;

export default class DiscordImporter {
  private constructor() {}

  private async importCommandClass<
    T extends "SlashRootCommandBuilder" | "SlashSubCommandBuilder"
  >(commandPath: string, expects: T) {
    const commandFile = path.join(commandPath, "command.js");
    const commandName = path.basename(commandPath);
    let commandModule: any;
    try {
      const fileURL = pathToFileURL(commandFile);
      if (process.env.NODE_ENV === "development") {
        fileURL.searchParams.set("t", Date.now().toString());
      }
      commandModule = await eval(`import(${JSON.stringify(fileURL.href)})`);
    } catch {
      throw new Error(
        `Command file "${commandFile}" does not exist or is not a valid module.`
      );
    }
    let commandClass: T extends "SlashRootCommandBuilder"
      ? SlashRootCommandBuilder
      : SlashSubCommandBuilder<any>;
    try {
      commandClass = commandModule.default.default;
    } catch {
      throw new Error(
        `Command file "${commandFile}" does not export a default class.`
      );
    }
    if (!commandClass) {
      throw new Error(
        `Command file "${commandFile}" does not export a default class.`
      );
    }
    if (commandClass.constructor.name !== expects) {
      throw new Error(
        `Command file "${commandFile}" does not export a ${expects} class.`
      );
    }
    return [commandName, commandClass] as const;
  }

  private async loadAllCommands() {
    const commandsOut: CommandStructure = {};

    const sourceCommands = path.resolve(
      process.env.NDB_DISCORD_DIST_DIR ?? "",
      "commands"
    );
    const files = fs.readdirSync(sourceCommands);

    for (const file of files) {
      const commandPath = path.join(sourceCommands, file);
      await this.loadCommand(commandPath, commandsOut);
    }

    return commandsOut;
  }

  private async loadCommand(dir: string, commandStructure: CommandStructure) {
    const [commandName, commandClass] = await this.importCommandClass(
      dir,
      "SlashRootCommandBuilder"
    );

    commandStructure[commandName] = {
      root: commandClass,
    };

    const subDirs = fs
      .readdirSync(dir)
      .filter((subDir) => fs.statSync(path.join(dir, subDir)).isDirectory());

    await Promise.all(
      subDirs.map((subDir) => {
        const subCommandPath = path.join(dir, subDir);
        return this.loadSubCommand(
          subCommandPath,
          commandStructure[commandName]
        );
      })
    );
  }

  private async loadSubCommand(
    dir: string,
    parentCommand: CommandStructure[string]
  ) {
    const commandFile = path.join(dir, "command.js");
    if (fs.existsSync(commandFile)) {
      const [commandName, commandClass] = await this.importCommandClass(
        dir,
        "SlashSubCommandBuilder"
      );
      if (!parentCommand.sub) {
        parentCommand.sub = {};
      }
      parentCommand.sub[commandName] = {
        root: commandClass,
      };

      const subDirs = fs
        .readdirSync(dir)
        .filter((subDir) => fs.statSync(path.join(dir, subDir)).isDirectory());
      await Promise.all(
        subDirs.map((subDir) => {
          const subCommandPath = path.join(dir, subDir);
          return this.loadSubSubCommand(
            subCommandPath,
            parentCommand.sub![commandName]
          );
        })
      );
    }
  }

  private async loadSubSubCommand(
    dir: string,
    parentCommand: {
      root: SlashSubCommandBuilder;
      sub?: { [name: string]: SlashSubCommandBuilder };
    }
  ) {
    const commandFile = path.join(dir, "command.js");
    if (fs.existsSync(commandFile)) {
      const [commandName, commandClass] = await this.importCommandClass(
        dir,
        "SlashSubCommandBuilder"
      );

      if (commandClass?.constructor?.name === "SlashSubCommandBuilder") {
        if (!parentCommand.sub) {
          parentCommand.sub = {};
        }
        parentCommand.sub[commandName] = commandClass;
      }
    }
  }

  public async getCommand<
    T extends [string] | [string, string] | [string, string, string]
  >(parts: T): Promise<ReturningCommands<T>> {
    const commands: (SlashRootCommandBuilder | SlashSubCommandBuilder)[] = [];
    for (let i = 0; i < parts.length; i++) {
      const commandFile = path.resolve(
        process.env.NDB_DISCORD_DIST_DIR ?? "",
        "commands",
        ...parts.slice(0, i + 1)
      );
      const [_, commandClass] = await this.importCommandClass(
        commandFile,
        i > 0 ? "SlashSubCommandBuilder" : "SlashRootCommandBuilder"
      );

      commands.push(commandClass);
    }

    return commands as ReturningCommands<T>;
  }

  private async postCommands() {
    const botToken = process.env.NDB_DISCORD_BOT_TOKEN;
    const clientId = process.env.NDB_DISCORD_CLIENT_ID;
    if (
      !botToken ||
      !clientId ||
      botToken.length === 0 ||
      clientId.length === 0
    ) {
      throw new Error("No bot token provided.");
    }
    const commands = await this.loadAllCommands();
    const postCommands: RESTPostAPIChatInputApplicationCommandsJSONBody[] = [];
    for (const commandName in commands) {
      const shallow = !commands[commandName].sub;
      const command = {
        ...commands[commandName].root.export(),
        name: commandName,
        options: shallow
          ? [] // @todo build rootcommand options here
          : Object.keys(commands[commandName].sub!).map((subCommandName) => {
              const subCommand = commands[commandName].sub![subCommandName];
              const shallow = !subCommand.sub;
              return {
                ...subCommand.root.export(),
                name: subCommandName,
                type: shallow
                  ? (ApplicationCommandOptionType.Subcommand as const)
                  : (ApplicationCommandOptionType.SubcommandGroup as const),
                options: shallow
                  ? [] // @todo build subcommand options here
                  : Object.keys(subCommand.sub!).map((subSubCommandName) => {
                      const subSubCommand = subCommand.sub![subSubCommandName];
                      return {
                        ...subSubCommand.export(),
                        name: subSubCommandName,
                        type: ApplicationCommandOptionType.Subcommand as const,
                        options: [], // @todo build subsubcommand options here
                      };
                    }),
              };
            }),
      };
      postCommands.push(
        command as RESTPostAPIChatInputApplicationCommandsJSONBody
      );
    }
    const req = await fetch(
      `https://discord.com/api/v10/applications/${clientId}/commands`,
      {
        method: "PUT",
        headers: {
          Authorization: `Bot ${botToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(postCommands),
      }
    );
    if (!req.ok) {
      const error = await req.json();
      throw new Error(
        `Failed to post commands: ${req.status} ${req.statusText}\n` +
          JSON.stringify(error, null, 2)
      );
    }
    console.log(`📩 Posted ${chalk.blue(postCommands.length)} commands`);
  }

  public static async init() {
    if (global.DiscordImporter) return;

    const importer = new DiscordImporter();
    global.DiscordImporter = importer;
    console.log("DiscordImporter initialized.");
    if (process.env.NDB_POST_COMMANDS === "1") {
      await importer.postCommands();
    }
  }
}

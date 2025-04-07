# next-discord-bot

A NextJS serverless-compatible library for creating Discord bots.
Uses file based routing with templates.

## Setup (Discord Developer Portal)

You need to enable Interactions Endpoint URL under `Selected App > General Information > Interactions Endpoint URL` in your Discord Application. Enter the endpoint you selected in your API Routes (example: `https://example.com/api/discord`).

*For local development, you can use [Ngrok](https://ngrok.com/)*

## Setup (your app)

### next.config.ts
Call `addDiscordCompilation` in your next config
```ts
import type { NextConfig } from "next";
import { addDiscordCompilation } from "next-discord-bot";

const config: NextConfig = {};

export default addDiscordCompilation(config, {
  postCommands: true,
});
```

### instrumentation.ts
Initialize a `DiscordImporter` in your instrumentation hook
```ts
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { DiscordImporter } = await import("next-discord-bot");
    return DiscordImporter.init();
  }
}
```

### server
Pick an API Route to handle Discord requests (example: `src/app/api/discord/route.ts`)
```ts
import DiscordClient from "next-discord-bot";

export const POST = new DiscordClient().server;
```

## Routing

### Commands

- `src/discord`
  - `commands`
  - [root command]
    - `command.ts`
    - [subcommand]
      - `command.ts`
    - [subcommand group]
      - `command.ts`
      - [subcommand]
        - `command.ts`

Commands/Subcommands are named after their folder.
Each command has a root `command.ts` file exporting `SlashRootCommandBuilder`.

As per [Discord API](SlashRootCommandBuilder), each command can have subcommands with depth of up to two levels. Subcommands and Subcommand Groups are interchangable, they export `SlashSubCommandBuilder`.

## Usage

### `SlashRootCommandBuilder` and `SlashSubCommandBuilder`

Structure for your commands. `SlashRootCommandBuilder` defines all metadata for a command.
Each `CommandBuilder` can define an `#execute` method, they trigger from root to child and pass return values to each other.

*Note: Only the lowest defined command can be invoked by itself by a user. [More Info](https://discord.com/developers/docs/interactions/application-commands#subcommands-and-subcommand-groups)*

```ts
import {
  SlashRootCommandBuilder,
  PermissionsField,
  BitwisePermission
} from "next-discord-bot";

export default new SlashRootCommandBuilder({
  description: "Ping command",
  default_member_permissions: new PermissionFlagField(
    BitwisePermission.ADMINISTRATOR,
  ),
  execute: async (interaction) => {
    const time = Date.now() - interaction.createdAt.getTime();
    await interaction.reply({
      content: `Ping! \`${time}ms\``,
      ephemeral: true,
    });
  },
});
```

```ts
import { SlashSubCommandBuilder } from "next-discord-bot";

function rollDice() {
  return Math.floor(Math.random() * 6) + 1;
}

export default new SlashSubCommandBuilder({
  description: "Roll a dice",
  execute: async (interaction) => {
    const roll = rollDice();
    await interaction.reply(`🎲 You rolled **${roll}**`);
  },
});

```

## Features

- Library
  - [x] Separate routing and compilation
  - [x] Watchmode
  - [ ] Compiled type-safety
- Slash Commands
  - [ ] Slash Command Builders
    - [x] Structure
    - [x] Execution
    - [ ] Options
  - [x] Slash Command Interactions
  - [ ] Autocomplete
- User Commands
  - [ ] User Command Interactions
  - [ ] User Command Builders
- Message Commands
  - [ ] Message Command Interactions
  - [ ] Message Command Builders
- Components
  - [ ] Component Interactions
  - [ ] Component Builders
- Modals
  - [ ] Modal Interactions
  - [ ] Modal Builders
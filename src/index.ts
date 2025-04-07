import { verifyKey } from "discord-interactions";
import {
  APIChatInputApplicationCommandInteraction,
  APIInteraction,
  APIInteractionResponsePong,
  APIPingInteraction,
  InteractionResponseType,
  InteractionType,
  APIApplicationCommandInteractionDataSubcommandGroupOption,
  ApplicationCommandOptionType,
} from "discord-api-types/v10";
import { NextResponse, NextRequest } from "next/server";
import {
  SlashSubCommandBuilder,
  SlashRootCommandBuilder,
} from "./SlashCommandBuilder";
import { addDiscordCompilation } from "./DiscordCompilerPlugin";
import DiscordImporter from "./DiscordImporter";
import {
  ChannelFlagField,
  PermissionFlags,
  PermissionFlagField,
} from "./Flags";
import { SlashCommandInteraction } from "./discord_classes/Interactions";

function interactionIsPing(
  interaction: APIInteraction
): interaction is APIPingInteraction {
  return interaction.type === InteractionType.Ping;
}

function interactionIsCommand(
  interaction: APIInteraction
): interaction is APIChatInputApplicationCommandInteraction {
  return interaction.type === InteractionType.ApplicationCommand;
}

export default class DiscordClient {
  private publicKey: string;

  constructor() {
    const publicKey = process.env.NDB_DISCORD_PUBLIC_KEY;
    if (!publicKey || publicKey.length === 0) {
      throw new Error("No public key provided.");
    }
    this.publicKey = publicKey;
  }

  server = async (req: NextRequest) => {
    if (req.method !== "POST") {
      return new NextResponse(null, { status: 405 });
    }

    const body = await req.text();
    const verified = await this.verify(req, body);
    if (!verified) {
      return new NextResponse(null, { status: 401 });
    }

    const bodyJson = JSON.parse(body) as APIInteraction;
    return this.handleInteraction(bodyJson);
  };

  private async verify(req: NextRequest, body: string) {
    const signature = req.headers.get("X-Signature-Ed25519");
    const timestamp = req.headers.get("X-Signature-Timestamp");
    if (!signature || !timestamp) {
      return false;
    }

    return verifyKey(body, signature, timestamp, this.publicKey);
  }

  private handleInteraction(interaction: APIInteraction) {
    if (interactionIsPing(interaction)) {
      return NextResponse.json<APIInteractionResponsePong>({
        type: InteractionResponseType.Pong,
      });
    } else if (interactionIsCommand(interaction)) {
      this.handleCommandInteraction(interaction);
      return new NextResponse(null, { status: 202 });
    } else {
      console.log(
        "received other interaction",
        JSON.stringify(interaction, null, 2)
      );
      return new NextResponse(null, { status: 400 });
    }
  }

  private async handleCommandInteraction(
    interaction: APIChatInputApplicationCommandInteraction
  ): Promise<void> {
    const commandNameParts = [interaction.data.name];
    if (
      (
        [
          ApplicationCommandOptionType.Subcommand,
          ApplicationCommandOptionType.SubcommandGroup,
        ] as (number | undefined)[]
      ).includes(interaction.data.options?.[0]?.type)
    ) {
      commandNameParts.push(interaction.data.options?.[0].name!);
    }
    if (
      (
        interaction.data
          .options?.[0] as APIApplicationCommandInteractionDataSubcommandGroupOption
      )?.options?.[0]?.type === ApplicationCommandOptionType.Subcommand
    ) {
      commandNameParts.push(
        (
          interaction.data
            .options?.[0] as APIApplicationCommandInteractionDataSubcommandGroupOption
        ).options[0].name!
      );
    }

    const interactionObj = new SlashCommandInteraction(interaction);

    const command = await global.DiscordImporter.getCommand(
      commandNameParts as [string, string, string]
    );
    const rootRun = await command[0].execute?.(interactionObj);
    const subRun = await command[1]?.execute?.(interactionObj, rootRun);
    await command[2]?.execute?.(interactionObj, subRun);
  }
}

export {
  SlashSubCommandBuilder,
  SlashRootCommandBuilder,
  DiscordImporter,
  PermissionFlagField,
  ChannelFlagField,
  PermissionFlags,
  addDiscordCompilation,
};

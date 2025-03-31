import {
  APIApplicationCommandInteraction,
  APIInteraction,
  APIInteractionResponseChannelMessageWithSource,
  InteractionResponseType,
  InteractionType,
} from "discord-api-types/v10";
import { NextResponse } from "next/server";

function getTimestampFromSnowflake(snowflake: string): Date {
  const discordEpoch = 1420070400000n; // Jan 1, 2015
  const id = BigInt(snowflake);
  const timestamp = (id >> 22n) + discordEpoch;
  return new Date(Number(timestamp));
}

type ReplyContent = {
  tts?: boolean;
  supress_notifications?: boolean;
  supress_embeds?: boolean;
  ephemeral?: boolean;
  content: string;
};

export type InteractionResponseCallback = (res: NextResponse) => void;

class Interaction {
  protected interaction: APIInteraction;
  protected resCallback: InteractionResponseCallback;
  public replied: boolean = false;
  public createdAt: Date = new Date();

  constructor(
    interaction: APIInteraction,
    resCallback: InteractionResponseCallback
  ) {
    this.interaction = interaction;
    this.resCallback = resCallback;
    this.createdAt = getTimestampFromSnowflake(interaction.id);
  }

  async reply(content: string | ReplyContent) {
    // CHANNEL_MESSAGE_WITH_SOURCE

    if (this.replied) {
      throw new Error("Already replied to this interaction.");
    }
    this.replied = true;

    let reqBody: APIInteractionResponseChannelMessageWithSource;

    if (typeof content === "string") {
      reqBody = {
        type: InteractionResponseType.ChannelMessageWithSource,
        data: {
          content,
        },
      };
    } else {
      let compiledFlags = 1;
      if (content.supress_embeds) compiledFlags |= 1 << 2;
      if (content.ephemeral) compiledFlags |= 1 << 6;
      if (content.supress_notifications) compiledFlags |= 1 << 12;

      reqBody = {
        type: InteractionResponseType.ChannelMessageWithSource,
        data: {
          tts: content.tts,
          flags: compiledFlags,
          content: content.content,
        },
      };
    }

    const res = NextResponse.json(reqBody, {
      status: 200,
      headers: {
        "User-Agent": "DiscordBot (example.com, v0.1)",
        "Content-Type": "application/json",
      },
    });

    this.resCallback(res);
  }

  public isCommand(): this is SlashCommandInteraction {
    return this.interaction.type === InteractionType.ApplicationCommand;
  }
}

export class SlashCommandInteraction extends Interaction {
  declare interaction: APIApplicationCommandInteraction;
}

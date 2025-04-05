import {
  APIApplicationCommandInteraction,
  APIInteraction,
  APIInteractionResponseChannelMessageWithSource,
  APIMessage,
  InteractionResponseType,
  InteractionType,
  RESTGetAPIInteractionOriginalResponseResult,
} from "discord-api-types/v10";
import { NextResponse } from "next/server";
import discordAPIRequest from "./DiscordAPI";
import Message from "./Message";

function getTimestampFromSnowflake(snowflake: string): Date {
  const discordEpoch = 1420070400000n; // Jan 1, 2015
  const id = BigInt(snowflake);
  const timestamp = (id >> 22n) + discordEpoch;
  return new Date(Number(timestamp));
}

type MessageContent = {
  tts?: boolean;
  content: string;
  // embeds
  // allowed_mentions
  supress_embeds?: boolean;
  ephemeral?: boolean;
  supress_notifications?: boolean;
  // components
  // attachments
  // poll
};
type EditMessageContent = {
  content?: string;
  // embeds
  // allowed_mentions
  // components
  // attachments
  // poll
};

export type InteractionResponseCallback = (res: NextResponse) => void;

class BaseInteraction {
  protected interaction: APIInteraction;
  protected resCallback: InteractionResponseCallback;
  public replied: boolean = false;
  public createdAt: Date;

  protected constructor(
    interaction: APIInteraction,
    resCallback: InteractionResponseCallback
  ) {
    this.interaction = interaction;
    this.resCallback = resCallback;
    this.createdAt = getTimestampFromSnowflake(interaction.id);
  }

  /**
   * Reply to the interaction with a message.
   * @param content The content of the message to send. Can be a string or an object with additional options.
   */
  async reply(content: string | MessageContent) {
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

  /**
   * Defer the interaction without sending a message.
   * @param ephemeral Whether the deferred message should be ephemeral.
   */
  async defer(ephemeral: boolean = false) {
    if (this.replied) {
      throw new Error("Already replied to this interaction.");
    }
    this.replied = true;

    const reqBody = {
      type: InteractionResponseType.DeferredChannelMessageWithSource,
      data: {
        flags: ephemeral ? 64 : 0,
      },
    };

    const res = NextResponse.json(reqBody, {
      status: 200,
      headers: {
        "User-Agent": "DiscordBot (example.com, v0.1)",
        "Content-Type": "application/json",
      },
    });

    this.resCallback(res);
  }

  /**
   * Get the reply message.
   * @param content The content of the message to send. Can be a string or an object with additional options.
   */
  async getReply() {
    if (!this.replied) {
      return null;
    }

    const req = await discordAPIRequest<APIMessage>(
      `webhooks/${process.env.NDB_DISCORD_CLIENT_ID}/${this.interaction.token}/messages/@original`,
      "GET"
    );
    return new Message(req);
  }

  /**
   * Edit the reply message.
   * @param content The content of the message to send. Can be a string or an object with additional options.
   */
  async editReply(content: string | EditMessageContent) {
    if (!this.replied) {
      throw new Error("Not replied to this interaction yet.");
    }

    const reqBody = typeof content === "string" ? { content } : content;

    const req = await discordAPIRequest<APIMessage>(
      `webhooks/${process.env.NDB_DISCORD_CLIENT_ID}/${this.interaction.token}/messages/@original`,
      "PATCH",
      reqBody
    );
    return new Message(req);
  }

  /**
   * Delete the reply message.
   */
  async deleteReply() {
    if (!this.replied) {
      throw new Error("Not replied to this interaction yet.");
    }

    await discordAPIRequest(
      `webhooks/${process.env.NDB_DISCORD_CLIENT_ID}/${this.interaction.token}/messages/@original`,
      "DELETE"
    );
  }
}

export class Interaction extends BaseInteraction {
  declare interaction: APIInteraction;

  public isCommand(): this is SlashCommandInteraction {
    return this.interaction.type === InteractionType.ApplicationCommand;
  }
}

export class SlashCommandInteraction extends BaseInteraction {
  declare interaction: APIApplicationCommandInteraction;
}

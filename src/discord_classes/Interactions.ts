import {
  APIApplicationCommandInteraction,
  APIInteraction,
  APIInteractionResponseChannelMessageWithSource,
  APIMessage,
  InteractionResponseType,
  InteractionType,
  RESTPostAPIInteractionCallbackWithResponseResult,
  RESTPostAPIInteractionFollowupJSONBody,
  RESTPostAPIInteractionFollowupResult,
} from "discord-api-types/v10";
import discordAPIRequest from "../DiscordAPI";
import Message from "./Message";

function getTimestampFromSnowflake(snowflake: string): Date {
  const discordEpoch = 1420070400000n; // Jan 1, 2015
  const id = BigInt(snowflake);
  const timestamp = (id >> 22n) + discordEpoch;
  return new Date(Number(timestamp));
}

type MessageContentBase = {
  tts?: boolean;
  content: string;
  // embeds
  // allowedMentions
  ephemeral?: boolean;
  supressEmbeds?: boolean;
  supressNotifications?: boolean;
  // components
  // attachments
  // poll
};

type MessageContent<WithRes extends boolean | undefined> =
  MessageContentBase & {
    withResponse?: WithRes;
  };
type EditMessageContent = {
  content?: string;
  // embeds
  // allowedMentions
  // components
  // attachments
  // poll
};
type FollowUpMessageContent<T extends string | undefined> =
  MessageContentBase & {
    threadName?: T;
  } & (T extends string ? { appliedTags: string[] } : {});
type DeferMessageContent<WithRes extends boolean | undefined> = {
  ephemeral?: boolean;
  withResponse?: WithRes;
};

type ReplyHasContent<B extends boolean | undefined, T> = [B] extends [true]
  ? T
  : undefined;

class BaseInteraction {
  protected interaction: APIInteraction;
  public replied: boolean = false;
  public createdAt: Date;

  protected constructor(interaction: APIInteraction) {
    this.interaction = interaction;
    this.createdAt = getTimestampFromSnowflake(interaction.id);
  }

  /**
   * Reply to the interaction with a message.
   * @param content The content of the message to send. Can be a string or an object with additional options.
   */
  async reply<T extends boolean | undefined = false>(
    content: string | MessageContent<T>
  ): Promise<ReplyHasContent<T, Message>> {
    if (this.replied) {
      throw new Error("Already replied to this interaction.");
    }
    this.replied = true;

    let reqBody: APIInteractionResponseChannelMessageWithSource;
    const isString = typeof content === "string";
    const expectsResponse: boolean = !isString && !!content?.withResponse;

    if (isString) {
      reqBody = {
        type: InteractionResponseType.ChannelMessageWithSource,
        data: {
          content,
        },
      };
    } else {
      let compiledFlags = 1;
      if (content.supressEmbeds) compiledFlags |= 1 << 2;
      if (content.ephemeral) compiledFlags |= 1 << 6;
      if (content.supressNotifications) compiledFlags |= 1 << 12;

      reqBody = {
        type: InteractionResponseType.ChannelMessageWithSource,
        data: {
          tts: content.tts,
          flags: compiledFlags,
          content: content.content,
        },
      };
    }

    const req = await discordAPIRequest<
      RESTPostAPIInteractionCallbackWithResponseResult | undefined
    >(
      `interactions/${this.interaction.id}/${this.interaction.token}/callback${
        !isString && content?.withResponse ? "?with_response=true" : ""
      }`,
      "POST",
      reqBody
    );

    if (expectsResponse) {
      if (req?.resource?.message)
        return new Message(req.resource.message) as ReplyHasContent<T, Message>;
      else return (await this.getReply()) as ReplyHasContent<T, Message>;
    } else {
      return undefined as ReplyHasContent<T, Message>;
    }
  }

  /**
   * Defer the interaction without sending a message.
   * @param ephemeral Whether the deferred message should be ephemeral.
   */
  async defer<T extends boolean | undefined = false>(
    options?: DeferMessageContent<T>
  ): Promise<ReplyHasContent<T, Message>> {
    if (this.replied) {
      throw new Error("Already replied to this interaction.");
    }
    this.replied = true;
    const expectsResponse: boolean = !!options?.withResponse;

    const reqBody = {
      type: InteractionResponseType.DeferredChannelMessageWithSource,
      data: {
        flags: options?.ephemeral ? 64 : 0,
      },
    };

    const req = await discordAPIRequest<
      RESTPostAPIInteractionCallbackWithResponseResult | undefined
    >(
      `interactions/${this.interaction.id}/${this.interaction.token}/callback${
        options?.withResponse ? "?with_response=true" : ""
      }`,
      "POST",
      reqBody
    );

    if (expectsResponse) {
      if (req?.resource?.message)
        return new Message(req.resource.message) as ReplyHasContent<T, Message>;
      else return (await this.getReply()) as ReplyHasContent<T, Message>;
    } else {
      return undefined as ReplyHasContent<T, Message>;
    }
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

  async followUp<T extends string | undefined = undefined>(
    content: string | FollowUpMessageContent<T>
  ) {
    let reqBody: RESTPostAPIInteractionFollowupJSONBody;
    const isString = typeof content === "string";

    if (isString) {
      reqBody = { content };
    } else {
      let compiledFlags = 1;
      if (content.supressEmbeds) compiledFlags |= 1 << 2;
      if (content.ephemeral) compiledFlags |= 1 << 6;
      if (content.supressNotifications) compiledFlags |= 1 << 12;

      reqBody = {
        tts: content.tts,
        flags: compiledFlags,
        content: content.content,
        thread_name: content.threadName,
        // @ts-expect-error appliedTags might not exist
        applied_tags: content.appliedTags,
      };
    }

    const req = await discordAPIRequest<RESTPostAPIInteractionFollowupResult>(
      `webhooks/${process.env.NDB_DISCORD_CLIENT_ID}/${this.interaction.token}`,
      "POST",
      reqBody
    );

    return new Message(req);
  }
}

export class Interaction extends BaseInteraction {
  declare interaction: APIInteraction;

  constructor(interaction: APIInteraction) {
    super(interaction);
  }

  public isCommand(): this is SlashCommandInteraction {
    return this.interaction.type === InteractionType.ApplicationCommand;
  }
}

export class SlashCommandInteraction extends BaseInteraction {
  declare interaction: APIApplicationCommandInteraction;

  constructor(interaction: APIApplicationCommandInteraction) {
    super(interaction);
  }
}

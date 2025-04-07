import { APIMessage } from "discord-api-types/v10";
import User from "./User";
import { ChannelId } from "./Channel";

export default class Message {
  private data: APIMessage;

  get author() {
    return new User(this.data.author);
  }

  get channel() {
    return new ChannelId(this.data.channel_id);
  }

  constructor(data: APIMessage) {
    this.data = data;
  }
}

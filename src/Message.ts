import { APIMessage } from "discord-api-types/v10";
import User from "./User";

export default class Message {
  private data: APIMessage;

  get author() {
    return new User(this.data.author);
  }

  constructor(data: APIMessage) {
    this.data = data;
  }
}

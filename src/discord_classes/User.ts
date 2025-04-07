import { APIUser } from "discord-api-types/v10";

export default class User {
  private data: APIUser;

  get id() {
    return this.data.id;
  }

  get username() {
    return this.data.username;
  }

  get discriminator() {
    return this.data.discriminator;
  }

  get globalName() {
    return this.data.global_name;
  }

  constructor(data: APIUser) {
    this.data = data;
  }
}

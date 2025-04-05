import { APIUser } from "discord-api-types/v10";

export default class User {
  private data: APIUser;

  constructor(data: APIUser) {
    this.data = data;
  }
}

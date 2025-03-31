export enum BitwisePermission {
  CREATE_INSTANT_INVITE = 0x0000000000000001,
  KICK_MEMBERS = 0x0000000000000002,
  BAN_MEMBERS = 0x0000000000000004,
  ADMINISTRATOR = 0x0000000000000008,
  MANAGE_CHANNELS = 0x0000000000000010,
  MANAGE_GUILD = 0x0000000000000020,
  ADD_REACTIONS = 0x0000000000000040,
  VIEW_AUDIT_LOG = 0x0000000000000080,
  PRIORITY_SPEAKER = 0x0000000000000100,
  STREAM = 0x0000000000000200,
  VIEW_CHANNEL = 0x0000000000000400,
  SEND_MESSAGES = 0x0000000000000800,
  SEND_TTS_MESSAGES = 0x0000000000001000,
  MANAGE_MESSAGES = 0x0000000000002000,
  EMBED_LINKS = 0x0000000000004000,
  ATTACH_FILES = 0x0000000000008000,
  READ_MESSAGE_HISTORY = 0x0000000000010000,
  MENTION_EVERYONE = 0x0000000000020000,
  USE_EXTERNAL_EMOJIS = 0x0000000000040000,
  VIEW_GUILD_INSIGHTS = 0x0000000000080000,
  CONNECT = 0x0000000000100000,
  SPEAK = 0x0000000000200000,
  MUTE_MEMBERS = 0x0000000000400000,
  DEAFEN_MEMBERS = 0x0000000000800000,
  MOVE_MEMBERS = 0x0000000001000000,
  USE_VAD = 0x0000000002000000,
  CHANGE_NICKNAME = 0x0000000004000000,
  MANAGE_NICKNAMES = 0x0000000008000000,
  MANAGE_ROLES = 0x0000000010000000,
  MANAGE_WEBHOOKS = 0x0000000020000000,
  MANAGE_GUILD_EXPRESSIONS = 0x0000000040000000,
  USE_APPLICATION_COMMANDS = 0x0000000080000000,
  REQUEST_TO_SPEAK = 0x0000000100000000,
  MANAGE_EVENTS = 0x0000000200000000,
  MANAGE_THREADS = 0x0000000400000000,
  CREATE_PUBLIC_THREADS = 0x0000000800000000,
  CREATE_PRIVATE_THREADS = 0x0000001000000000,
  USE_EXTERNAL_STICKERS = 0x0000002000000000,
  SEND_MESSAGES_IN_THREADS = 0x0000004000000000,
  USE_EMBEDDED_ACTIVITIES = 0x0000008000000000,
  MODERATE_MEMBERS = 0x0000010000000000,
  VIEW_CREATOR_MONETIZATION_ANALYTICS = 0x0000020000000000,
  USE_SOUNDBOARD = 0x0000040000000000,
  CREATE_GUILD_EXPRESSIONS = 0x0000080000000000,
  CREATE_EVENTS = 0x0000100000000000,
  USE_EXTERNAL_SOUNDS = 0x0000200000000000,
  SEND_VOICE_MESSAGES = 0x0000400000000000,
  SEND_POLLS = 0x0000800000000000,
  USE_EXTERNAL_APPS = 0x0001000000000000,
}

class PermissionsFieldBase {
  protected permissions = 0x0;

  protected constructor(numValue?: number, bitwiseValue?: BitwisePermission[]) {
    if (numValue !== undefined) {
      this.permissions = numValue;
    }
    if (bitwiseValue) {
      for (const perm of bitwiseValue) {
        this.permissions |= perm;
      }
    }
  }

  /**
   * Checks if the permissions field has the specified permissions.
   * @param permissions The permissions to check for.
   * @returns Whether the permissions field has the specified permissions.
   */
  public has(...permissions: BitwisePermission[]) {
    return permissions.every((perm) => (this.permissions & perm) === perm);
  }

  /**
   * Returns the permissions field as a number.
   * @returns The permissions field as a number.
   */
  public asNumber() {
    return this.permissions;
  }
}

/**
 * A class that constructs the permissions field.
 */
export class PermissionsField extends PermissionsFieldBase {
  private constructor(numValue?: number, bitwiseValue?: BitwisePermission[]) {
    super(numValue, bitwiseValue);
  }

  /**
   * Creates a new permissions field.
   * @param value The value to initialize the permissions field with.
   */
  public static from(value?: number | BitwisePermission[]) {
    if (typeof value === "number") {
      return new PermissionsField(value);
    } else {
      return new PermissionsField(undefined, value);
    }
  }

  /**
   * Adds permissions to the field.
   * @param permissions The permissions to add.
   * @returns The updated permissions field.
   */
  public add(...permissions: BitwisePermission[]) {
    for (const perm of permissions) {
      this.permissions |= perm;
    }
    return this;
  }

  /**
   * Removes permissions from the field.
   * @param permissions The permissions to remove.
   * @returns The updated permissions field.
   */
  public remove(...permissions: BitwisePermission[]) {
    for (const perm of permissions) {
      this.permissions &= ~perm;
    }
    return this;
  }
}

/**
 * A class that stores the permissions field.
 */
class ReadonlyPermissionsField extends PermissionsFieldBase {
  private constructor(numValue?: number, bitwiseValue?: BitwisePermission[]) {
    super(numValue, bitwiseValue);
  }

  public static from(value: number | BitwisePermission[]) {
    if (typeof value === "number") {
      return new ReadonlyPermissionsField(value);
    } else {
      return new ReadonlyPermissionsField(undefined, value);
    }
  }
}

export function createReadonlyPermissionsField(
  value: number | BitwisePermission[]
): ReadonlyPermissionsField {
  return ReadonlyPermissionsField.from(value);
}

export default async function discordAPIRequest<Ret = undefined>(
  endpoint: string,
  method: "GET" | "POST" | "PUT" | "DELETE" | "PATCH",
  body?: Extract<"POST" | "PUT", typeof method> extends never ? never : object,
  headers?: Record<string, string>
): Promise<Ret> {
  const req = await fetch(`https://discord.com/api/v10/${endpoint}`, {
    method,
    headers: {
      "User-Agent": "DiscordBot (example.com, v0.1)",
      "Content-Type": "application/json",
      Authorization: `Bot ${process.env.DISCORD_TOKEN}`,
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!req.ok) {
    const errorText = await req.text();
    throw new Error("Failed to fetch Discord API." + errorText);
  }
  if (req.status === 204) {
    return undefined as Ret;
  }
  return (await req.json()) as Ret;
}

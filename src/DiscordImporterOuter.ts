export default function addDiscordImporter() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    import("./DiscordImporter").then((importer: any) => {
      global.DiscordImporter = new importer.default();
      console.log("DiscordImporter initialized.");
    });
  }
}

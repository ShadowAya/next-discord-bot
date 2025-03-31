import path from "path";
import { existsSync, readdirSync, rmSync } from "fs";
import type webpack from "webpack";
import chokidar from "chokidar";
import { NextConfig } from "next";
import chalk from "chalk";

const hasSrcDir = existsSync(path.resolve(process.cwd(), "src"));
const normalizePath = (p: string) => p.replace(/\\/g, "/");

const startsWithAny = (str: string, prefixes: string[]): boolean => {
  return prefixes.some((prefix) => str.startsWith(prefix));
};
const logIf = (bool: boolean, ...messages: any[]) => {
  if (bool) {
    console.log(...messages);
  }
};

class DistDirError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DistDirError";
  }
}

const pluginBlacklist = [
  "PagesManifestPlugin",
  "MiddlewarePlugin",
  "FlightClientEntryPlugin",
  "NextTypesPlugin",
  "TelemetryPlugin",
  "DropClientPage",
  // "DevToolsIgnorePlugin",
  "TraceEntryPointsPlugin",
  // "IgnorePlugin",
];

const validateDistDir = (
  dir: string | undefined,
  nextDistDir: string | undefined
) => {
  try {
    if (dir) {
      const distDir = normalizePath(dir).replace(/\/+$/, "");
      const root = normalizePath(process.cwd());
      const resolved = normalizePath(path.resolve(process.cwd(), distDir));

      if (distDir === "") {
        throw new DistDirError("⚠️ Illegal distDir path: empty path");
      }
      if (!resolved.startsWith(root)) {
        throw new DistDirError("⚠️ distDir must be within the project root");
      }
      if (resolved === root) {
        throw new DistDirError("⚠️ distDir cannot be the project root");
      }
      if (hasSrcDir && distDir.startsWith("src")) {
        throw new DistDirError(
          '⚠️ Illegal distDir path: conflict with "src" directory'
        );
      }
      if (
        !hasSrcDir &&
        startsWithAny(distDir, ["app", "pages", "types", "discord"])
      ) {
        throw new DistDirError(
          `⚠️ Illegal distDir path: conflict with source files inside "${
            distDir.split("/")[0]
          }"`
        );
      }
      if ((nextDistDir && distDir === nextDistDir) || distDir === ".next") {
        throw new DistDirError(
          `⚠️ Illegal distDir path: conflict with NextJS build directory "${
            nextDistDir ?? ".next"
          }"`
        );
      }
    }
  } catch (error) {
    if (error instanceof DistDirError) {
      throw error;
    } else {
      throw new DistDirError(`⚠️ Error in distDir path: "${dir}"`);
    }
  }
};

const baseDiscordPath = hasSrcDir
  ? path.resolve(process.cwd(), "src/discord")
  : path.resolve(process.cwd(), "discord");

const getDiscordModules = (dir: string, depth = 0): string[] => {
  if (depth > 2) return []; // Limit recursion to 2 levels

  return readdirSync(dir, { withFileTypes: true }).flatMap((dirent) => {
    const fullPath = path.resolve(dir, dirent.name);
    if (dirent.isDirectory()) {
      return getDiscordModules(fullPath, depth + 1); // Recurse into subdirectories
    }
    if (dirent.isFile() && dirent.name === "command.ts") {
      return [fullPath]; // Include only "command.ts" files
    }
    return [];
  });
};

interface DiscordCompilerPluginOptions {
  /**
   * Custom distribution directory for the compiled files.
   * @default "dist/discordModules"
   */
  distDir?: string;
  /**
   * Whether to watch for changes in the Discord directory during development.
   * @default true
   */
  watchMode?: boolean;
  /**
   * Whether to POST command data to Discord after compilation.
   * @default false
   */
  postCommands?: boolean;
  /**
   * Discord app client ID.
   * @default process.env.DISCORD_CLIENT_ID
   */
  clientId?: string;
  /**
   * Discord app public key.
   * @default process.env.DISCORD_PUBLIC_KEY
   */
  publicKey?: string;
  /**
   * Discord bot token.
   * @default process.env.DISCORD_BOT_TOKEN
   */
  botToken?: string;
}

class DiscordCompilerPlugin {
  private webpackInstance: typeof webpack;
  private discordModules: {
    commands: string[];
  } = { commands: [] };
  private buildConfig: webpack.Configuration;
  public options: DiscordCompilerPluginOptions;

  constructor(
    webpackConfig: webpack.Configuration,
    webpackInstance: typeof webpack,
    private nextConfig: NextConfig,
    options?: DiscordCompilerPluginOptions
  ) {
    this.webpackInstance = webpackInstance;

    validateDistDir(options?.distDir, nextConfig.distDir);

    const distOutputPath = path.resolve(
      process.cwd(),
      options?.distDir || "dist/discordModules"
    );

    if (existsSync(distOutputPath)) {
      try {
        rmSync(distOutputPath, { recursive: true, force: true });
      } catch (err) {
        console.warn("⚠️ Failed to clear previous distDir:", err);
      }
    }

    this.options = options ?? {};
    this.options.distDir = options?.distDir
      ? normalizePath(options.distDir)
      : "dist/discordModules";

    const filteredPlugins =
      webpackConfig.plugins?.filter(
        (plugin) =>
          !plugin?.constructor?.name ||
          !pluginBlacklist.includes(plugin?.constructor?.name)
      ) ?? [];

    const originalTracePlugin = webpackConfig.plugins?.find(
      (plugin) => plugin?.constructor?.name === "TraceEntryPointsPlugin"
    );

    if (originalTracePlugin) {
      const TraceEntryPointsPluginClass =
        originalTracePlugin.constructor as any;

      const customTracePlugin = new TraceEntryPointsPluginClass({
        // @ts-expect-error
        rootDir: originalTracePlugin["rootDir"],
        appDir: undefined,
        pagesDir: undefined,
        optOutBundlingPackages:
          // @ts-expect-error
          originalTracePlugin["optOutBundlingPackages"] ?? [],
        appDirEnabled: false,
        // @ts-expect-error
        traceIgnores: originalTracePlugin["traceIgnores"] ?? [],
        // @ts-expect-error
        esmExternals: originalTracePlugin["esmExternals"] ?? true,
        outputFileTracingRoot: path.resolve(
          process.cwd(),
          this.options.distDir
        ),
        // @ts-expect-error
        turbotrace: originalTracePlugin["turbotrace"],
      });

      filteredPlugins.push(customTracePlugin);
    }

    this.buildConfig = {
      ...webpackConfig,
      target: "node",
      externals: {
        fs: "commonjs fs",
        path: "commonjs path",
      },
      resolve: webpackConfig.resolve || {},
      optimization: {
        ...webpackConfig.optimization,
        runtimeChunk: false,
        splitChunks: {
          cacheGroups: {
            discordModules: {
              name: "discordModules",
              priority: 0,
              chunks: "async",
              enforce: true,
            },
            vendors: {
              name: "vendors",
              priority: 1,
              test: /[\\/]node_modules[\\/]/,
              chunks: "async",
              reuseExistingChunk: true,
            },
          },
        },
      },
      output: {
        path: path.resolve(process.cwd(), this.options.distDir),
        filename: "[name].js",
        publicPath: "/",
        library: {
          type: "commonjs2",
        },
      },
      plugins: filteredPlugins,
    };
  }

  apply(compiler: webpack.Compiler) {
    if (
      this.options?.watchMode !== false &&
      compiler.options.mode === "development"
    ) {
      const watcher = chokidar.watch(baseDiscordPath, {
        ignoreInitial: false,
      });

      watcher.on("all", async (event, filePath) => {
        if (
          event === "addDir" ||
          event === "unlinkDir" ||
          event === "ready" ||
          event === "raw" ||
          event === "all"
        )
          return;

        const relativePath = path
          .relative(process.cwd(), filePath)
          .replace(/\\/g, "/");

        const colorMap = {
          add: chalk.greenBright,
          change: chalk.yellowBright,
          unlink: chalk.redBright,
          error: chalk.redBright,
        };

        const eventColor = colorMap[event] || chalk.cyan;
        const label = eventColor(`[${event.toUpperCase()}]`.padStart(10));
        const file = chalk.whiteBright(relativePath);

        console.log(`🔄 ${label} ${file} ${chalk.gray("— Rebuilding...")}`);

        await this.compileDiscordModules(true);
      });

      watcher.on("unlink", (absolutePath) => {
        const relativePath = normalizePath(
          path.relative(baseDiscordPath, absolutePath)
        );

        if (!relativePath.endsWith("command.ts")) return;

        const entryName = relativePath.replace(/\.ts$/, "");

        const distDir = path.resolve(
          process.cwd(),
          this.options?.distDir || "dist/discordModules"
        );
        const compiledPath = path.resolve(distDir, `${entryName}.js`);

        if (existsSync(compiledPath)) {
          try {
            rmSync(compiledPath);

            let dir = path.dirname(compiledPath);

            while (dir !== distDir && existsSync(dir)) {
              const contents = readdirSync(dir);
              if (contents.length === 0) {
                rmSync(dir, { recursive: true });
                dir = path.dirname(dir);
              } else {
                break;
              }
            }
          } catch (err) {
            console.warn("⚠️ Failed to delete dist file:", compiledPath, err);
          }
        }
      });

      compiler.hooks.shutdown.tap("DiscordCompilerPlugin", () => {
        watcher.close();
      });
    } else {
      compiler.hooks.beforeRun.tapPromise("Discord Compiler", () =>
        this.compileDiscordModules(false)
      );
    }
  }

  compileDiscordModules(isDev: boolean): Promise<void> {
    return new Promise((resolve, reject) => {
      logIf(
        !isDev,
        "    ##############   \n" +
          "   ################  \n" +
          "  ################## \n" +
          " ####################\n" +
          " ######  ####  ######\n" +
          " ###### ###### ######\n" +
          " ####################\n" +
          " ####################\n" +
          "    ###        ###   \n"
      );

      const discordCommands = getDiscordModules(
        path.resolve(baseDiscordPath, "commands")
      );
      this.discordModules.commands = discordCommands;

      logIf(!isDev, "🔵 Building Discord modules:", discordCommands);

      const fullBuildConfig = {
        ...this.buildConfig,
        entry: Object.fromEntries(
          discordCommands.map((filePath) => {
            const relativePath = normalizePath(
              path.relative(baseDiscordPath, filePath)
            ).replace(/\.ts$/, "");
            return [relativePath, filePath];
          })
        ),
      };

      const compilation = this.webpackInstance(fullBuildConfig);

      compilation.run((err, stats) => {
        if (err || stats?.hasErrors()) {
          console.log(stats?.toString({ colors: true }) || err);
          console.log("❌ Discord module build failed");
          return reject(new Error("Discord module build failed"));
        }

        logIf(!isDev, stats?.toString({ colors: true }));
        logIf(!isDev, "✅ Discord module build done");
        logIf(!isDev, " #################### Resuming NextJS build\n\n");
        resolve();
      });
    });
  }
}

const addDiscordCompilation = (
  nextConfig: NextConfig,
  options?: DiscordCompilerPluginOptions
): Record<string, any> => {
  process.env.NDB_DISCORD_DIST_DIR = path.resolve(
    process.cwd(),
    options?.distDir ?? "dist/discordModules"
  );
  process.env.NDB_POST_COMMANDS = options?.postCommands ? "1" : "0";
  process.env.NDB_DISCORD_BOT_TOKEN =
    options?.botToken ?? process.env.DISCORD_BOT_TOKEN ?? "";
  process.env.NDB_DISCORD_PUBLIC_KEY =
    options?.publicKey ?? process.env.DISCORD_PUBLIC_KEY ?? "";
  process.env.NDB_DISCORD_CLIENT_ID =
    options?.clientId ?? process.env.DISCORD_CLIENT_ID ?? "";

  return {
    ...nextConfig,
    webpack: (webpackConfig, context) => {
      const { isServer, webpack, nextRuntime } = context;

      if (typeof nextConfig.webpack === "function") {
        webpackConfig = nextConfig.webpack(webpackConfig, context);
      }

      if (!isServer || nextRuntime === "edge") {
        return webpackConfig;
      }

      const compilerPlugin = new DiscordCompilerPlugin(
        webpackConfig,
        webpack,
        nextConfig,
        options
      );

      const includedPlugins = webpackConfig.plugins || [];

      return {
        ...webpackConfig,
        plugins: [...includedPlugins, compilerPlugin],
      };
    },
  } as NextConfig;
};

export { addDiscordCompilation };

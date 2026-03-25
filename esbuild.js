const esbuild = require("esbuild");
const fs = require("fs");
const path = require("path");

const production = process.argv.includes("--production");
const watch = process.argv.includes("--watch");

/**
 * jsdom 通过 require.resolve("./xhr-sync-worker.js") 动态加载 worker,
 * esbuild 无法追踪这种引用，需要手动复制到 dist 目录。
 */
function copyJsdomWorker() {
  const workerSrc = path.join(
    __dirname,
    "node_modules/jsdom/lib/jsdom/living/xhr/xhr-sync-worker.js"
  );
  const workerDest = path.join(__dirname, "dist/xhr-sync-worker.js");

  if (fs.existsSync(workerSrc)) {
    fs.mkdirSync(path.dirname(workerDest), { recursive: true });
    fs.copyFileSync(workerSrc, workerDest);
  }
}

async function main() {
  copyJsdomWorker();

  const ctx = await esbuild.context({
    entryPoints: ["src/extension.ts"],
    bundle: true,
    format: "cjs",
    minify: production,
    sourcemap: !production,
    sourcesContent: false,
    platform: "node",
    outfile: "dist/extension.js",
    external: ["vscode"],
    logLevel: "warning",
  });

  if (watch) {
    await ctx.watch();
    console.log("Watching for changes...");
  } else {
    await ctx.rebuild();
    await ctx.dispose();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

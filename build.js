import * as esbuild from "esbuild";

const isWatch = process.argv.includes("--watch");

const sharedConfig = {
  bundle: true,
  minify: true,
  sourcemap: "inline",
  format: "iife",
  platform: "browser",
  target: [""],
  // Suppress eval warnings from noble crypto libs
  logOverride: {
    "unsupported-require-call": "silent",
  },
};

async function build() {
  const entries = [
    { entryPoints: ["js/background.js"], outfile: "dist/background.js" },
    { entryPoints: ["js/content.js"], outfile: "dist/content.js" },
    { entryPoints: ["js/pgp-handler.js"], outfile: "dist/pgp-handler.js" },
    { entryPoints: ["js/ui.js"], outfile: "dist/ui.js" },
  ];

  if (isWatch) {
    const contexts = await Promise.all(
      entries.map((entry) => esbuild.context({ ...sharedConfig, ...entry })),
    );
    await Promise.all(contexts.map((ctx) => ctx.watch()));
    console.log("Watching for changes…");
  } else {
    await Promise.all(
      entries.map((entry) => esbuild.build({ ...sharedConfig, ...entry })),
    );
    console.log("Build complete.");
  }
}

build().catch((err) => {
  console.error(err);
  process.exit(1);
});

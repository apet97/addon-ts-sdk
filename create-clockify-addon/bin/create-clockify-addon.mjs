#!/usr/bin/env node
import { parseArgs } from "node:util";

import { scaffoldClockifyAddon } from "../src/index.mjs";

const HELP = `Usage: create-clockify-addon <directory> [options]

Options:
  --runtime <node|worker>       Runtime bootstrap to generate. Default: node.
  --features <all|minimal>     Include lifecycle and webhook routes. Default: all.
  -h, --help                   Show this help.`;

function choice(name, value, allowed) {
  if (allowed.includes(value)) return value;
  throw new Error(`${name} must be one of: ${allowed.join(", ")}.`);
}

try {
  const { values, positionals } = parseArgs({
    args: process.argv.slice(2),
    allowPositionals: true,
    options: {
      runtime: { type: "string" },
      features: { type: "string" },
      help: { type: "boolean", short: "h" },
    },
    strict: true,
  });

  if (values.help) {
    console.log(HELP);
  } else {
    if (positionals.length !== 1) {
      throw new Error("Exactly one target directory positional argument is required.");
    }
    const runtime = choice("runtime", values.runtime ?? "node", ["node", "worker"]);
    const features = choice("features", values.features ?? "all", ["all", "minimal"]);
    const directory = positionals[0];
    await scaffoldClockifyAddon({ directory, runtime, features });
    console.log(`Created Clockify add-on in ${directory}`);
  }
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  console.error(`\n${HELP}`);
  process.exitCode = 1;
}

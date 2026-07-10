#!/usr/bin/env node
import { scaffoldClockifyAddon } from "../src/index.mjs";

const args = process.argv.slice(2);
const directory = args.find((arg) => !arg.startsWith("--"));
const runtimeArg = args.find((arg) => arg.startsWith("--runtime="));
const runtime = runtimeArg?.split("=")[1] ?? "node";
if (!directory) {
  console.error(
    "Usage: create-clockify-addon <directory> [--runtime=node|worker]",
  );
  process.exitCode = 1;
} else {
  await scaffoldClockifyAddon({ directory, runtime, features: "all" });
  console.log(`Created Clockify add-on in ${directory}`);
}

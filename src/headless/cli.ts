#!/usr/bin/env node
import { runHeadless } from "./run.js";

process.exitCode = runHeadless(process.argv.slice(2));

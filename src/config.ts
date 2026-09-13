import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";

type RawConfig = Partial<{
  binaryPath: string;
  autoStartDaemon: boolean;
  startTimeoutMs: number;
}>;

export interface WindowsCuaConfig {
  binaryPath?: string;
  autoStartDaemon: boolean;
  startTimeoutMs: number;
}

const DEFAULTS = {
  autoStartDaemon: true,
  startTimeoutMs: 15000,
} satisfies Pick<WindowsCuaConfig, "autoStartDaemon" | "startTimeoutMs">;

async function readJsonIfPresent(path: string): Promise<RawConfig> {
  try {
    const raw = await readFile(path, "utf8");
    return JSON.parse(raw) as RawConfig;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes("ENOENT")) {
      return {};
    }
    throw new Error(`Failed to read config at ${path}: ${message}`);
  }
}

function parseBoolean(value: string | undefined): boolean | undefined {
  if (value === undefined) return undefined;
  const normalized = value.trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "off"].includes(normalized)) return false;
  throw new Error(`Invalid boolean value: ${value}`);
}

function parseNumber(value: string | undefined, name: string): number | undefined {
  if (value === undefined) return undefined;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new Error(`Invalid numeric value for ${name}: ${value}`);
  }
  return parsed;
}

export async function loadWindowsCuaConfig(cwd: string): Promise<WindowsCuaConfig> {
  const userConfig = await readJsonIfPresent(join(homedir(), ".pi/agent/windows-cua.json"));
  const projectConfig = await readJsonIfPresent(join(cwd, ".pi/windows-cua.json"));
  const fileConfig = { ...userConfig, ...projectConfig };

  return {
    binaryPath: process.env.PI_WINDOWS_CUA_BINARY ?? fileConfig.binaryPath,
    autoStartDaemon:
      parseBoolean(process.env.PI_WINDOWS_CUA_AUTOSTART) ??
      fileConfig.autoStartDaemon ??
      DEFAULTS.autoStartDaemon,
    startTimeoutMs:
      parseNumber(process.env.PI_WINDOWS_CUA_START_TIMEOUT_MS, "PI_WINDOWS_CUA_START_TIMEOUT_MS") ??
      fileConfig.startTimeoutMs ??
      DEFAULTS.startTimeoutMs,
  };
}

export function summarizeWindowsCuaConfig(config: WindowsCuaConfig): string {
  return [
    `binary=${config.binaryPath ?? "(auto)"}`,
    `autoStartDaemon=${config.autoStartDaemon}`,
    `startTimeoutMs=${config.startTimeoutMs}`,
  ].join(" ");
}

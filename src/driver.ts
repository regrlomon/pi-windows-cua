import { spawn } from "node:child_process";
import { stat } from "node:fs/promises";
import { delimiter, join } from "node:path";

import type { WindowsCuaConfig } from "./config.js";

const INSTALL_COMMAND = 'powershell -c "irm https://cua.ai/driver/install.ps1 | iex"';
const INSTALL_COMMAND_HINT = `Install cua-driver with: ${INSTALL_COMMAND} (then open a NEW terminal so PATH refreshes).`;

type ExecResult = {
  stdout: string;
  stderr: string;
  code: number;
  killed?: boolean;
};

export type ExecFunction = (
  command: string,
  args: string[],
  options?: { signal?: AbortSignal; timeout?: number },
) => Promise<ExecResult>;

type DriverRawContent =
  | { type: "text"; text?: string }
  | { type: "image"; data?: string; mimeType?: string; mime_type?: string }
  | Record<string, unknown>;

type DriverRawResult = {
  content?: DriverRawContent[];
  structuredContent?: unknown;
  isError?: boolean;
};

type PiTextBlock = { type: "text"; text: string };
type PiImageBlock = { type: "image"; data: string; mimeType: string };

export interface PiDriverToolResult {
  content: Array<PiTextBlock | PiImageBlock>;
  details: Record<string, unknown>;
}

export interface DriverStatus {
  binaryPath: string | null;
  daemonRunning: boolean;
  statusText: string;
}

export interface InvokeOptions {
  ensureDaemon?: boolean;
  timeoutMs?: number;
  omitStructuredFields?: string[];
}

export class WindowsCuaDriver {
  constructor(private readonly exec: ExecFunction) {}

  async isInstalled(_config: WindowsCuaConfig): Promise<boolean> {
    return (await this.resolveBinary(_config)) !== null;
  }

  async assertInstalled(config: WindowsCuaConfig): Promise<void> {
    if (await this.isInstalled(config)) return;
    throw new Error(this.getInstallRequiredMessage());
  }

  async getStatus(config: WindowsCuaConfig): Promise<DriverStatus> {
    const binaryPath = await this.resolveBinary(config);
    if (!binaryPath) {
      return {
        binaryPath: null,
        daemonRunning: false,
        statusText: "cua-driver binary not found",
      };
    }

    const status = await this.exec(binaryPath, ["status"], { timeout: 5000 });
    return {
      binaryPath,
      daemonRunning: status.code === 0,
      statusText: (status.stdout || status.stderr).trim() || `exit ${status.code}`,
    };
  }

  async stopDaemon(config: WindowsCuaConfig): Promise<string> {
    await this.assertInstalled(config);
    const binaryPath = await this.requireBinary(config);
    const result = await this.exec(binaryPath, ["stop"], { timeout: 10000 });
    if (result.code !== 0) {
      throw new Error((result.stderr || result.stdout || "Failed to stop cua-driver daemon.").trim());
    }
    return (result.stdout || "Stopped cua-driver daemon.").trim();
  }

  async diagnose(config: WindowsCuaConfig): Promise<string> {
    await this.assertInstalled(config);
    const binaryPath = await this.requireBinary(config);
    for (const subcommand of ["doctor", "diagnose"]) {
      const result = await this.exec(binaryPath, [subcommand], { timeout: 30000 });
      if (result.code === 0) {
        return result.stdout.trim();
      }
      const unknownCommand = /unknown|unrecognized|not found/i.test(result.stderr);
      if (!unknownCommand) {
        throw new Error((result.stderr || result.stdout || `cua-driver ${subcommand} failed.`).trim());
      }
    }
    throw new Error("cua-driver exposes neither `doctor` nor `diagnose`.");
  }

  async invokeTool(
    config: WindowsCuaConfig,
    toolName: string,
    args: Record<string, unknown>,
    options: InvokeOptions = {},
    signal?: AbortSignal,
  ): Promise<PiDriverToolResult> {
    await this.assertInstalled(config);

    if (options.ensureDaemon !== false) {
      await this.ensureDaemonRunning(config, signal);
    }

    const binaryPath = await this.requireBinary(config);
    const execResult = await this.exec(
      binaryPath,
      ["call", "--raw", "--compact", toolName, JSON.stringify(args)],
      { timeout: options.timeoutMs ?? 30000, signal },
    );

    const parsed = this.tryParseRaw(execResult.stdout);
    if (!parsed) {
      throw new Error(
        [
          `Expected machine-readable JSON from \`cua-driver call --raw\` for ${toolName}, but parsing failed.`,
          execResult.stderr.trim(),
          execResult.stdout.trim(),
        ]
          .filter(Boolean)
          .join("\n\n"),
      );
    }

    const content = this.buildPiContent(parsed, options.omitStructuredFields ?? []);
    if (parsed.isError || execResult.code !== 0) {
      const message = this.contentToText(content)
        || execResult.stderr.trim()
        || `${toolName} failed.`;
      throw new Error(message);
    }

    return {
      content,
      details: {
        driverTool: toolName,
        binaryPath,
        structuredContent: parsed.structuredContent ?? null,
        stdout: execResult.stdout,
        stderr: execResult.stderr,
        exitCode: execResult.code,
      },
    };
  }

  getInstallRequiredMessage(): string {
    return `cua-driver.exe was not found on PATH or in the default install location. ${INSTALL_COMMAND_HINT}`;
  }

  private async ensureDaemonRunning(config: WindowsCuaConfig, signal?: AbortSignal): Promise<void> {
    await this.assertInstalled(config);
    const status = await this.getStatus(config);
    if (status.daemonRunning) return;

    if (!config.autoStartDaemon) {
      throw new Error(
        "cua-driver daemon is not running. Start it with `cua-driver serve` or enable autoStartDaemon.",
      );
    }

    await this.startDaemonDetached(await this.requireBinary(config));

    const deadline = Date.now() + config.startTimeoutMs;
    while (Date.now() < deadline) {
      const next = await this.getStatus(config);
      if (next.daemonRunning) return;
      await sleep(250, signal);
    }

    throw new Error(
      "Timed out waiting for the cua-driver daemon. Run `cua-driver doctor` to check what is wrong.",
    );
  }

  // `serve` never exits, so it must be spawned detached rather than awaited
  // through the injected exec (which captures output until process exit).
  private async startDaemonDetached(binaryPath: string): Promise<void> {
    const child = spawn(binaryPath, ["serve"], {
      detached: true,
      stdio: "ignore",
      windowsHide: true,
    });
    child.unref();
    await new Promise<void>((resolve) => {
      child.once("spawn", () => resolve());
      child.once("error", () => resolve());
    });
  }

  private async requireBinary(config: WindowsCuaConfig): Promise<string> {
    const binaryPath = await this.resolveBinary(config);
    if (!binaryPath) {
      throw new Error(
        `${this.getInstallRequiredMessage()} If it is installed elsewhere, set PI_WINDOWS_CUA_BINARY or binaryPath in .pi/windows-cua.json.`,
      );
    }
    return binaryPath;
  }

  private async resolveBinary(config: WindowsCuaConfig): Promise<string | null> {
    const candidates = [
      config.binaryPath,
      ...pathsFromEnv("cua-driver.exe"),
      ...pathsFromEnv("cua-driver"),
      process.env.LOCALAPPDATA
        ? join(process.env.LOCALAPPDATA, "Programs", "cua-driver", "cua-driver.exe")
        : undefined,
      process.env.LOCALAPPDATA
        ? join(process.env.LOCALAPPDATA, "cua-driver", "cua-driver.exe")
        : undefined,
    ].filter((candidate): candidate is string => Boolean(candidate));

    for (const candidate of candidates) {
      if (await isFile(candidate)) return candidate;
    }
    return null;
  }

  private tryParseRaw(stdout: string): DriverRawResult | null {
    const trimmed = stdout.trim();
    if (!trimmed.startsWith("{")) return null;
    try {
      return JSON.parse(trimmed) as DriverRawResult;
    } catch {
      return null;
    }
  }

  private buildPiContent(parsed: DriverRawResult, omitStructuredFields: string[]): Array<PiTextBlock | PiImageBlock> {
    const textParts = (parsed.content ?? [])
      .flatMap((item) => (item.type === "text" && typeof item.text === "string" ? [item.text.trim()] : []))
      .filter(Boolean);

    const sanitizedStructured = sanitizeStructuredContent(parsed.structuredContent, omitStructuredFields);
    if (sanitizedStructured !== undefined) {
      const structuredText = JSON.stringify(sanitizedStructured, null, 2);
      if (structuredText && structuredText !== "{}") {
        textParts.push(`Structured data:\n${structuredText}`);
      }
    }

    const content: Array<PiTextBlock | PiImageBlock> = [];
    if (textParts.length > 0) {
      content.push({ type: "text", text: textParts.join("\n\n") });
    }

    for (const item of parsed.content ?? []) {
      if (item.type !== "image") continue;
      if (typeof item.data !== "string") continue;
      const mimeType = typeof item.mimeType === "string"
        ? item.mimeType
        : typeof item.mime_type === "string"
          ? item.mime_type
          : "image/png";
      content.push({ type: "image", data: item.data, mimeType });
    }

    if (!content.some((item) => item.type === "image")) {
      const structured = isRecord(parsed.structuredContent) ? parsed.structuredContent : undefined;
      const base64 = typeof structured?.screenshot_png_b64 === "string" ? structured.screenshot_png_b64 : undefined;
      if (base64 && structured) {
        const mimeType = typeof structured.screenshot_mime_type === "string"
          ? structured.screenshot_mime_type
          : "image/png";
        content.push({ type: "image", data: base64, mimeType });
      }
    }

    if (content.length === 0) {
      content.push({ type: "text", text: "cua-driver returned no content." });
    }
    return content;
  }

  private contentToText(content: Array<PiTextBlock | PiImageBlock>): string {
    return content
      .filter((item): item is PiTextBlock => item.type === "text")
      .map((item) => item.text)
      .join("\n\n")
      .trim();
  }
}

function sanitizeStructuredContent(value: unknown, omitFields: string[]): unknown {
  if (!isRecord(value)) return value;
  const copy: Record<string, unknown> = { ...value };
  for (const field of omitFields) {
    delete copy[field];
  }
  return copy;
}

function isRecord(value: unknown): value is Record<string, any> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

async function isFile(path: string): Promise<boolean> {
  try {
    const stats = await stat(path);
    return stats.isFile();
  } catch {
    return false;
  }
}

function pathsFromEnv(binaryName: string): string[] {
  const pathValue = process.env.PATH;
  if (!pathValue) return [];
  return pathValue
    .split(delimiter)
    .filter(Boolean)
    .map((entry) => join(entry, binaryName));
}

async function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);

    const onAbort = () => {
      clearTimeout(timer);
      reject(new Error("Cancelled"));
    };

    if (signal) {
      if (signal.aborted) {
        onAbort();
        return;
      }
      signal.addEventListener("abort", onAbort, { once: true });
    }
  });
}

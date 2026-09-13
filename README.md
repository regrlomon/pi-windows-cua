# pi-windows-cua

A [Pi](https://pi.dev) extension that lets Pi drive local **Windows** apps through
[cua-driver](https://github.com/trycua/cua) — screenshot, read the UIA/accessibility tree,
click, and type into native desktop applications, no remote sandbox required.

Inspired by (and structurally mirroring) the community extension
[`pi-macos-cua`](https://pi.dev/packages/pi-macos-cua) by tanishqkancharla.

## Prerequisites

1. **Pi coding agent** — [install](https://pi.dev)
2. **cua-driver for Windows** — install with the official one-liner (no admin required):

   ```powershell
   powershell -c "irm https://cua.ai/driver/install.ps1 | iex"
   ```

   Open a **new** terminal afterwards so PATH refreshes, then verify:

   ```powershell
   cua-driver doctor
   ```

## Install

```bash
pi install npm:pi-windows-cua
```

Or from a local checkout:

```bash
pi install E:\path\to\pi-windows-cua
```

## Usage

The extension registers one tool, `windows_cua_exec`, which runs a short JavaScript
sequence in a persistent Node REPL with CUA helpers:

```js
const apps = await listApps();
const app = await launchApp({ name: "Notepad" });
const wins = await listWindows({ pid: app.pid });
const state = await getWindowState({ pid: app.pid, window_id: wins[0].window_id });
await click({ pid: app.pid, window_id: wins[0].window_id, element_index: 2 });
await typeText({ pid: app.pid, text: "hello from pi" });
return "done";
```

### Helpers

| Helper | Driver tool | Notes |
|---|---|---|
| `invoke(tool, args)` | any | Escape hatch for tools without a wrapper |
| `checkPermissions()` | `check_permissions` | Probe capture/input health |
| `listApps()` | `list_apps` | |
| `launchApp({ name \| bundle_id, urls? })` | `launch_app` | `name` = executable/display name; on Windows `bundle_id` = executable path |
| `listWindows({ pid?, on_screen_only? })` | `list_windows` | |
| `getWindowState({ pid, window_id, query? })` | `get_window_state` | Heavy fields omitted; returns screenshot as image |
| `click({ pid, window_id?, element_index? \| x, y, ... })` | `click` | element-index preferred over pixels |
| `typeText({ pid, text, element_index?, window_id? })` | `type_text` | |
| `setValue({ pid, window_id, element_index, value })` | `set_value` | |
| `pressKey({ pid, key, modifiers?, ... })` | `press_key` | |
| `hotkey({ pid, keys })` | `hotkey` | |
| `scroll({ pid, direction, ... })` | `scroll` | |
| `sleep(ms)` | — | Abort-aware delay |
| `state` / `clearState()` | — | Persist plain data across calls |

### Slash commands

- `/install-cua-driver` — print the official install command
- `/windows-cua-status` — config, resolved binary, daemon status
- `/windows-cua-stop` — stop the background daemon
- `/windows-cua-diagnose` — insert `cua-driver doctor` output into the editor

## Configuration

Environment variables (take precedence):

- `PI_WINDOWS_CUA_BINARY` — explicit path to `cua-driver.exe`
- `PI_WINDOWS_CUA_AUTOSTART` — auto-start daemon on demand (`1`/`true`, default on)
- `PI_WINDOWS_CUA_START_TIMEOUT_MS` — daemon start timeout (default `15000`)

Or config files (JSON):

- `~/.pi/agent/windows-cua.json` — user scope
- `<project>/.pi/windows-cua.json` — project scope

```json
{ "binaryPath": "C:\\Users\\me\\AppData\\Local\\Programs\\cua-driver\\cua-driver.exe" }
```

## Notes & caveats

- The extension shells out to `cua-driver call --raw --compact`. Verified against
  cua-driver **0.28.1 (x86_64-windows)**: `--raw` emits bare business JSON there, which
  the driver layer normalizes (older releases wrapped results MCP-style; both shapes are
  accepted). If a future release changes the contract again, parsing fails loudly —
  pin or update the driver (`cua-driver update`).
- The driver sends content-free telemetry by default; opt out with
  `cua-driver telemetry disable`.
- Windows has no macOS-style TCC permission prompts, but elevated windows (Task Manager,
  UAC dialogs) run at a higher integrity level and cannot be automated.
- Helper tool names/parameters mirror cua-driver's documented cross-platform CLI
  surface. If a call fails with "unknown tool", fall back to `invoke("<tool>", {...})`.

## Development

```bash
npm install
npm run check   # tsc --noEmit
```

Pi loads the extension source directly via jiti; there is no build step. Use `/reload`
inside Pi after edits.

## License

[MIT](./LICENSE)

## Acknowledgments

- [trycua/cua](https://github.com/trycua) — the cua-driver this extension wraps
- [pi-macos-cua](https://pi.dev/packages/pi-macos-cua) by tanishqkancharla — the macOS
  sibling whose architecture this project mirrors

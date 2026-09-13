# Technical reference

For user-facing install and usage, see the [README](../README.md). This page documents
the `windows_cua_exec` tool, its helper functions, configuration, and the cua-driver
contract the extension depends on.

## The `windows_cua_exec` tool

The extension registers a single Pi tool, `windows_cua_exec`. It executes a short
JavaScript snippet inside a persistent Node REPL with CUA helpers, so an entire
observe → act → re-observe loop completes within one tool call.

```js
const app = await launchApp({ name: "Notepad" });
const { windows } = await listWindows({ pid: app.pid });
const state = await getWindowState({ pid: app.pid, window_id: windows[0].window_id });
await click({ pid: app.pid, window_id: windows[0].window_id, element_index: 2 });
await typeText({ pid: app.pid, text: "hello from pi" });
return "done";
```

Helpers return the driver's plain JSON directly, so chained expressions like
`app.pid` or `(await listWindows({ pid })).windows[0].window_id` resolve. Only the
screenshot base64 payload is stripped from returned values (megabytes); it is still
attached to the tool result as an image block.

Use `state.*` to persist plain data (numbers, strings, objects) across calls.

## Helpers

| Helper | Driver tool | Notes |
|---|---|---|
| `invoke(tool, args)` | any | Escape hatch for tools without a wrapper |
| `checkPermissions()` | `check_permissions` | Probe capture/input health |
| `listApps()` | `list_apps` | Returns `{ apps: [...] }` |
| `launchApp({ name \| bundle_id, urls? })` | `launch_app` | `name` = executable/display name; `bundle_id` = executable path on Windows |
| `listWindows({ pid?, on_screen_only? })` | `list_windows` | Returns `{ windows: [...] }` with `window_id` per entry |
| `getWindowState({ pid, window_id, query? })` | `get_window_state` | Returns the AX/UIA snapshot; screenshot attached as image |
| `click({ pid, window_id?, element_index? \| x, y, ... })` | `click` | element-index preferred over pixels |
| `typeText({ pid, text, element_index?, window_id?, delivery_mode? })` | `type_text` | `delivery_mode`: `foreground` needed for Chromium/Electron targets |
| `setValue({ pid, window_id, element_index, value })` | `set_value` | Background-safe (UIA) |
| `pressKey({ pid, key, modifiers?, delivery_mode? })` | `press_key` | Same `delivery_mode` rule as typeText |
| `hotkey({ pid, keys, delivery_mode? })` | `hotkey` | Same `delivery_mode` rule as typeText |
| `scroll({ pid, direction, ... })` | `scroll` | |
| `sleep(ms)` | — | Abort-aware delay |
| `state` / `clearState()` | — | Persist plain data across calls |

## Background vs foreground input

Two delivery paths exist on Windows:

- **UIA operations** (`click` with `element_index`, `setValue`, `invoke`) call the
  control's automation interface directly and work on background windows — including
  Chromium apps.
- **Synthesized keyboard input** (`typeText`/`pressKey`/`hotkey`) is delivered via
  `PostMessage` when possible. Classic Win32 apps (Notepad) accept it in the
  background; Chromium/Electron surfaces (Chrome, Edge, VS Code) drop it and the
  driver returns `background_unavailable`. Retry with
  `delivery_mode: "foreground"`, which switches to global input — the target window
  is brought to front and steals focus for that one action.

## Configuration

Environment variables (take precedence):

- `PI_WINDOWS_CUA_BINARY` — explicit path to `cua-driver.exe`
- `PI_WINDOWS_CUA_AUTOSTART` — auto-start daemon on demand (`1`/`true`, default on)
- `PI_WINDOWS_CUA_START_TIMEOUT_MS` — daemon start timeout (default `15000`)

Or config files (JSON):

- `~/.pi/agent/windows-cua.json` — user scope
- `<project>/.pi/windows-cua.json` — project scope

```json
{ "binaryPath": "C:\\Users\\me\\AppData\\Local\\Programs\\Cua\\cua-driver\\bin\\cua-driver.exe" }
```

Binary discovery order: `PI_WINDOWS_CUA_BINARY` → every `PATH` entry →
`%LOCALAPPDATA%\Programs\Cua\cua-driver\bin\cua-driver.exe` (the official installer's
location) → legacy fallbacks.

## Driver contract

The extension shells out to `cua-driver call --raw --compact <tool> <json>`. Verified
against cua-driver **0.28.1 (x86_64-windows)**: `--raw` emits bare business JSON
there, which the driver layer normalizes (older releases wrapped results MCP-style;
both shapes are accepted). If a future release changes the contract again, parsing
fails loudly — pin or update the driver (`cua-driver update`).

The daemon speaks over the named pipe `\\.\pipe\cua-driver` and is started detached
(`cua-driver serve`) on demand when `autoStartDaemon` is enabled.

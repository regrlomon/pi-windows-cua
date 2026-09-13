# pi-windows-cua

Let the [Pi](https://pi.dev) coding agent drive your local **Windows** apps — open
software, click buttons, type text, and read what's on screen, all through plain
language.

Pi + this extension = your agent can use real desktop software (Notepad, Chrome,
IDEs, chat clients…), not just the terminal.

## Install (one-time, about a minute)

1. Install [Pi](https://pi.dev)
2. Install the extension:

   ```bash
   pi install npm:pi-windows-cua
   ```

3. Start `pi` and run:

   ```
   /install-cua-driver
   ```

   The extension installs the [cua-driver](https://github.com/trycua/cua) engine for
   you — user-scope, no admin rights, no permission dialogs.

Done. If the status bar shows `windows-cua: daemon:on`, you're ready.

## Use it — just talk to Pi

There is nothing to configure. Try saying:

- *"Open Notepad and type hello world"*
- *"Open Chrome and go to github.com"*
- *"What buttons are in the Settings window right now?"*
- *"Read the calculator display and tell me the number"*

Pi figures out the steps and you watch them happen on screen.

> Tip: driving an app works best one step at a time — ask Pi to look at the window,
> then act, then look again. Pi already knows this; you don't have to manage it.

## Slash commands

| Command | What it does |
|---|---|
| `/install-cua-driver` | Install the cua-driver engine |
| `/windows-cua-status` | Show engine health and configuration |
| `/windows-cua-stop` | Stop the background engine |
| `/windows-cua-diagnose` | Collect diagnostics (useful for bug reports) |

## Good to know

- **Focus may briefly switch when typing into Chrome / Edge / VS Code.** Modern
  Chromium-based apps only accept simulated keystrokes while focused, so Pi briefly
  brings the target window to front for that one action. Simple apps like Notepad can
  be driven entirely in the background.
- **A few windows can never be automated**: apps running elevated (Task Manager, UAC
  prompts) are protected by Windows itself.
- **Telemetry**: the underlying cua-driver sends content-free usage statistics by
  default. Opt out any time with `cua-driver telemetry disable`.

## Troubleshooting

| Symptom | Fix |
|---|---|
| Status bar says `run /install-cua-driver` | Run `/install-cua-driver` |
| Status bar says `daemon:off` | It auto-starts on the next action; or run `/windows-cua-status` |
| App didn't react to a click/typing | Ask Pi: *"check the window state again"* — minimized or elevated windows can't receive input |
| Something looks broken | Run `/windows-cua-diagnose` and include the output in a bug report |

## For developers

Technical reference — helper functions, delivery modes, configuration files, and the
driver JSON contract — lives in [docs/HELPERS.md](docs/HELPERS.md).

中文说明见 [README.zh-CN.md](README.zh-CN.md)。

```bash
npm install
npm run check   # tsc --noEmit
```

Pi loads the extension source directly; use `/reload` inside Pi after edits.

## License

[MIT](./LICENSE)

## Acknowledgments

- [trycua/cua](https://github.com/trycua) — the cua-driver engine this extension wraps
- [pi-macos-cua](https://pi.dev/packages/pi-macos-cua) by tanishqkancharla — the macOS
  sibling whose architecture this project mirrors

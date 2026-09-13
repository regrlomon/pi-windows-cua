# pi-windows-cua(中文说明)

让 [Pi](https://pi.dev) 编程助手直接操控你 Windows 上的本地应用——打开软件、点按钮、打字、读取屏幕内容,全程自然语言。

Pi + 这个扩展 = 你的助手能用真正的桌面软件(记事本、Chrome、IDE、聊天客户端……),而不只是终端。

## 安装(一次性,约一分钟)

1. 安装 [Pi](https://pi.dev)
2. 安装本扩展:

   ```bash
   pi install npm:pi-windows-cua
   ```

3. 启动 `pi`,输入:

   ```
   /install-cua-driver
   ```

   扩展会替你装好 [cua-driver](https://github.com/trycua/cua) 引擎——用户级安装,不需要管理员权限,没有权限弹窗。

看到状态栏显示 `windows-cua: daemon:on` 就绪。

## 使用——直接跟 Pi 说人话

不需要任何配置,试试:

- *"打开记事本,输入 hello world"*
- *"打开 Chrome 并访问 github.com"*
- *"看看设置窗口里现在有哪些按钮"*
- *"读一下计算器屏幕上显示的数字"*

Pi 自己规划步骤,你在屏幕上看着它执行。

> 小技巧:一次让它做一步效果最好——先看窗口、再操作、再确认。Pi 已经知道这个节奏,你不用管。

## 斜杠命令

| 命令 | 作用 |
|---|---|
| `/install-cua-driver` | 安装 cua-driver 引擎 |
| `/windows-cua-status` | 查看引擎状态和配置 |
| `/windows-cua-stop` | 停止后台引擎 |
| `/windows-cua-diagnose` | 收集诊断信息(报 bug 时用) |

## 需要知道的

- **往 Chrome / Edge / VS Code 打字时,焦点会短暂切换过去。** Chromium 系应用只在前台时才接受模拟按键,所以 Pi 会把目标窗口短暂带到前台完成这一个动作。记事本这类简单应用可以完全在后台操控。
- **少数窗口永远无法自动化**:以管理员权限运行的程序(任务管理器、UAC 弹窗)受 Windows 系统保护。
- **遥测**:底层的 cua-driver 默认发送不含内容的匿名使用统计,随时可以关闭:`cua-driver telemetry disable`

## 疑难排查

| 现象 | 处理 |
|---|---|
| 状态栏显示 `run /install-cua-driver` | 运行 `/install-cua-driver` |
| 状态栏显示 `daemon:off` | 下次操作会自动拉起;或运行 `/windows-cua-status` |
| 点击/打字没反应 | 跟 Pi 说 *"重新看一下窗口状态"*——最小化或管理员权限的窗口收不到输入 |
| 感觉哪里坏了 | 运行 `/windows-cua-diagnose`,把输出附在 bug 报告里 |

## 开发者

技术参考(helper 函数、前后台输入规则、配置、驱动 JSON 契约)见
[docs/HELPERS.md](docs/HELPERS.md);英文说明见 [README.md](README.md)。

## 许可证

[MIT](./LICENSE)

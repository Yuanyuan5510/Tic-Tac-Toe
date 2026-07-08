# 井字游戏（Tic-Tac-Toe）运行与开发指南

**版本:** 1.2

**版权:** `yuanyuan5510` 保留所有权利

## 一句话概览
这是一个使用 Node.js（Express + Socket.IO）实现的多人井字棋（Tic-Tac-Toe）示例：后端在项目根的 `1.js`，前端静态文件在 `public/` 下，前后端通过 WebSocket（Socket.IO）通信。

## 项目结构（关键文件）

- `1.js` — Node/Express + Socket.IO 服务器入口（处理房间、匹配、棋盘逻辑）。
- `1.json` — （已归档为 `1.json.bak`，请使用 `package.json` 作为权威依赖声明）。
- `public/zhu.html` — 前端页面入口。
- `public/1.js` — 前端交互脚本（连接 Socket.IO、处理 UI 与事件）。
- `public/1.js` — 前端交互脚本（连接 Socket.IO、处理 UI 与事件）。

提示：页面引用 `/socket.io/socket.io.js` 时，通常由运行中的 Socket.IO 服务器自动提供；若你直接用静态方式打开页面或打包为 exe，可能无法访问该路径。已将 `zhu.html` 改为使用官方 CDN 作为客户端脚本，若需要离线或本地包含客户端文件，可将 `node_modules/socket.io/client-dist/socket.io.js` 复制到 `public/` 下并修改引用。
- `public/1.css` — 页面样式。

## 运行前准备
- 安装 Node.js（建议 v16+ 或更高）。
- 确认 `package.json` 存在（本仓库原始 `1.json` 内容已复制到 `package.json`，可直接使用 `npm install`）。

## 本地运行（推荐：完整后端 + 前端）
在项目根目录打开终端，运行：

```powershell
# 安装依赖（只需执行一次）
npm install

# 启动服务器（默认端口 31480，可通过环境变量覆盖）
npm start

# 或直接：
# node 1.js
```

启动后在浏览器访问：http://localhost:31480/zhu.html

## 扫描房间与操作提示
当您在页面上点击“扫描房间”查看当前房间列表时，会在列表顶部看到操作提示：

- 找到并点击“您的房间”旁边的【加入】按钮加入房间；
- 加入后在页面底部会显示【关闭房间】按钮；只有房主（创建者）可点击【关闭房间】以释放名额；
- 若您已有未关闭的房间，创建新房间会被拒绝：服务端会返回提示“您已有未关闭的房间 (房号)，请先关闭后再创建新房间”。

这些提示会在前端房间列表中显示，帮助用户在多房间场景下正确操作。

要使用自定义端口（例如 31480）：

```powershell
set PORT=31480  # PowerShell: $env:PORT=31480
npm start
```

## 仅调试前端（无需 Node）
若只想快速查看页面（不进行多人对战），可以直接打开 `public/zhu.html`。注意：直接用文件协议访问时，Socket.IO 无法连接到服务器，某些资源加载会被浏览器限制，推荐用本地静态服务器或运行 Node 后端。

可用静态服务器（任选其一）：

- 使用 Python：
```powershell
cd public
python -m http.server 8000
# 访问 http://localhost:8000/zhu.html
```

- 使用 `http-server`（Node）：
```powershell
npm install -g http-server
cd public
http-server -p 8000
```

## 开发建议
- 使用 `nodemon` 自动重启服务器：`npm install -D nodemon`，然后运行 `npx nodemon 1.js`。
- 在前端开发时可启用 VS Code 的 `Live Server`（仅用于静态页面调试）。
- 若要进行多人联机或负载测试，可用 `wrk`/`autocannon` 等工具对 Socket 连接进行压测。

## 已知实现细节（快速说明）
- 服务器：在 `1.js` 中维护 `games` 和 `players` 对象，实现房间创建、加入、下棋、重启和断线处理。获胜判断在服务器端通过 `checkWinner` 完成。
- 前端：`public/1.js` 负责 UI、事件和与服务器的 Socket.IO 通信。前端在收到 `game-started`、`board-update`、`game-over` 等事件时更新界面。
- 默认端口：服务器监听 `process.env.PORT || 31480`。

## 推荐改进与拓展
- 为房间 ID 使用更安全的生成策略（避免简单可猜测的字符串）。
- 增加服务器端输入校验和速率限制，防止恶意频繁请求或滥用（例如 `express-rate-limit`、socket 连接限制）。
- 持久化对局记录（使用轻量 DB 如 SQLite 或 Redis）。
- 添加简单 AI（Minimax）作为单人模式。
- 使用 HTTPS/反向代理（如 nginx）在生产环境中保护通信。

## 安全风险与缓解（基于当前实现）
- 未验证的房间号/输入：应校验并限制房间号格式与长度，避免注入或异常情况。
- 未限制的资源消耗：当前实现未限制连接数或请求频率，建议添加连接数上限、速率限制和认证（如短期房间 Token）。
- 信息泄露：不要在生产环境中直接运行包含开发日志或敏感文件的目录；确保只暴露 `public/` 内容。
- XSS：前端若暴露玩家输入，必须对展示内容进行转义或使用安全 DOM API（已在前端通过 textContent/innerText 风格更新文本更安全）。

## Docker（可选）
仓库内可用以下 `Dockerfile`（基于现有 README 的示例）：

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --production
COPY . ./
EXPOSE 31480
CMD ["node", "1.js"]
```

构建并运行：

```powershell
docker build -t tic-tac-toe .
docker run -p 31480:31480 tic-tac-toe
```

## 诊断与常见问题
- Socket 连接失败：确认服务器已启动并且前端能访问到 `http://<host>:<port>`，浏览器控制台会显示具体错误。
- 前端不刷新或 UI 异常：在 DevTools 的 Console/Network 检查错误与网络请求。

## 贡献与许可
- 若要贡献：请先 fork 仓库并提交 PR，可添加 `CONTRIBUTING.md` 说明贡献流程。
- 建议使用 MIT 或其他宽松开源许可证。

---

作者：[yuanyuan5510](https://github.com/yuanyuan5510)
更新时间：2026-07-07

## 打包为 Windows 可执行文件（exe）
该项目可以使用 `pkg` 将 Node.js 应用打包为单个可执行文件（包含 Node 运行时）。我们新增了一个启动器 `run_and_check.js`：打包后运行该 exe 会在终端中启动服务器、轮询确认服务可用，若服务正常会自动在默认浏览器打开服务页面。

步骤：

```powershell
# 安装 pkg（可全局或使用 npx）
npm install -g pkg

# 或使用 npx（无需全局安装）
npx pkg . --out-path dist

# 或使用项目脚本（已在 package.json 中添加）
npm run build:exe
```

构建后，`dist/` 目录下会生成对应平台的可执行文件（如 `tic-tac-toe.exe`）。在 Windows 上，双击或在终端运行该 exe：

```powershell
.\dist\tic-tac-toe.exe
```

该可执行文件将在终端输出启动日志，启动成功并通过轮询检测到 `http://localhost:<PORT>/zhu.html` 可访问后，会自动在默认浏览器打开该页面。若在限定时间内检测失败，会在终端展示错误提示并保留日志供排查。

注意与限制：
- `pkg` 有时会对动态 require 或某些本地模块打包行为有特殊要求；如果打包后的 exe 在运行时提示找不到文件，请检查代码中是否存在动态路径或在 `package.json` 中添加 `assets`/`scripts` 配置以包含静态资源。
- 可执行文件包含运行时，体积较大，这是正常现象。


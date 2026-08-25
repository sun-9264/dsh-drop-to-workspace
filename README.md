# @dsh-external/dsh-drop-to-workspace

DSH web GUI 的「拖拽落盘」插件：把**任意文件**拖进消息栏时，自动保存到工作区指定目录并返回可用的绝对路径，供主代理按路径读取/处理（PDF 解析、文本读取、图片识图等）。

## 设计分工

| 拖入内容 | 行为 |
|---|---|
| 图片（png/jpeg/webp/gif） | 交给 DSH **原生识图**，可正常发给模型看图 |
| 非图片（PDF/文档/代码等） | 自动**落盘**到工作区，右下角 toast 显示保存路径，**3 秒自动消失** |

## 原理

- **host（`lib/index.js`）**：注册落盘端点 `POST /@dsh-external/dsh-drop-to-workspace/upload`，接收原始文件流（`application/octet-stream`），文件名取自 `?name=`，用 Node stream 直接写盘到工作区，返回 `{ ok, path, name, size }`。
- **client（`lib/client.js`）**：在浏览器 `window` 捕获阶段监听 `drop`。纯图片放手给 DSH 原生；非图片文件截断（避免 DSH 当作图片附件接收而弹"仅支持图片"）、手动派发 `dragend` 让 DSH 拖拽遮罩复位，随后上传落盘并显示 toast。

## 配置

插件 `Config` 支持：

```js
{
  dropDir: './_drop' // 落盘目录（默认：运行进程当前目录下的 _drop，可用绝对路径覆盖）
}
```

## 用法

拖文件到 DSH 消息栏即可。拖入后右下角出现 `✓ <保存路径>`，3 秒消失；文件保存在 `dropDir` 下，命名 `时间戳_原名`（保留中文可读字符）。

## 构建与注入

```bash
# 构建（需 DSH 源码 checkout）
DSH_CHECKOUT=<checkout> bash scripts/build.sh
npm run build:client   # 若改动 client

# 注入器环境内运行时注入
dev_inject_plugin <本目录>

# 固化为正式装配插件（重启后由 profile bundles 接管）
dev_install_package <本目录>

# 热重载 / 卸载
dev_reload_package dsh-drop-to-workspace
dev_uninject_plugin dsh-drop-to-workspace
```

## 依赖与兼容

- peerDependencies 用范围声明（不硬编码 DSH 版本），兼容 DSH 升级。
- host 只依赖 Node 内建（`node:fs` / `node:stream` / `node:path`），注入 `webServer` 服务；
- client 注入 `@deepseek-ai/dsh-client-ui-slots`，注册 `conversation.input.dock` 槽显示说明。

## 注意

- 前端改动需**刷新页面**后生效。
- 落盘目录默认 `_drop`；如需改大文件上限可在 host 的 `MAX_BYTES` 调整。

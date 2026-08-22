# HandyIn

<p align="center">
  <img alt="License" src="https://img.shields.io/badge/License-AGPL--3.0-blue.svg">
  <img alt="Node" src="https://img.shields.io/badge/Node-%E2%89%A520-brightgreen.svg">
  <img alt="pnpm" src="https://img.shields.io/badge/pnpm-%E2%89%A510-orange.svg">
  <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-5.6-blue.svg">
  <img alt="PRs Welcome" src="https://img.shields.io/badge/PRs-welcome-brightgreen.svg">
</p>

<p align="center">
  面向单校部署的开源作业收取系统 —— 教师建班、建作业，学生持唯一二维码，教师/课代表手机扫码登记纸质作业，WebSocket 实时统计已交/未交。
</p>

HandyIn 是面向学校（单校部署）的作业收取与统计系统。教师创建班级与作业、学生每人持一张唯一二维码，教师或课代表用手机摄像头连续扫码登记纸质作业，多人可并行扫码，系统实时同步已交/未交状态并自动生成未交名单。

## 特性

- 📱 **Web + PWA**：无需安装原生 App，支持 Android / iPhone / 桌面浏览器，可添加到主屏幕。
- 🖥️ **二维码**：学生二维码自动生成、批量打印，贴于作业本即可使用。
- 📷 **连续扫码**：ZXing 连续识别，扫到自动提交，配音效与震动反馈。
- 🔄 **实时同步**：WebSocket 广播多人扫码进度，多个教师/课代表同时收作业不冲突。
- 📥 **批量导入**：CSV / Excel 批量导入学生，自动解析学号 `YYYYDDCCNN`。
- 🏫 **班级与归属**：管理员建班/批量建班；教师自助加入/退出班级；课代表按班级归属授权。
- 🗂️ **切换当前班级**：教师/课代表在侧边栏切换当前班级，作业与学生页随之聚焦。
- ✍️ **手动标记**：二维码不清晰时，可直接在未交名单中手动标记某生「已交」。
- 🔁 **作业状态流转**：草稿 → 收取中 → 已结束，结束后可重新开启；教师可删除自己布置的作业。
- 📡 **离线补传**：断网时扫描结果暂存 IndexedDB，恢复网络后自动补传。
- 🔒 **审计与安全**：关键操作写入审计日志；密码 Argon2id 哈希，Session 存内存。
- 🚀 **子路径部署**：默认 `/handyin` 前缀，可与其它站点共存于同一域名/IP。

## 界面预览

> 截图待补充

<!-- TODO: 将界面截图放入 docs/screenshots/，并替换下面的占位路径 -->

| 班级管理 | 扫码收取 | 已交/未交统计 |
| :---: | :---: | :---: |
| ![班级管理](docs/screenshots/classes.png) | ![扫码](docs/screenshots/scan.png) | ![统计](docs/screenshots/stats.png) |

## 技术栈

| 层 | 技术 |
| --- | --- |
| 前端 `apps/web` | React 19 · Vite 6 · TypeScript · Tailwind CSS 4 · PWA（vite-plugin-pwa） · react-router-dom 7 · ZXing（扫码） · qrcode.react · Radix UI · TanStack Table · sonner |
| 后端 `apps/server` | Fastify 5 · Prisma 6 · TypeScript（ESM） · @fastify/*（cookie/cors/multipart/rate-limit/static/websocket） · @node-rs/argon2 · Zod |
| 共享包 `packages` | `types`（共享类型与常量） · `validation`（Zod schema 与学号解析） |
| 部署 | Docker 多阶段构建 · docker-compose · Caddy（反向代理） · PostgreSQL 16 |

## 快速开始（Docker 部署）

前置：已安装 Docker 与 Compose 插件。

```bash
# 1. 克隆仓库
git clone https://github.com/Lan-Fa/HandyIn.git
cd HandyIn

# 2. 配置环境变量（至少修改 POSTGRES_PASSWORD、SESSION_SECRET、INIT_ADMIN_PASSWORD）
cp .env.example .env
vim .env

# 3. 构建并启动
docker compose up -d --build
```

启动后通过 `http://服务器IP/handyin/` 访问，初始账号密码见 `.env` 中的 `INIT_ADMIN_USERNAME` / `INIT_ADMIN_PASSWORD`（首次登录后请立即修改）。

## 本地开发

需要 Node.js ≥ 20、pnpm ≥ 10、PostgreSQL。

```bash
pnpm install
cp .env.example .env            # 配置 DATABASE_URL 指向本地 PostgreSQL
pnpm --filter @handyin/server prisma:push   # 同步数据库结构
pnpm dev                        # 同时启动前端（5173）与后端（3000）
```

常用命令：

| 命令 | 说明 |
| --- | --- |
| `pnpm dev` | 启动开发环境 |
| `pnpm build` | 全量构建 |
| `pnpm typecheck` | 全量类型检查 |
| `pnpm --filter @handyin/server prisma:generate` | 生成 Prisma Client |
| `pnpm --filter @handyin/server prisma:push` | 同步数据库结构（无 migrations，统一 db push） |
| `pnpm --filter @handyin/server test:unit` | 跑纯函数单元测试（本地即可） |

## 配置说明

关键环境变量（`.env`）：

| 变量 | 说明 |
| --- | --- |
| `HANDYIN_BASE_PATH` | 整站子路径前缀，默认 `/handyin` |
| `CADDY_HTTP_PORT` | 对外 HTTP 端口，默认 `80` |
| `SITE_ADDRESS` | IP+HTTP 填 `http://:80`；有域名填 `handyin.example.com`（自动 HTTPS） |
| `COOKIE_SECURE` | HTTP/IP 访问 `false`；启用 HTTPS 后 `true` |
| `POSTGRES_PASSWORD` | 数据库密码（必填） |
| `SESSION_SECRET` | Session Cookie 签名密钥（必填） |
| `INIT_ADMIN_USERNAME` / `INIT_ADMIN_PASSWORD` | 初始管理员账号（首次启动自动创建） |

## 使用流程

1. **管理员**：登录后创建班级（支持按年份/学部批量创建），创建教师/课代表账号。
2. **教师**：自助加入所带班级 → 添加或 CSV/Excel 导入学生 → 打印学生二维码。
3. **管理员/教师**：在「班级」页为班级分配课代表（或在「用户」中创建课代表账号时选班）。
4. **教师**：创建作业并「开始收取」。
5. **收取**：教师/课代表打开作业 → 开始扫码，手机摄像头连续扫描；二维码不清晰时可在未交名单手动标记。
6. **统计**：实时查看已交/未交名单并导出。

## 目录结构

```
apps/
  web/        React + Vite + Tailwind + PWA 前端
  server/     Fastify + Prisma + WebSocket 后端
packages/
  types/      共享类型与常量
  validation/ 学号解析 + Zod schema
prisma/       数据模型（schema.prisma）
docs/         项目文档与计划书
```

## 安全

- 密码使用 Argon2id 哈希，不存明文。
- Session 使用 HttpOnly / SameSite Cookie（HTTPS 下启用 Secure）。
- 登录接口限流，统一报错避免泄露用户是否存在。
- 后端按「身份 → 角色 → 班级/作业归属」分层校验权限。
- 关键操作（删除记录、分配课代表、手动标记等）写入审计日志。

## License

[AGPL-3.0](./LICENSE)
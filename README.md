# HandyIn

HandyIn 是一个开源、跨平台的二维码作业收取与统计系统。教师创建班级与作业、学生持唯一二维码，教师/课代表通过手机扫码登记纸质作业，多人并行扫码，系统实时统计已交/未交并生成未交名单。

## 特性

- Web + PWA，支持 Android / iPhone / 桌面浏览器
- 连续扫码、自动提交、音效与震动反馈
- WebSocket 实时同步多人扫码进度
- CSV / Excel 批量导入学生，自动解析学号 `YYYYDDCCNN`
- 学生二维码生成与批量打印
- 课代表按作业授权（可过期），教师账号安全（Argon2id + Session）
- 离线扫码：断网暂存 IndexedDB，恢复后自动补传
- 通过子路径部署（默认 `/handyin`），可与其它站点共存

## 架构

```
浏览器 / PWA
    │  HTTP(S) /handyin/*
    ▼
Caddy（反向代理，默认 80 端口）
    │
    ▼
Fastify 后端（容器内 3000，托管 API + 前端静态资源 + WebSocket）
    ▼
PostgreSQL
```

## 快速开始（Docker 部署）

### 1. 安装 Docker 与 compose 插件

Ubuntu/Debian：

```bash
curl -fsSL https://get.docker.com | sh
```

安装后确认：

```bash
docker --version
docker compose version
```

### 2. 配置

```bash
cp .env.example .env
vim .env   # 至少修改 POSTGRES_PASSWORD、SESSION_SECRET、INIT_ADMIN_PASSWORD
```

### 3. 启动

```bash
docker compose up -d --build
```

### 4. 访问

- 默认通过 IP 访问：`http://服务器IP/handyin/`
- 初始账号：`.env` 中的 `INIT_ADMIN_USERNAME` / `INIT_ADMIN_PASSWORD`

### 5. 更换端口 / 子路径 / 启用 HTTPS

- 换端口：修改 `.env` 的 `CADDY_HTTP_PORT`（例如 8080），重启 `docker compose up -d`
- 换子路径：修改 `.env` 的 `HANDYIN_BASE_PATH`（例如 `/shouzuoye`），并 `docker compose up -d --build`
- 启用 HTTPS：在 `.env` 设 `SITE_ADDRESS=handyin.example.com`，并将 `COOKIE_SECURE=true`，Caddy 会自动签发证书

## 使用流程

1. 管理员登录 → 创建班级（支持按年份/学部批量创建）；创建教师账号
2. 教师登录 → 自助加入所带班级 → 添加或 CSV/Excel 导入学生
3. 打印学生二维码（贴作业本）
4. 创建作业并开始收取
5. 指定课代表（或在「用户」中先创建课代表账号）
6. 教师/课代表打开作业 → 开始扫码 → 手机摄像头连续扫描
7. 实时查看已交/未交名单

## 本地开发

需要 Node.js ≥ 20、pnpm ≥ 10、PostgreSQL。

```bash
pnpm install
cp .env.example .env          # 配置 DATABASE_URL 指向本地 PostgreSQL
pnpm --filter @handyin/server prisma:push   # 同步数据库结构
pnpm dev                       # 同时启动前后端（前端 5173，后端 3000）
```

前端开发服务器会将 `/handyin/api` 与 `/handyin/ws` 代理到 `localhost:3000`。

## 目录结构

```
apps/
  web/       React + Vite + Tailwind + PWA
  server/    Fastify + Prisma + WebSocket
packages/
  types/      共享类型
  validation/ 学号解析 + Zod schema
prisma/     数据模型
```

## 安全

- 密码使用 Argon2id 哈希，不存明文
- Session 使用 HttpOnly / SameSite Cookie（HTTPS 下启用 Secure）
- 登录接口限流，统一报错避免泄露用户是否存在
- 所有敏感接口在后端校验权限（身份 → 角色 → 作业归属）
- 课代表权限限制到具体作业，可自动过期
- 关键操作（删除记录、指定课代表等）写入审计日志

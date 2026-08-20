# HandyIn 实施计划

## 1. 项目目标

面向单校部署的开源作业收取与统计系统：教师创建班级/作业、学生持唯一二维码、教师/课代表手机扫码登记纸质作业、多人并行扫码、自动统计已交/未交并生成未交名单。第一版采用 Web + PWA + Server，不做原生 App。

## 2. 总体架构（通过服务器 IP 访问）

```text
浏览器 / PWA（手机 + 桌面）
    │  http://服务器IP/handyin/*
    ▼
Caddy（本机监听 80，只服务 HandyIn，不动 GitHub Pages 个人网站）
    │  按路径转发 /handyin/*（不剥离前缀）
    ▼
Fastify（容器内 127.0.0.1:3000）
    ├─ /handyin/api/*    REST API
    ├─ /handyin/ws       WebSocket 实时同步
    ├─ /handyin/*        前端 SPA 静态资源（@fastify/static）
    ▼
PostgreSQL（Docker 容器，volume 持久化）
```

关键点：所有 `/handyin` 前缀统一由 Fastify 内部处理，Caddy 只做按路径转发，保证前端 `base`、react-router `basename`、API prefix、WS 路径四处一致，避免路径剥离造成 404。

## 3. 技术栈

- 前端：React + TypeScript + Vite + Tailwind CSS + shadcn/ui + PWA
- 扫码：getUserMedia + ZXing
- 后端：Node.js + TypeScript + Fastify + WebSocket
- ORM/DB：Prisma + PostgreSQL
- 校验：Zod
- 部署：Docker Compose + Caddy

## 4. 目录结构（monorepo，pnpm workspace）

```text
handyin/
├── apps/
│   ├── web/            # React + Vite 前端
│   └── server/         # Fastify 后端
├── packages/
│   ├── types/          # 共享 TS 类型
│   └── validation/     # 共享 Zod schema / DTO
├── prisma/schema.prisma
├── docs/PLAN.md
├── docker-compose.yml
├── Caddyfile
├── Dockerfile
├── .env.example
└── README.md
```

## 5. 配置（`.env.example` 即配置文档）

| 变量 | 默认 | 说明 |
|---|---|---|
| `HANDYIN_BASE_PATH` | `/handyin` | 子路径，前后端/API/WS 共用 |
| `APP_PORT` | `3000` | Fastify 容器内监听端口 |
| `CADDY_HTTP_PORT` | `80` | Caddy 对外 HTTP 端口 |
| `CADDY_HTTPS_PORT` | `443` | Caddy 对外 HTTPS 端口 |
| `DOMAIN` | 空 | 留空=IP+HTTP；填域名则自动 HTTPS |
| `POSTGRES_HOST` | `postgres` | compose 服务名，可指向外部 PG |
| `POSTGRES_PORT` | `5432` | |
| `POSTGRES_DB` | `handyin` | |
| `POSTGRES_USER` | `handyin` | |
| `POSTGRES_PASSWORD` | （生成） | |
| `DATABASE_URL` | 拼接 | 可覆盖完整连接串 |
| `SESSION_SECRET` | （生成） | Cookie 签名密钥 |
| `COOKIE_SECURE` | `false` | IP/HTTP 下为 false；HTTPS 改 true |
| `LOGIN_RATE_LIMIT` | `5` | 每分钟登录次数上限 |
| `INIT_TEACHER_USERNAME` | `admin` | 首次启动创建的教师账号 |
| `INIT_TEACHER_PASSWORD` | （生成） | |
| `TZ` | `Asia/Shanghai` | |
| `LOG_LEVEL` | `info` | |
| `MAX_UPLOAD_SIZE` | `10mb` | 导入文件上限 |

## 6. 数据模型

- `User`：教师/课代表，`role`、`passwordHash`(Argon2id)
- `Class`：`entryYear`+`department`+`classNumber`，UNIQUE 三者
- `Student`：`studentNumber`(YYYYDDCCNN, UNIQUE)、`qrToken`、解析字段
- `Assignment`：`classId`、`title`、`status`(DRAFT/COLLECTING/FINISHED)
- `Submission`：`(assignmentId, studentId)` UNIQUE 去重
- `AssignmentRep`：课代表授权到具体作业，结束后失效
- `AuditLog`：关键操作审计

## 7. 实施阶段

1. **基础设施**：workspace 脚手架 + Prisma schema（含全部唯一约束）
2. **认证权限**：Argon2id、Session Cookie、登录限流、requireAuth/requireTeacher/requireAssignmentAccess 中间件
3. **班级/学生/学号**：CRUD、学号生成+解析、CSV/XLSX 导入校验、qrToken 二维码生成与批量打印
4. **作业/课代表/扫码**：Assignment CRUD、课代表授权、Submission 去重、WebSocket 广播、已交/未交统计
5. **前端**：登录、班级/学生管理、导入、二维码打印、扫码页（连续扫码）、统计页、PWA + IndexedDB 离线队列
6. **部署**：Dockerfile（多阶段构建）、docker-compose.yml、Caddyfile、`.env.example`、README

## 8. 安全

- 密码 Argon2id 哈希，禁止明文
- Session 用 HttpOnly / Secure / SameSite Cookie，不放 localStorage
- 登录限流 + 统一报错文案（不泄露用户是否存在）
- 所有敏感 API 后端校验：身份 → 角色 → 班级归属 → 作业权限
- Zod 校验所有输入；审计关键操作
- 生产强制 HTTPS；IP/HTTP 阶段 `COOKIE_SECURE=false`，有域名后填 `DOMAIN` 即自动 HTTPS

## 9. 需要用户配合（root 权限）

- 安装 Docker + compose 插件（提供一行命令）
- 首轮启动后确认/修改初始教师账号密码

## 10. 环境现状（已探明）

- Node.js v22 / pnpm 10 / bun 可用
- 无 Docker、无 PostgreSQL（需安装 Docker 并用容器跑 PG）
- 无 nginx/caddy（HandyIn 自带 Caddy，只服务 HandyIn）
- 个人网站 `Lan-Fa.github.io` 由 GitHub Pages 托管，本机不接管
- 本机有 MySQL 8.0，但方案固定 PostgreSQL，不使用 MySQL

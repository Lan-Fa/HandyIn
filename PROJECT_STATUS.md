# HandyIn 项目进度

> 本文件记录**当前项目状态**，每次阶段完成后更新。长期不变的技术约定见 `AGENTS.md`，完整产品策划见 `docs/PROJECT_PLAN.md`。

## 当前状态：第一阶段（MVP）已完成 ✅

第一版 MVP 全部功能已实现、测试通过、并在阿里云服务器部署上线，通过 IP 访问验证通过。

## 已完成清单

### 后端（apps/server）
- 认证：登录/登出/`/auth/me`/修改密码；Argon2id 密码哈希；内存 Session；登录限流（统一报错文案）
- 班级：CRUD，`entryYear+department+classNumber` 唯一，删除时校验有无学生
- 学生：手动添加（自动生成学号）/ CSV·Excel 导入（校验+预览+去重）/ 编辑 / 删除 / 二维码生成与打印
- 作业：CRUD + 状态流转（DRAFT/COLLECTING/FINISHED）+ 已交/未交统计（`stats`）
- 扫码提交：按 `qrToken` 识别，跨班拦截，`(assignmentId, studentId)` 去重，重复返回 `duplicate`
- 课代表：按作业授权（`AssignmentRep`，可过期），授权后可扫码
- 实时：WebSocket（`/handyin/ws`）广播提交/删除，多人同步
- 审计：`AuditLog` 记录删除收取记录、授权/回收课代表等关键操作

### 前端（apps/web）
- 页面：登录、班级、学生（含导入/二维码）、作业列表/详情、扫码页、用户管理
- PWA（vite-plugin-pwa + workbox-window，service worker 注册）
- 扫码：ZXing 连续扫码、音效/震动反馈；离线暂存 IndexedDB 补传（`lib/offline.ts`）

### 测试
- vitest + fastify.inject 集成测试，**27 例全绿**，覆盖认证/权限回归/班级/学生/作业/提交（`apps/server/test/`）

### 部署
- Docker 多阶段构建 + docker-compose（postgres + server + caddy），子路径 `/handyin`，启动自动 `prisma db push` 建表
- 已部署到阿里云服务器（见下）

## 数据库设计（prisma/schema.prisma，已 settle）

| Model | 关键字段与约束 |
|---|---|
| `User` | `username` UNIQUE，`passwordHash`(Argon2id)，`role`（TEACHER/REPRESENTATIVE） |
| `Class` | `@@unique([entryYear, department, classNumber])` |
| `Student` | `studentNumber` UNIQUE（`YYYYDDCCNN`），`qrToken` UNIQUE，`classId` → Class（Cascade） |
| `Assignment` | `classId` → Class，`status`（DRAFT/COLLECTING/FINISHED），`createdById` → User |
| `Submission` | `@@unique([assignmentId, studentId])` 去重，`operatorId` → User |
| `AssignmentRep` | `@@unique([assignmentId, userId])`，`expiresAt` 可空（课代表授权） |
| `AuditLog` | `userId?` → User（SetNull），`action`，`detail` |

- 主键均为 `String @id @default(uuid())`；无 migrations 目录，统一 `prisma db push`。
- 学号规则与二维码见 `AGENTS.md` 第 8 条。

## 服务器 / 部署信息

- 服务器：阿里云 ECS，IP `101.201.244.237`，用户 `ecs-user`（密码登录后建议启用 SSH，本机 ssh 别名 `aliyun` 见 `~/.ssh/config`）。
- 部署路径：`~/HandyIn`（SSH clone 自 GitHub，`git@github.com:Lan-Fa/HandyIn.git`，分支 `main`）。
- 访问：`http://101.201.244.237/handyin/`，初始教师账号 `admin`，密码为用户设置的弱密码（**建议登录后立即修改**；值在服务器 `~/HandyIn/.env` 的 `INIT_TEACHER_PASSWORD`）。
- 环境：服务器宿主机**无 node/pnpm**；Docker（29.7.2 + Compose v5.5.0）已装，`/etc/docker/daemon.json` 已配镜像加速器；`node:22-slim`/`postgres:16-alpine`/`caddy:2-alpine` 基础镜像已拉取。
- 阿里云安全组已放行 80 端口；当前为 HTTP/IP 访问（`COOKIE_SECURE=false`），未启用 HTTPS。

## 第二阶段前置条件（新 session 接续前必读）

1. **代码同步**：本地改 → commit → **用户手动 `git push`**（本环境 push 被权限规则 deny）→ 服务器 `git pull`。不要直接在服务器改 git 跟踪文件。
2. **构建/部署**（服务器）：`ssh aliyun 'cd ~/HandyIn && sudo docker compose up -d --build'`；日志 `docker compose logs -f server`。
3. **跑测试**（服务器容器内）：`ssh aliyun 'cd ~/HandyIn && sudo docker compose -f docker-compose.test.yml up --build --abort-on-container-exit test'`；本地只能 `typecheck`/`build`（无 Docker）。
4. **未决/风险项**（第二阶段可能涉及）：
   - Session 存内存，服务重启即失效（多实例/持久化需改造）。
   - 无 migrations 目录（用 db push，历史结构迁移能力弱）。
   - 尚未启用 HTTPS/域名（当前 IP+HTTP，`COOKIE_SECURE=false`）。
   - 无数据库备份策略、无监控/告警。
   - 初始教师密码为弱密码，需引导修改。
   - 未做前端自动化测试（仅后端集成测试）；未接 CI。
5. **已明确不做**（第一版范围外，见 `docs/PROJECT_PLAN.md` 第 20 节）：多学校/多租户、原生 App、微信小程序、成绩/教务同步等。

## 关键里程碑（git 历史）

- 编码阶段：`d61f4af`（server API）、`0c04a35`（前端）、`f7d25f6`（部署）、`1f0ed76`（PWA）
- 部署修复：`c7369fa`（npm 镜像）、`e144b2d`（Prisma binaryTargets）、`b1b20cc`（同步 hook 挂起修复）、`77622e3`（自动建表）
- 测试体系：`9e628d2` + `5e1dd5e`（vitest 27 例）

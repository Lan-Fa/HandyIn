# HandyIn 项目说明（Agent 长期参考）

面向单校部署的开源作业收取系统（Web + PWA + Server，无原生 App）。教师建班/建作业，学生持唯一二维码，教师/课代表手机扫码登记纸质作业，WebSocket 实时统计已交/未交。

## 常用命令

所有命令在仓库根目录运行。

```bash
pnpm install                                    # 安装依赖（workspace）
pnpm dev                                        # 本地开发：前端 5173 + 后端 3000
pnpm build                                      # 全量构建
pnpm typecheck                                  # 全量类型检查
pnpm lint                                       # lint（当前为占位 echo）
pnpm --filter @handyin/server prisma:generate   # 生成 Prisma Client
pnpm --filter @handyin/server prisma:push       # 同步数据库结构（dev 用 db push，无 migrations）
pnpm --filter @handyin/server test              # 跑测试（见下方说明）
```

### 测试

- 框架：vitest + fastify.inject（无需起端口），测试文件在 `apps/server/test/`。
- **本地无 Docker，集成测试依赖 PostgreSQL，只能在服务器容器内跑**；本地只能 `typecheck` / `build`。
- 服务器跑测试：

```bash
ssh aliyun 'cd ~/HandyIn && sudo docker compose -f docker-compose.test.yml up --build --abort-on-container-exit test'
```

## 技术栈与目录结构

- 包管理：pnpm workspace（monorepo）。根 `package.json` 定义了 `@prisma/client`、`prisma` 为根 devDependencies。
- `apps/web`：React 19 + Vite 6 + TypeScript + Tailwind CSS 4 + PWA（vite-plugin-pwa）+ react-router-dom 7 + ZXing（扫码）+ qrcode.react
- `apps/server`：Fastify 5 + Prisma 6 + TypeScript（ESM）+ @node-rs/argon2 + Zod + @fastify/*（cookie/cors/multipart/rate-limit/static/websocket）
- `packages/types`：共享 TS 类型与常量（`DEPARTMENT_CODES`、`ROLES`、DTO）
- `packages/validation`：Zod schema 与学号解析（`parseStudentNumber` / `buildStudentNumber`）
- `prisma/schema.prisma`：数据模型（见 PROJECT_STATUS.md）

后端 `apps/server/src` 结构：`index.ts`（组装 App，导出 `buildApp(config)`）、`config.ts`（`loadConfig`）、`prisma.ts`（全局单例）、`seed.ts`（初始教师）、`errors.ts`、`plugins/`（auth、static）、`routes/`（auth/users/classes/students/assignments/submissions/reps/ws）、`lib/`（session/password/qrcode/import/stats/realtime/permissions）。

## 关键约定与已踩坑（务必遵守）

1. **子路径部署**：整站走 `/handyin` 前缀，Caddy 只按路径转发、**不剥离前缀**。四处必须一致：Vite `base`（`vite.config.ts`）、react-router `basename`（`App.tsx`）、API prefix（`index.ts` 的 `apiPrefix`）、API_BASE（`web/src/lib/api.ts`）。改 `HANDYIN_BASE_PATH`（`.env`）全站生效。

2. **Fastify 5 的 hook 必须是 async 或调用 done 回调**。同步 preHandler 在正常路径（不 throw）返回 undefined 会导致请求**永久挂起**（不报错、无响应）。本项目 `requireAuth`/`requireTeacher`/`requireCollector`/`requireAssignmentCollector` 均已改为 `async`。新增权限 hook 时必须用 `async`。

3. **Prisma binaryTargets 必须显式声明**：`prisma/schema.prisma` 里 `binaryTargets = ["native", "debian-openssl-3.0.x"]`。原因：`node:22-slim` 构建阶段未装 libssl，Prisma 的 `native` 检测会 fallback 到 `debian-openssl-1.1.x`，与运行阶段（装了 openssl/libssl3）不匹配，导致 query engine 找不到。

4. **国内 npm 镜像**：Dockerfile 内 `ARG NPM_REGISTRY=https://registry.npmmirror.com` + `ENV npm_config_registry`，`docker-compose.yml` 通过 `${NPM_REGISTRY}` 传入。不要在 Dockerfile 里写死 registry.npmjs.org。

5. **自动建表**：`Dockerfile` 运行阶段 CMD 为 `sh -c "node_modules/.bin/prisma db push --schema prisma/schema.prisma --skip-generate && node apps/server/dist/index.js"`。项目无 migrations 目录，统一用 `prisma db push`，启动时幂等自检。

6. **Session 存内存 Map**（`lib/session.ts`），不进数据库；服务重启即失效。若需多实例/持久化需改造。

7. **密码用 Argon2id**（`@node-rs/argon2`），参数见 `lib/password.ts`；不存明文。

8. **学号规则**：`YYYYDDCCNN`（入学年 4 位 + 学部 2 位 + 班级 2 位 + 班内学号 2 位），学部码 `01=高中部 02=初中部 03=小学部`。学生 `studentNumber` 全局 UNIQUE。学生二维码存随机 `qrToken`（`handyin://student/<hex>`），不直接用学号。

9. **权限分层**：身份（登录）→ 角色（ADMIN/TEACHER/REPRESENTATIVE）→ 班级归属（`assertClassMember`）→ 作业归属（`requireAssignmentCollector`）。`requireTeacher` 放宽为「TEACHER 或 ADMIN」；`requireAdmin` 仅管理员（用户管理、班级建/改/删/批量）。教师需先加入班级（`TeacherClass`）才能操作该班学生/作业；课代表按作业授权（`AssignmentRep`），可过期。

10. **错误处理**：`errors.ts` 的 `AppError`，Fastify `setErrorHandler` 统一转 JSON。登录失败统一文案，不泄露用户是否存在。

## 部署（服务器）

- Docker Compose（`docker-compose.yml`）：`postgres`（16-alpine，volume `pgdata`）+ `server`（多阶段构建镜像）+ `caddy`（2-alpine，映射 80/443）。
- 配置：`.env`（从 `.env.example` 复制，必填 `POSTGRES_PASSWORD`、`SESSION_SECRET`、`INIT_ADMIN_PASSWORD`）。
- 启动：`docker compose up -d --build`；查看：`docker compose logs -f server`。
- 服务器信息、访问方式见 PROJECT_STATUS.md。

## Git 工作流

- 仓库：`git@github.com:Lan-Fa/HandyIn.git`，分支 `main`。
- **本环境 `git push` 被权限规则 deny，需用户手动 `git push origin main`**；push 前先完成 commit。
- 服务器通过 SSH clone（`~/HandyIn`），日常新增改动以「本地 commit → 用户 push → 服务器 `git pull` + `docker compose up -d --build`」同步。不要直接在服务器改 git 跟踪文件（会造成 pull 冲突）。
- commit 风格：Conventional Commits，如 `fix(server): ...`、`feat(deploy): ...`、`test(server): ...`。
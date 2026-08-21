# 教师/课代表班级归属与作业管理 — 实施计划书

> 状态跟踪文档：每完成一个阶段即勾选并更新进度，随后单独 commit。
> 目标：教师可退出班级、重新开启/删除作业、切换当前班级；课代表拥有「所属班级」并按班级授权。

## 需求确认（已与用户对齐）

1. 教师可选择退出班级（列表页每行提供「退出班级」按钮）。
2. 作业结束后可再次开启（FINISHED → COLLECTING，已交记录保留、未交可继续补交）。
3. 教师可删除自己发布的作业（列表页 + 详情页入口，均带确认）。
4. 教师「切换班级」：当前班级醒目（侧边栏下拉），作业列表按当前班级过滤，新建作业默认当前班，学生页联动。
   - 当前班级存前端 localStorage（键 `handyin_current_class_<userId>`），不改后端。
5. 课代表也拥有「所属班级」：
   - 一个课代表可属于**多个班**（多对多）。
   - 由**管理员和教师**设定。
   - 班级归属**直接授权整个班**（取消按作业授权 `AssignmentRep`，`expiresAt` 一并移除）。
   - 管理员不需要班级归属。

---

## 批次划分

- **第一批（commit 1）**：功能 1–4（教师侧，主要前端）+ 对应后端测试。
- **第二批（commit 2）**：功能 5（课代表班级归属，破坏性，涉及 schema/后端/前端/测试重写）。

---

## 第一批：教师侧功能

### 一、前端

- [x] `apps/web/src/pages/Classes.tsx`
  - 新增 `leaveTarget` + `handleLeave`（`DELETE /classes/:id/join`）
  - 教师视图班级列表每行加「退出班级」按钮（`ConfirmDialog`）
- [x] `apps/web/src/pages/AssignmentDetail.tsx`
  - `FINISHED && isTeacher` 时加「重新开启」按钮 → `setStatus('COLLECTING')`
  - 顶部加「删除作业」按钮（独立 `deleteAssignmentTarget` 状态），成功后 `navigate('/assignments')`
- [x] `apps/web/src/pages/Assignments.tsx`
  - `useAuth`，`TEACHER`/`ADMIN` 显示删除按钮（`e.stopPropagation()`）+ `ConfirmDialog`
- [x] 新建 `apps/web/src/lib/current-class.tsx`
  - `CurrentClassProvider` + `useCurrentClass()`；localStorage 持久化
- [x] `apps/web/src/App.tsx`：`<AuthProvider>` 内包 `<CurrentClassProvider>`
- [x] `apps/web/src/components/Layout.tsx`：教师侧边栏加「当前班级」`Select`
- [x] `apps/web/src/pages/Assignments.tsx`：按 `currentClassId` 过滤（仅教师）、新建默认当前班、页头显示班名
- [x] `apps/web/src/pages/Students.tsx`：班级下拉联动 `currentClassId`
- [x] `apps/web/src/pages/Classes.tsx`：退出班级后调 `refreshClasses()` 同步侧边栏

### 二、后端测试

- [x] `apps/server/test/assignments.test.ts`：重新开启、教师删除自己作业
- [x] `apps/server/test/assignment-ownership.test.ts`：非布置者教师删除他人作业 403

### 三、验证

- [x] `pnpm typecheck` / `pnpm build` 本地全绿
- [ ] 服务器容器内跑集成测试（待 push 后执行）

---

## 第二批：课代表班级归属

### 四、Schema 与共享类型

- [x] `prisma/schema.prisma`
  - 新增 `RepClass`（`userId`+`classId` 唯一，双向 `onDelete: Cascade`）
  - `User.repClasses` / `Class.repClasses` 反向关系
  - 删除 `AssignmentRep`、`User.repGrants`、`Assignment.reps`
- [x] `packages/validation/src/index.ts`
  - 删 `repGrantSchema`；新增 `repClassAssignSchema = { userId: z.string().uuid() }`

### 五、后端

- [x] `apps/server/src/lib/permissions.ts`：`requireAssignmentCollector` REP 分支改查 `RepClass`
- [x] `apps/server/src/routes/ws.ts`：`authorize` REP 分支改查 `RepClass`
- [x] `apps/server/src/routes/assignments.ts`：`GET /assignments` REP 分支返回所属班所有作业
- [x] `apps/server/src/routes/classes.ts`：`GET /classes` 放宽 `requireAuth`，新增 REP 分支（返回 `RepClass` 班级）
- [x] `apps/server/src/routes/reps.ts` 重写：`GET/POST/DELETE /classes/:id/reps[/:userId]`
- [x] `apps/server/src/routes/users.ts`：`GET /users/representatives` 保留

### 六、前端

- [x] `apps/web/src/components/Layout.tsx`：课代表也显示「当前班级」下拉
- [x] `apps/web/src/pages/Assignments.tsx`：课代表按 `currentClassId` 过滤、隐藏新建按钮
- [x] `apps/web/src/pages/AssignmentDetail.tsx`：移除「课代表授权」整块
- [x] `apps/web/src/pages/Classes.tsx`：每行加「课代表」按钮 → 弹窗分配/移除
- [x] `apps/web/src/pages/Users.tsx`：新建 `REPRESENTATIVE` 可选所属班级

### 七、测试

- [x] `apps/server/test/reps.test.ts` 重写为班级归属语义
- [x] `apps/server/test/submissions.test.ts`：课代表所属班扫码成功、跨班 403
- [x] `apps/server/test/setup.ts` / `helpers.ts`：`resetData` 改 `repClass.deleteMany()`

### 八、验证

- [x] `pnpm typecheck` / `pnpm build` 本地全绿（含 `prisma validate`）
- [ ] 服务器容器内跑集成测试（待 push 后执行）

---

## 进度记录

| 批次 | 阶段 | 状态 | commit |
|---|---|---|---|
| 计划书 | — | 已完成 | — |
| 一 | 前端 1–4 | 已完成 | `d2122a8` |
| 一 | 测试 | 已完成 | `d2122a8` |
| 一 | 验证 + commit | 本地通过 | `d2122a8` |
| 二 | 功能 5 | 已完成 | `75a74c6` |

# 管理员角色 & 教师自助加入班级 — 实施计划书

> 状态跟踪文档：每完成一个阶段即勾选并更新进度，随后单独 commit。
> 目标：新增「管理员（ADMIN）」登录角色；班级创建收归管理员；教师自助加入班级并仅能操作已加入班级。

## 需求确认（已与用户对齐）

1. 三种登录角色之外的「学生」仍是 `Student` 实体（不登录）；本次仅给 `User` 增加 `ADMIN` 角色。
2. 管理员（ADMIN）：可新增教师/课代表/管理员账号、新增学生、新增班级（含批量）。
3. 教师（TEACHER）：只能新增学生、创建作业、授予课代表；**不能建班**。
4. 教师**自助加入**班级（无需审批），一个教师可加入多个班级。
5. 教师的班级列表**只显示已加入班级**；另需「加入班级」入口浏览全部班级。
6. 教师只能操作已加入班级的学生/作业；文件导入学生时**跳过未加入班级**的行。
7. 班级可**批量添加**：`entryYear + department + count`（从 1 班起，`startFrom` 可配），已存在则跳过不覆盖。
8. 初始账号 `INIT_TEACHER_*` 改名为 `INIT_ADMIN_*`，seed 创建 `ADMIN` 并幂等提升已存在的 `admin` 用户。

---

## 阶段一：数据模型与共享类型

- [ ] `prisma/schema.prisma`
  - `Role` enum 增加 `ADMIN`
  - 新增 `TeacherClass`（`teacherId`+`classId` 唯一，双向 `onDelete: Cascade`）
  - `User.teacherClasses` / `Class.teacherClasses` 反向关系
- [ ] `packages/types/src/index.ts`
  - `ROLES` 增加 `'ADMIN'`
  - `ImportIssueReason` 增加 `'not_joined_class'`
  - 新增「可加入班级」视图类型（`ClassDto & { joined?: boolean }`）
- [ ] `packages/validation/src/index.ts`
  - `roleSchema` 增加 `'ADMIN'`
  - 新增 `classBatchCreateSchema`（entryYear/department/count/startFrom?）
  - 新增班级加入/退出使用的 `classId` 参数校验（复用 idParamSchema）

## 阶段二：后端权限层（保留 `requireTeacher` 原名，放宽含 ADMIN）

- [x] `apps/server/src/plugins/auth.ts`
  - 新增 `requireAdmin`（仅 ADMIN）
  - `requireTeacher` 放宽为「TEACHER 或 ADMIN」
- [x] `apps/server/src/lib/permissions.ts`
  - `requireAssignmentCollector`：ADMIN 放行；TEACHER 校验班级成员；REPRESENTATIVE 走授权
  - 新增 `assertClassMember(request, classId)`

## 阶段三：后端路由

- [x] `routes/users.ts` → `requireAdmin`
- [x] `routes/classes.ts`
  - `GET /classes`：教师只返回已加入；管理员返回全部
  - `GET /classes/available`：全部班级 + `joined` 标记（教师浏览用）
  - `POST /classes/batch`：管理员批量建班，跳过已存在
  - `POST /classes/:id/join`、`DELETE /classes/:id/join`：教师自助加入/退出
  - 单个建/改/删 → `requireAdmin`
  - 静态路由 (`available`/`batch`) 注册在 `:id` 之前
- [x] `routes/students.ts` → `requireTeacher` + 成员校验；导入跳过未加入班级
- [x] `routes/assignments.ts` → 教师只操作已加入班级；列表按角色过滤
- [x] `routes/reps.ts` → `requireTeacher` + 成员校验
- [x] `routes/submissions.ts` → 删除走成员校验
- [x] `routes/ws.ts` → ADMIN 放行；TEACHER 加成员校验

## 阶段四：初始账号与环境变量

- [x] `config.ts`：`initTeacher*` → `initAdmin*`
- [x] `seed.ts`：创建 `ADMIN`，幂等提升已存在用户为 ADMIN
- [x] 同步 `.env.example`、`docker-compose.yml`、`README.md`、`AGENTS.md`、`PROJECT_STATUS.md`、`docs/PLAN.md` 中的 env 引用

## 阶段五：前端

- [x] `Layout.tsx`：按角色渲染导航/角色文案（管理员/教师/课代表）
- [x] `App.tsx`：新增 `RequireRole` 路由守卫
- [x] `Users.tsx`：角色下拉增加「管理员」+ badge 配色
- [x] `Classes.tsx`：管理员（单个+批量建班+删除）/ 教师（已加入列表 + 加入班级对话框）两套 UI
- [x] `Students.tsx` / `Assignments.tsx`：班级下拉随 `/classes` 角色过滤自动收紧

## 阶段六：测试

- [x] `helpers.ts`：admin/teacher/rep 三角色 seed；`adminCookie()`；`createClassAndJoinTeacher()`；`resetData` 增 `teacherClass.deleteMany()`
- [x] 存量用例适配权限收紧（auth/classes/students/assignments/submissions）
- [x] 新增：管理员用户管理（`users.test.ts`）、批量建班跳过已存在、教师 join/leave、越权 403、教师仅操作已加入班级

## 收尾

- [x] `pnpm typecheck` / `pnpm build` 全绿（本地验证）
- [x] 服务器容器内跑集成测试（`docker compose -f docker-compose.test.yml ...`）——103 例全绿
- [x] 后续追加：教师仅能操作自己布置的作业（`assertAssignmentOwner`）、课代表候选接口 `GET /users/representatives`、班级部门名称展示（`d9d0aea` + `a75f223`），代码已重新部署到服务器

---

## 进度记录

| 阶段 | 状态 | commit |
|---|---|---|
| 计划书 | 已完成 | `1e0b031` |
| 一 | 已完成 | `cc42dde` |
| 二 | 已完成 | `eebb327` |
| 三 | 已完成 | `397aa16` |
| 四 | 已完成 | `397aa16` |
| 五 | 已完成 | `6ad8c6d` |
| 六 | 已完成 | `021c667` / `90d3b44` / `aac0363` |
| 收尾 | 已完成 | 本地通过 + 服务器测试全绿 |
| 追加·作业归属 | 已完成 | `d9d0aea` / `a75f223` |
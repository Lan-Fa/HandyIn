# 手动标记学生已交 & 新建用户确认密码 — 实施计划书

> 状态跟踪文档：每完成一个阶段即勾选并更新进度，随后单独 commit。
> 目标：新增独立于扫码的「手动选人标记已交」；新建用户增加「确认密码」输入。

## 需求确认（已与用户对齐）

1. 为防止二维码不清晰，提供**独立于扫码之外**的手动操作：直接从「未交列表」选择学生标记为已交，管理员/教师/课代表均可用。
2. 手动选择入口**只放在未交列表**（AssignmentDetail 未交 tab），不在扫码页。
3. 新建用户时增加「再次输入密码」避免误触。
4. 本次改动一个 commit 交付。

---

## 阶段一：后端

- [x] `packages/validation/src/index.ts`：新增 `submissionManualSchema = { assignmentId, studentId }`
- [x] `apps/server/src/routes/submissions.ts`
  - 抽取 `recordSubmission(assignmentId, student, operatorId)`（去重 → 创建 → 广播 → 统计）
  - `POST /submissions` 改为调用 helper（响应结构不变）
  - 新增 `POST /submissions/manual`（`requireAssignmentCollector`），校验班级归属，写审计 `MANUAL_SUBMIT`

## 阶段二：前端

- [x] `apps/web/src/pages/AssignmentDetail.tsx`：未交列表每行加「标记已交」按钮
- [x] `apps/web/src/pages/Users.tsx`：新建用户加「确认密码」输入 + 一致性校验

## 阶段三：测试

- [x] `apps/server/test/submissions.test.ts`：手动标记 submitted/duplicate、课代表跨班 403、非成员教师 403、学生不属于本班 400、学生不存在 404

## 阶段四：验证

- [x] `pnpm typecheck` / `pnpm build` / `pnpm --filter @handyin/server test:unit` 本地全绿
- [ ] 服务器容器内跑集成测试（待 push 后执行）

---

## 进度记录

| 阶段 | 状态 | commit |
|---|---|---|
| 计划书 | 已完成 | — |
| 一 后端 | 已完成 | — |
| 二 前端 | 已完成 | — |
| 三 测试 | 已完成 | — |
| 四 验证 | 本地通过；待 commit | — |

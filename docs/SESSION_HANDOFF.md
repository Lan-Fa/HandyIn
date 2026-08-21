# 会话交接：登录「网络连接失败」排查（进行中）

> 本文件记录最近一次会话的完成内容与未决事项，供下一个 session 接续。长期约定见 `AGENTS.md`，整体状态见 `PROJECT_STATUS.md`。

## 最近完成的工作（均已 commit 并部署）

- `d9d0aea` feat(server)：教师仅能操作自己布置的作业（`assertAssignmentOwner`，校验 `createdById` + 班级成员）；`GET /users/representatives` 课代表候选接口；班级下拉部门名称展示（`DEPARTMENT_LABELS`）。
- `a75f223` test(server)：新增作业归属越权测试 + 课代表候选列表测试。
- 服务器已 `git pull` 最新代码并 `docker compose up -d --build`（容器约 13 分钟前重建，`caddy`/`postgres`/`server` 三容器均 `Up`）。

## 当前未决：登录「网络连接失败」

### 现象
- 用户在浏览器访问 `http://localhost:8080/handyin/login`，登录页能打开，但点击登录报「网络连接失败」。
- 该文案来自 `apps/web/src/lib/api.ts` 的 `fetch` 抛异常（连接拒绝/超时/网络错误），**不是**服务器返回的 HTTP 错误码。

### 已排查结论（服务器端正常）
| 请求 | 结果 |
|---|---|
| `curl http://101.201.244.237:8080/handyin/` | `200` |
| `POST /handyin/api/auth/login`（错误密码） | `401`，78ms |
| `POST /handyin/api/auth/login`（正确密码） | `200`，50ms |

- 服务器 caddy 监听 `0.0.0.0:8080->80`、`0.0.0.0:8443->443`；`80` 端口无监听（外部访问 `80` 返回 `502`），属预期。
- 结论：问题在用户本地 `localhost:8080` → 服务器的转发链路，而非服务器本身。

### 待用户澄清（阻塞点）
1. `localhost:8080` 是如何映射到服务器的？—— SSH 端口转发（如 `ssh -L 8080:localhost:8080 aliyun`）？本地反向代理？还是本地 docker？
2. 该转发/代理当前是否仍在运行？（隧道断开会导致缓存页面可显示、API 请求连接拒绝，正符合此症状。）

### 建议的下一步验证
1. 让用户直接访问 `http://101.201.244.237:8080/handyin/login`（跳过 localhost）试登录；若能登录即 100% 确认是 localhost 转发链路问题。
2. 让用户在 `localhost:8080` 页面按 `Ctrl+Shift+R` 强制刷新，排除 service worker/浏览器缓存干扰。
3. 根据用户答复的映射方式，给出精确修复（如重建 SSH 隧道、修正代理配置、或改用直连 IP）。

## 其他待办（第二阶段遗留，见 `PROJECT_STATUS.md`）

- `a75f223` 新增的作业归属/课代表候选测试尚未在服务器容器内重跑（`handyin-test` 镜像为一小时前构建）。跑法见 `AGENTS.md`：`ssh aliyun 'cd ~/HandyIn && sudo docker compose -f docker-compose.test.yml up --build --abort-on-container-exit test'`。
- 长期未决项：Session 内存态、无 migrations、未启用 HTTPS/域名、无数据库备份/监控、前端无自动化测试、未接 CI。

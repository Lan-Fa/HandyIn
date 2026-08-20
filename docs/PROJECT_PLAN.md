# HandyIn 项目简要策划方案

## 1. 项目目标

HandyIn 是一个面向**单个学校部署**的开源作业收取与统计系统。

核心用途：

* 教师创建班级和作业；
* 学生拥有唯一二维码；
* 教师或课代表通过手机扫码登记纸质作业；
* 多人可同时扫码；
* 系统自动统计已交、未交人数；
* 自动生成未交名单；
* 支持 Android、iPhone 和电脑浏览器使用。

第一版采用：

```text
Web + PWA + Server
```

不开发原生 Android / iOS App。

---

# 2. 技术栈

## 前端

```text
React
TypeScript
Vite
Tailwind CSS
shadcn/ui
```

支持：

* 手机浏览器；
* 桌面浏览器；
* PWA；
* 响应式布局。

扫码：

```text
getUserMedia
+
ZXing / 其他可靠 QR 解码库
```

---

## 后端

推荐：

```text
Node.js
TypeScript
Fastify
```

提供：

```text
REST API
WebSocket
```

REST API 负责普通数据操作。

WebSocket 负责：

* 作业收取进度实时同步；
* 多课代表扫码状态同步；
* 新增收取记录实时广播。

---

## 数据库

固定使用：

```text
PostgreSQL
```

ORM 推荐：

```text
Prisma
```

部署：

```text
Docker Compose
```

整体：

```text
Browser / PWA
      │
   HTTPS/WSS
      │
 Caddy / Nginx
      │
   Fastify
      │
    Prisma
      │
 PostgreSQL
```

---

# 3. 部署范围

HandyIn 只考虑：

> **单个学校独立部署。**

不需要：

* 多租户；
* 多学校；
* school_id；
* 学校之间的数据隔离；
* SaaS 多学校管理。

一个 HandyIn 实例对应一个学校。

---

# 4. 用户角色

系统主要包含：

```text
Teacher
Representative
Student
```

## Teacher

教师拥有正式账号。

权限包括：

* 登录系统；
* 管理班级；
* 管理学生；
* 创建作业；
* 指定课代表；
* 扫码收取；
* 查看实时进度；
* 查看已交/未交名单；
* 修改错误记录；
* 查看历史作业。

---

## Representative

课代表主要负责协助收作业。

权限应限制在指定范围内，例如：

* 查看被授权的班级；
* 查看被授权的作业；
* 扫描学生二维码；
* 新增收取记录；
* 查看当前收取进度。

默认不允许：

* 创建教师账号；
* 删除班级；
* 删除学生；
* 修改其他教师信息；
* 修改系统配置。

---

## Student

第一版中学生**不需要注册账号**。

学生主要作为数据库中的实体存在，包括：

```text
姓名
学号
班级
唯一 ID
二维码
```

---

# 5. 学号规则

学号固定为：

```text
YYYYDDCCNN
```

即：

```text
入学年份 + 学部 + 班级 + 班内学号
```

其中：

```text
YYYY = 入学年份

DD = 学部
01 = 高中部
02 = 初中部
03 = 小学部

CC = 班级，两位

NN = 班内学号，两位
```

例如：

```text
2021010212
```

表示：

```text
2021级
高中部
2班
12号
```

拆分：

```text
2021 | 01 | 02 | 12
```

系统应能够根据完整学号自动解析：

```text
entryYear
department
classNumber
studentNumberInClass
```

---

# 6. 学生数据结构

建议：

```text
Student

id
name
studentNumber
entryYear
department
classNumber
numberInClass
qrToken
createdAt
updatedAt
```

其中：

```text
id
```

使用 UUID。

例如：

```text
550e8400-e29b-41d4-a716-446655440000
```

`studentNumber` 为：

```text
2021010212
```

数据库中：

```text
studentNumber UNIQUE
```

因为系统只服务一个学校，不需要与 `school_id` 组成联合唯一键。

---

# 7. 学生导入

学生支持两种添加方式。

## 方式一：文件导入

支持：

```text
Excel (.xlsx)
CSV
```

推荐最简单的格式：

```text
学号,姓名
2021010201,张三
2021010202,李四
2021010203,王五
```

系统根据学号自动解析：

```text
入学年份
学部
班级
班内学号
```

导入前应进行校验，并展示：

```text
有效数据
重复学号
非法学号
缺失姓名
```

确认后再写入数据库。

---

## 方式二：手动添加

教师填写：

```text
姓名
入学年份
学部
班级
班内学号
```

例如：

```text
姓名：张三
入学年份：2021
学部：高中部
班级：2
班内学号：12
```

系统自动生成：

```text
2021010212
```

也可以允许直接输入：

```text
2021010212
```

系统自动解析后让教师确认。

---

# 8. 班级

班级由：

```text
入学年份
+
学部
+
班级编号
```

唯一确定。

例如：

```text
2021级高中部2班
```

建议数据结构：

```text
Class

id
entryYear
department
classNumber
```

约束：

```text
UNIQUE (
    entryYear,
    department,
    classNumber
)
```

---

# 9. 学生二维码

每个学生拥有一个长期有效的二维码。

二维码可打印并贴在：

* 作业本；
* 练习册；
* 实验报告册。

二维码外部可以显示：

```text
张三
2021010212
2021级高中部2班 · 12号
```

二维码内部**不要直接使用学号作为唯一凭证**。

建议存放：

```text
随机生成的 qrToken
```

例如：

```text
handyin://student/a8d29f7c...
```

服务器根据 Token 查找学生。

这样用户不能仅通过修改学号字符串轻易伪造其他学生二维码。

---

# 10. 作业

教师可以为一个班级创建作业。

建议：

```text
Assignment

id
classId
title
description
createdBy
createdAt
status
```

状态：

```text
DRAFT
COLLECTING
FINISHED
```

例如：

```text
2021级高中部2班

数学
第7次作业

状态：
COLLECTING
```

---

# 11. 收作业流程

教师：

```text
创建作业
   ↓
开始收取
   ↓
指定课代表
```

课代表打开：

```text
数学 · 第7次作业

已收：27 / 48

[ 开始扫描 ]
```

扫描一本：

```text
12号 张三

✓ 收取成功

28 / 48
```

然后自动继续扫描下一本。

---

# 12. 收取记录

建议：

```text
Submission

id
assignmentId
studentId
operatorId
submittedAt
```

必须设置：

```text
UNIQUE (
    assignmentId,
    studentId
)
```

确保同一份作业中同一个学生只能有一条有效收取记录。

重复扫描时：

```text
⚠ 已经收取

张三
12号

收取时间：20:13:21
操作人：李四
```

---

# 13. 多人同时扫码

多个课代表可以同时工作：

```text
               Server
                 │
       ┌─────────┼─────────┐
       │         │         │
       ▼         ▼         ▼
   课代表 A   课代表 B   课代表 C
```

一次扫描流程：

```text
扫描二维码
    ↓
POST Submission
    ↓
PostgreSQL
    ↓
WebSocket Broadcast
    ↓
所有客户端刷新进度
```

例如：

```text
37 / 48
   ↓
38 / 48
```

---

# 14. 快速扫码模式

扫码效率需要优先考虑。

正常流程必须尽量做到：

```text
扫码
 ↓
识别
 ↓
自动提交
 ↓
成功提示音 / 震动
 ↓
立即继续扫描
```

不要设计成：

```text
扫码
↓
确认
↓
提交
↓
继续
↓
重新打开摄像头
```

成功：

```text
✓ 12号 张三
```

重复：

```text
⚠ 12号 张三 已收
```

失败：

```text
✗ 无法识别二维码
```

---

# 15. 实时统计

教师端实时显示：

```text
数学 · 第7次作业

2021级高中部2班

已交：45 / 48
未交：3
```

支持：

```text
全部
已交
未交
```

未交列表按照班内学号排序：

```text
03号 张三
17号 李四
42号 王五
```

---

# 16. 安全要求

系统虽然是校内工具，但必须保证基本安全性，尤其要防止攻击者获得教师权限。

## 16.1 密码

禁止数据库保存明文密码。

必须使用：

```text
Argon2id
```

或可靠的密码哈希算法。

数据库只存：

```text
passwordHash
```

---

## 16.2 登录

教师登录：

```text
username / email
+
password
```

登录接口必须：

* 限制连续失败次数；
* 防止暴力破解；
* 做 Rate Limit；
* 返回统一错误信息，避免泄露用户是否存在。

例如不要区分：

```text
用户名不存在
密码错误
```

统一返回：

```text
用户名或密码错误
```

---

## 16.3 Session

推荐使用：

```text
HttpOnly
Secure
SameSite
Cookie
```

保存登录 Session。

不要把教师长期登录 Token 放在：

```text
localStorage
```

以降低 XSS 导致凭证直接被窃取的风险。

---

## 16.4 HTTPS

生产环境必须强制：

```text
HTTPS
WSS
```

HTTP 自动跳转 HTTPS。

不得允许密码通过 HTTP 传输。

---

## 16.5 权限验证

所有敏感 API 都必须在**后端**验证权限。

绝不能只依赖前端：

```text
if (user.role === "teacher")
```

后端必须验证：

```text
当前用户是谁
↓
角色是什么
↓
是否拥有这个班级
↓
是否有权操作这个作业
```

---

## 16.6 教师高风险操作

以下操作必须仅教师允许：

```text
删除学生
删除班级
删除作业
修改其他用户权限
指定课代表
查看完整历史记录
修改系统配置
```

---

## 16.7 课代表权限

课代表权限应该是临时且有限的。

例如授权：

```text
用户 A
只能操作
Assignment #123
```

而不是直接给：

```text
ADMIN
```

作业结束后可以自动失效。

---

## 16.8 CSRF / XSS / SQL Injection

需要防御常见 Web 攻击：

```text
CSRF
XSS
SQL Injection
暴力登录
越权访问
```

ORM 不代表可以忽略权限验证。

所有输入需要校验。

推荐统一使用 Schema：

```text
Zod
```

或 Fastify Schema。

---

## 16.9 审计记录

涉及重要数据修改时应留下简单日志，例如：

```text
谁
在什么时间
进行了什么操作
```

尤其是：

```text
删除收取记录
修改收取记录
删除学生
指定课代表
```

---

# 17. 离线扫码

可以支持基本 Local First。

扫描成功后：

```text
二维码
 ↓
IndexedDB
 ↓
尝试上传
```

网络正常：

```text
✓ 已记录
✓ 已同步
```

网络异常：

```text
✓ 已记录
⏳ 等待同步
```

恢复网络：

```text
Pending Queue
 ↓
重新提交
 ↓
服务器去重
 ↓
同步完成
```

服务器始终是最终数据源。

---

# 18. 推荐项目结构

```text
handyin/
│
├── apps/
│   ├── web/
│   └── server/
│
├── packages/
│   ├── types/
│   ├── validation/
│   └── ui/
│
├── prisma/
│   └── schema.prisma
│
├── docker-compose.yml
├── README.md
└── LICENSE
```

前后端共享：

```text
TypeScript Types
Validation Schema
API DTO
```

---

# 19. 第一版 MVP

第一版完成以下功能即可。

## 账号

* 教师账号；
* 登录；
* 登出；
* Session；
* 密码安全存储；
* 登录 Rate Limit。

## 班级

* 创建班级；
* 修改班级；
* 查看学生列表。

## 学生

* 手动添加；
* Excel / CSV 导入；
* 编辑；
* 删除；
* 学号自动生成；
* 学号自动解析；
* 二维码生成；
* 二维码批量导出/打印。

## 作业

* 创建；
* 开始收取；
* 结束收取；
* 查看历史。

## 课代表

* 教师指定；
* 限制到特定作业；
* 可以扫码收作业。

## 扫描

* 手机摄像头扫码；
* 连续扫描；
* 自动提交；
* 重复检测；
* 成功 / 失败提示。

## 实时同步

* WebSocket；
* 多人同时扫码；
* 实时更新数量。

## 统计

* 总人数；
* 已交；
* 未交；
* 已交名单；
* 未交名单；
* 操作人；
* 收取时间。

---

# 20. 第一版不做

暂时不实现：

```text
多学校
多租户
原生 Android
原生 iOS
Electron
蓝牙
Wi-Fi P2P
手机热点
微信小程序
AI 功能
成绩管理
教务系统同步
复杂通知系统
```

优先保证：

> **扫码快、统计准、多人同时使用稳定、教师账号安全。**

---

# 21. Agent 开发优先级

建议 Agent 按以下顺序开发：

```text
1. PostgreSQL + Prisma 数据模型

2. Teacher 登录 / Session / 权限系统

3. Class CRUD

4. Student CRUD

5. 学号生成与解析

6. CSV / Excel 导入

7. 学生二维码生成

8. Assignment CRUD

9. Representative 权限

10. 手机二维码扫描

11. Submission API + 数据库唯一约束

12. WebSocket 实时同步

13. 已交 / 未交统计

14. 连续扫码体验优化

15. IndexedDB 离线队列

16. PWA

17. Docker Compose 部署

18. 安全检查与测试
```

---

# 22. 核心目标

第一版最重要的完整流程：

```text
教师登录
   ↓
创建班级
   ↓
文件导入 / 手动添加学生
   ↓
生成学生二维码
   ↓
创建作业
   ↓
指定课代表
   ↓
多人同时扫码
   ↓
PostgreSQL 保存记录
   ↓
WebSocket 实时同步
   ↓
自动得到：

已交人数
未交人数
未交学生名单
```

最终目标不是开发一个复杂的教学平台，而是做好一件事情：

> **让纸质作业的收取、清点和未交确认变得快速、可靠、可追踪。**


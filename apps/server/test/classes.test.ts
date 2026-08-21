import { describe, expect, it } from 'vitest';
import { API, adminCookie, repCookie, state, teacherCookie } from './helpers.js';

const CLASS_PAYLOAD = { entryYear: 2026, department: '01', classNumber: 1 };

async function createClassAdmin(payload = CLASS_PAYLOAD) {
  const res = await state.app.inject({
    method: 'POST',
    url: `${API}/classes`,
    headers: { cookie: adminCookie() },
    payload,
  });
  return res.json().class as { id: string; entryYear: number; department: string; classNumber: number };
}

describe('班级管理', () => {
  it('未登录 GET /classes 返回 401', async () => {
    const res = await state.app.inject({ method: 'GET', url: `${API}/classes` });
    expect(res.statusCode).toBe(401);
  });

  it('REPRESENTATIVE GET /classes 返回 403', async () => {
    const res = await state.app.inject({
      method: 'GET',
      url: `${API}/classes`,
      headers: { cookie: repCookie() },
    });
    expect(res.statusCode).toBe(403);
  });

  it('教师不能创建班级返回 403', async () => {
    const res = await state.app.inject({
      method: 'POST',
      url: `${API}/classes`,
      headers: { cookie: teacherCookie() },
      payload: CLASS_PAYLOAD,
    });
    expect(res.statusCode).toBe(403);
  });

  it('管理员创建班级返回 201', async () => {
    const c = await createClassAdmin();
    expect(c.department).toBe('01');
  });

  it('重复创建班级返回 409', async () => {
    const opts = {
      method: 'POST',
      url: `${API}/classes`,
      headers: { cookie: adminCookie() },
      payload: CLASS_PAYLOAD,
    };
    await state.app.inject(opts);
    const res = await state.app.inject(opts);
    expect(res.statusCode).toBe(409);
  });

  it('非法 department 返回 400', async () => {
    const res = await state.app.inject({
      method: 'POST',
      url: `${API}/classes`,
      headers: { cookie: adminCookie() },
      payload: { entryYear: 2026, department: '99', classNumber: 1 },
    });
    expect(res.statusCode).toBe(400);
  });

  it('批量创建班级并跳过已存在班级', async () => {
    await createClassAdmin(CLASS_PAYLOAD); // 1 班已存在
    const res = await state.app.inject({
      method: 'POST',
      url: `${API}/classes/batch`,
      headers: { cookie: adminCookie() },
      payload: { entryYear: 2026, department: '01', count: 3, startFrom: 1 },
    });
    expect(res.statusCode).toBe(201);
    expect(res.json().result.created).toHaveLength(2); // 2、3 班
    expect(res.json().result.skipped).toHaveLength(1); // 1 班跳过
  });

  it('教师 GET /classes 仅返回已加入班级', async () => {
    const a = await createClassAdmin({ entryYear: 2026, department: '01', classNumber: 1 });
    await createClassAdmin({ entryYear: 2026, department: '01', classNumber: 2 });
    await state.app.inject({
      method: 'POST',
      url: `${API}/classes/${a.id}/join`,
      headers: { cookie: teacherCookie() },
    });

    const res = await state.app.inject({
      method: 'GET',
      url: `${API}/classes`,
      headers: { cookie: teacherCookie() },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().classes).toHaveLength(1);
    expect(res.json().classes[0].id).toBe(a.id);
  });

  it('教师可自助加入与退出班级', async () => {
    const a = await createClassAdmin();
    const join = await state.app.inject({
      method: 'POST',
      url: `${API}/classes/${a.id}/join`,
      headers: { cookie: teacherCookie() },
    });
    expect(join.statusCode).toBe(201);

    const leave = await state.app.inject({
      method: 'DELETE',
      url: `${API}/classes/${a.id}/join`,
      headers: { cookie: teacherCookie() },
    });
    expect(leave.statusCode).toBe(200);

    const res = await state.app.inject({
      method: 'GET',
      url: `${API}/classes`,
      headers: { cookie: teacherCookie() },
    });
    expect(res.json().classes).toHaveLength(0);
  });

  it('GET /classes/available 返回全部班级并标记 joined', async () => {
    const a = await createClassAdmin({ entryYear: 2026, department: '01', classNumber: 1 });
    await createClassAdmin({ entryYear: 2026, department: '01', classNumber: 2 });
    await state.app.inject({
      method: 'POST',
      url: `${API}/classes/${a.id}/join`,
      headers: { cookie: teacherCookie() },
    });

    const res = await state.app.inject({
      method: 'GET',
      url: `${API}/classes/available`,
      headers: { cookie: teacherCookie() },
    });
    expect(res.statusCode).toBe(200);
    const classes = res.json().classes as { id: string; joined: boolean }[];
    expect(classes).toHaveLength(2);
    expect(classes.find((c) => c.id === a.id)!.joined).toBe(true);
    expect(classes.filter((c) => c.joined)).toHaveLength(1);
  });

  it('教师访问未加入班级的学生列表返回 403', async () => {
    const a = await createClassAdmin();
    const res = await state.app.inject({
      method: 'GET',
      url: `${API}/classes/${a.id}/students`,
      headers: { cookie: teacherCookie() },
    });
    expect(res.statusCode).toBe(403);
  });

  it('删除空班返回 200', async () => {
    const c = await createClassAdmin();
    const res = await state.app.inject({
      method: 'DELETE',
      url: `${API}/classes/${c.id}`,
      headers: { cookie: adminCookie() },
    });
    expect(res.statusCode).toBe(200);
  });

  it('删除有学生的班返回 409', async () => {
    const c = await createClassAdmin();
    await state.app.inject({
      method: 'POST',
      url: `${API}/classes/${c.id}/join`,
      headers: { cookie: teacherCookie() },
    });
    await state.app.inject({
      method: 'POST',
      url: `${API}/students`,
      headers: { cookie: teacherCookie() },
      payload: { name: '张三', classId: c.id, numberInClass: 1 },
    });
    const res = await state.app.inject({
      method: 'DELETE',
      url: `${API}/classes/${c.id}`,
      headers: { cookie: adminCookie() },
    });
    expect(res.statusCode).toBe(409);
  });
});
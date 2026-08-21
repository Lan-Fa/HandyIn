import { describe, expect, it } from 'vitest';
import { API, state, teacherCookie } from './helpers.js';

async function createClass() {
  const res = await state.app.inject({
    method: 'POST',
    url: `${API}/classes`,
    headers: { cookie: teacherCookie() },
    payload: { entryYear: 2026, department: '01', classNumber: 1 },
  });
  return res.json().class as { id: string };
}

describe('学生管理', () => {
  it('创建学生自动生成学号返回 201', async () => {
    const { id: classId } = await createClass();
    const res = await state.app.inject({
      method: 'POST',
      url: `${API}/students`,
      headers: { cookie: teacherCookie() },
      payload: { name: '张三', classId, numberInClass: 1 },
    });
    expect(res.statusCode).toBe(201);
    expect(res.json().student.studentNumber).toBe('2026010101');
  });

  it('学号冲突返回 409', async () => {
    const { id: classId } = await createClass();
    const opts = {
      method: 'POST',
      url: `${API}/students`,
      headers: { cookie: teacherCookie() },
      payload: { name: '张三', classId, numberInClass: 1 },
    };
    await state.app.inject(opts);
    const res = await state.app.inject({ ...opts, payload: { name: '李四', classId, numberInClass: 1 } });
    expect(res.statusCode).toBe(409);
  });

  it('按班查询学生返回 200', async () => {
    const { id: classId } = await createClass();
    await state.app.inject({
      method: 'POST',
      url: `${API}/students`,
      headers: { cookie: teacherCookie() },
      payload: { name: '张三', classId, numberInClass: 1 },
    });
    const res = await state.app.inject({
      method: 'GET',
      url: `${API}/classes/${classId}/students`,
      headers: { cookie: teacherCookie() },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().students.length).toBe(1);
  });

  it('按 classId 查询学生列表返回 200', async () => {
    const { id: classId } = await createClass();
    await state.app.inject({
      method: 'POST',
      url: `${API}/students`,
      headers: { cookie: teacherCookie() },
      payload: { name: '张三', classId, numberInClass: 1 },
    });
    const res = await state.app.inject({
      method: 'GET',
      url: `${API}/students?classId=${classId}`,
      headers: { cookie: teacherCookie() },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().students.length).toBe(1);
  });

  it('删除学生返回 200', async () => {
    const { id: classId } = await createClass();
    const created = await state.app.inject({
      method: 'POST',
      url: `${API}/students`,
      headers: { cookie: teacherCookie() },
      payload: { name: '张三', classId, numberInClass: 1 },
    });
    const id = created.json().student.id;
    const res = await state.app.inject({
      method: 'DELETE',
      url: `${API}/students/${id}`,
      headers: { cookie: teacherCookie() },
    });
    expect(res.statusCode).toBe(200);
  });
});
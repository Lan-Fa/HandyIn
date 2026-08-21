import { describe, expect, it } from 'vitest';
import { API, adminCookie, createClassAndJoinTeacher, state, teacherCookie } from './helpers.js';

async function createClass() {
  return createClassAndJoinTeacher();
}

function multipartBody(filename: string, content: string) {
  const boundary = '----HandyInTestBoundary';
  const body =
    `--${boundary}\r\n` +
    `Content-Disposition: form-data; name="file"; filename="${filename}"\r\n` +
    `Content-Type: text/csv\r\n\r\n` +
    `${content}\r\n` +
    `--${boundary}--\r\n`;
  return { boundary, body };
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

  it('教师不能给未加入班级添加学生返回 403', async () => {
    const { id: classId } = await createClassAndJoinTeacher();
    await state.app.inject({
      method: 'DELETE',
      url: `${API}/classes/${classId}/join`,
      headers: { cookie: teacherCookie() },
    });
    const res = await state.app.inject({
      method: 'POST',
      url: `${API}/students`,
      headers: { cookie: teacherCookie() },
      payload: { name: '张三', classId, numberInClass: 1 },
    });
    expect(res.statusCode).toBe(403);
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

  it('教师 GET /students 仅返回已加入班级学生', async () => {
    const { id: joinedId } = await createClass();
    await state.app.inject({
      method: 'POST',
      url: `${API}/students`,
      headers: { cookie: teacherCookie() },
      payload: { name: '张三', classId: joinedId, numberInClass: 1 },
    });
    // 管理员建另一个班并加学生，教师未加入
    const cls = await state.app.inject({
      method: 'POST',
      url: `${API}/classes`,
      headers: { cookie: adminCookie() },
      payload: { entryYear: 2026, department: '02', classNumber: 1 },
    });
    await state.app.inject({
      method: 'POST',
      url: `${API}/students`,
      headers: { cookie: adminCookie() },
      payload: { name: '李四', classId: cls.json().class.id, numberInClass: 1 },
    });

    const res = await state.app.inject({
      method: 'GET',
      url: `${API}/students`,
      headers: { cookie: teacherCookie() },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().students).toHaveLength(1);
    expect(res.json().students[0].name).toBe('张三');
  });

  it('教师编辑未加入班级学生返回 403', async () => {
    const cls = await state.app.inject({
      method: 'POST',
      url: `${API}/classes`,
      headers: { cookie: adminCookie() },
      payload: { entryYear: 2026, department: '02', classNumber: 1 },
    });
    const classId = cls.json().class.id as string;
    const stu = await state.app.inject({
      method: 'POST',
      url: `${API}/students`,
      headers: { cookie: adminCookie() },
      payload: { name: '李四', classId, numberInClass: 1 },
    });
    const id = stu.json().student.id as string;

    const res = await state.app.inject({
      method: 'PUT',
      url: `${API}/students/${id}`,
      headers: { cookie: teacherCookie() },
      payload: { name: '李四改名', studentNumber: '2026020101' },
    });
    expect(res.statusCode).toBe(403);
  });

  it('教师删除未加入班级学生返回 403', async () => {
    const cls = await state.app.inject({
      method: 'POST',
      url: `${API}/classes`,
      headers: { cookie: adminCookie() },
      payload: { entryYear: 2026, department: '02', classNumber: 1 },
    });
    const classId = cls.json().class.id as string;
    const stu = await state.app.inject({
      method: 'POST',
      url: `${API}/students`,
      headers: { cookie: adminCookie() },
      payload: { name: '李四', classId, numberInClass: 1 },
    });
    const id = stu.json().student.id as string;

    const res = await state.app.inject({
      method: 'DELETE',
      url: `${API}/students/${id}`,
      headers: { cookie: teacherCookie() },
    });
    expect(res.statusCode).toBe(403);
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

  it('管理员导入学生自动创建班级', async () => {
    const { boundary, body } = multipartBody(
      'students.csv',
      '2026010101,张三\n2026010201,李四\n',
    );
    const res = await state.app.inject({
      method: 'POST',
      url: `${API}/students/import`,
      headers: { cookie: adminCookie(), 'content-type': `multipart/form-data; boundary=${boundary}` },
      payload: body,
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().result.created).toBe(2);
    expect(res.json().result.skipped).toHaveLength(0);
  });

  it('教师导入时跳过未加入班级的行', async () => {
    await createClassAndJoinTeacher({ entryYear: 2026, department: '01', classNumber: 1 });
    const { boundary, body } = multipartBody(
      'students.csv',
      '2026010101,张三\n2026010201,李四\n',
    );
    const res = await state.app.inject({
      method: 'POST',
      url: `${API}/students/import`,
      headers: { cookie: teacherCookie(), 'content-type': `multipart/form-data; boundary=${boundary}` },
      payload: body,
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().result.created).toBe(1);
    expect(res.json().result.skipped).toHaveLength(1);
    expect(res.json().result.skipped[0].reason).toBe('not_joined_class');
  });

  it('导入非法文件类型返回 400', async () => {
    const { boundary, body } = multipartBody('students.txt', '2026010101,张三\n');
    const res = await state.app.inject({
      method: 'POST',
      url: `${API}/students/import`,
      headers: { cookie: adminCookie(), 'content-type': `multipart/form-data; boundary=${boundary}` },
      payload: body,
    });
    expect(res.statusCode).toBe(400);
  });
});
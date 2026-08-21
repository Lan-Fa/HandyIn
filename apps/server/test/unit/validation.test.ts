import { describe, expect, it } from 'vitest';
import {
  buildStudentNumber,
  classBatchCreateSchema,
  loginSchema,
  parseStudentNumber,
  roleSchema,
  studentCreateSchema,
  userCreateSchema,
} from '@handyin/validation';

describe('parseStudentNumber', () => {
  it('解析合法 10 位学号', () => {
    expect(parseStudentNumber('2026010101')).toEqual({
      entryYear: 2026,
      department: '01',
      classNumber: 1,
      numberInClass: 1,
    });
  });

  it('非 10 位返回 null', () => {
    expect(parseStudentNumber('202601011')).toBeNull();
    expect(parseStudentNumber('20260101011')).toBeNull();
  });

  it('非法学部码返回 null', () => {
    expect(parseStudentNumber('2026990101')).toBeNull();
  });

  it('含非数字字符返回 null', () => {
    expect(parseStudentNumber('2026ab0101')).toBeNull();
  });
});

describe('buildStudentNumber', () => {
  it('班级号与班内学号补零', () => {
    expect(
      buildStudentNumber({ entryYear: 2026, department: '01', classNumber: 2, numberInClass: 12 }),
    ).toBe('2026010212');
  });

  it('与 parse 互为逆运算', () => {
    const parsed = parseStudentNumber('2026030705');
    expect(parsed).not.toBeNull();
    expect(buildStudentNumber(parsed!)).toBe('2026030705');
  });
});

describe('roleSchema', () => {
  it('接受 ADMIN/TEACHER/REPRESENTATIVE', () => {
    expect(roleSchema.safeParse('ADMIN').success).toBe(true);
    expect(roleSchema.safeParse('TEACHER').success).toBe(true);
    expect(roleSchema.safeParse('REPRESENTATIVE').success).toBe(true);
  });

  it('拒绝未知角色', () => {
    expect(roleSchema.safeParse('STUDENT').success).toBe(false);
  });
});

describe('classBatchCreateSchema', () => {
  it('合法批次通过，startFrom 有默认值 1', () => {
    const parsed = classBatchCreateSchema.parse({ entryYear: 2026, department: '01', count: 12 });
    expect(parsed.startFrom).toBe(1);
  });

  it('count 小于 1 被拒绝', () => {
    expect(
      classBatchCreateSchema.safeParse({ entryYear: 2026, department: '01', count: 0 }).success,
    ).toBe(false);
  });
});

describe('userCreateSchema', () => {
  it('密码长度不足 8 位被拒绝', () => {
    expect(
      userCreateSchema.safeParse({ username: 'u1', password: 'short', role: 'TEACHER' }).success,
    ).toBe(false);
  });

  it('合法用户通过', () => {
    expect(
      userCreateSchema.safeParse({
        username: 'teacher1',
        password: 'long-enough-password',
        role: 'TEACHER',
      }).success,
    ).toBe(true);
  });
});

describe('loginSchema / studentCreateSchema', () => {
  it('登录 schema 拒绝空字段', () => {
    expect(loginSchema.safeParse({ username: '', password: 'x' }).success).toBe(false);
  });

  it('学生创建需提供 numberInClass 或 studentNumber', () => {
    expect(
      studentCreateSchema.safeParse({ name: '张三', classId: '00000000-0000-0000-0000-000000000000' })
        .success,
    ).toBe(false);
    expect(
      studentCreateSchema.safeParse({
        name: '张三',
        classId: '00000000-0000-0000-0000-000000000000',
        numberInClass: 1,
      }).success,
    ).toBe(true);
  });
});
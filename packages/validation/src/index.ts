import { z } from 'zod';
import { DEPARTMENT_CODES, type DepartmentCode, type ParsedStudentNumber } from '@handyin/types';

export const STUDENT_NUMBER_REGEX = /^\d{10}$/;

export const departmentSchema = z.enum(DEPARTMENT_CODES);

export const roleSchema = z.enum(['ADMIN', 'TEACHER', 'REPRESENTATIVE']);

export const assignmentStatusSchema = z.enum(['DRAFT', 'COLLECTING', 'FINISHED']);

export function parseStudentNumber(studentNumber: string): ParsedStudentNumber | null {
  if (!STUDENT_NUMBER_REGEX.test(studentNumber)) return null;
  const entryYear = Number(studentNumber.slice(0, 4));
  const department = studentNumber.slice(4, 6) as DepartmentCode;
  const classNumber = Number(studentNumber.slice(6, 8));
  const numberInClass = Number(studentNumber.slice(8, 10));
  if (!DEPARTMENT_CODES.includes(department)) return null;
  return { entryYear, department, classNumber, numberInClass };
}

export function buildStudentNumber(p: ParsedStudentNumber): string {
  const cc = String(p.classNumber).padStart(2, '0');
  const nn = String(p.numberInClass).padStart(2, '0');
  return `${p.entryYear}${p.department}${cc}${nn}`;
}

export const loginSchema = z.object({
  username: z.string().min(1).max(64),
  password: z.string().min(1).max(256),
});

export const classCreateSchema = z.object({
  entryYear: z.number().int().min(2000).max(2100),
  department: departmentSchema,
  classNumber: z.number().int().min(1).max(99),
});

export const classUpdateSchema = classCreateSchema;

export const classBatchCreateSchema = z.object({
  entryYear: z.number().int().min(2000).max(2100),
  department: departmentSchema,
  count: z.number().int().min(1).max(99),
  startFrom: z.number().int().min(1).max(99).default(1),
});

export const studentCreateSchema = z
  .object({
    name: z.string().min(1).max(64),
    classId: z.string().uuid(),
    numberInClass: z.number().int().min(1).max(99).optional(),
    studentNumber: z.string().regex(STUDENT_NUMBER_REGEX).optional(),
  })
  .refine((d) => d.numberInClass !== undefined || d.studentNumber !== undefined, {
    message: '需提供班内学号（numberInClass）或完整学号（studentNumber）',
  });

export const studentUpdateSchema = z.object({
  name: z.string().min(1).max(64),
  studentNumber: z.string().regex(STUDENT_NUMBER_REGEX),
});

export const assignmentCreateSchema = z.object({
  classId: z.string().uuid(),
  title: z.string().min(1).max(128),
  description: z.string().max(2000).optional(),
});

export const assignmentUpdateSchema = z.object({
  title: z.string().min(1).max(128).optional(),
  description: z.string().max(2000).nullable().optional(),
  status: assignmentStatusSchema.optional(),
});

export const submissionCreateSchema = z.object({
  assignmentId: z.string().uuid(),
  qrToken: z.string().min(1).max(128),
});

export const submissionDeleteSchema = z.object({
  submissionId: z.string().uuid(),
});

export const repGrantSchema = z.object({
  assignmentId: z.string().uuid(),
  userId: z.string().uuid(),
  expiresAt: z.string().datetime().nullable().optional(),
});

export const idParamSchema = z.object({
  id: z.string().uuid(),
});

export const userCreateSchema = z.object({
  username: z.string().min(1).max(64),
  password: z.string().min(8).max(256),
  name: z.string().min(1).max(64).optional(),
  role: roleSchema,
});

export const userUpdateSchema = z.object({
  name: z.string().min(1).max(64).nullable().optional(),
  role: roleSchema.optional(),
  password: z.string().min(8).max(256).optional(),
});

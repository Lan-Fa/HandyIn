import type { FastifyInstance } from 'fastify';
import {
  studentCreateSchema,
  studentUpdateSchema,
  parseStudentNumber,
  buildStudentNumber,
} from '@handyin/validation';
import type { DepartmentCode, ImportResult } from '@handyin/types';
import { prisma } from '../prisma.js';
import { Errors } from '../errors.js';
import { requireTeacher } from '../plugins/auth.js';
import { generateQrToken } from '../lib/qrcode.js';
import { parseCsvText, parseXlsxBuffer, validateImportRows } from '../lib/import.js';

async function uniqueQrToken(): Promise<string> {
  for (let i = 0; i < 5; i++) {
    const token = generateQrToken();
    const existing = await prisma.student.findUnique({ where: { qrToken: token } });
    if (!existing) return token;
  }
  throw new Error('无法生成唯一二维码令牌');
}

function studentToDto(s: {
  id: string;
  name: string;
  studentNumber: string;
  entryYear: number;
  department: string;
  classNumber: number;
  numberInClass: number;
  qrToken: string;
  classId: string;
  createdAt: Date;
}) {
  return {
    id: s.id,
    name: s.name,
    studentNumber: s.studentNumber,
    entryYear: s.entryYear,
    department: s.department as DepartmentCode,
    classNumber: s.classNumber,
    numberInClass: s.numberInClass,
    qrToken: s.qrToken,
    classId: s.classId,
    createdAt: s.createdAt.toISOString(),
  };
}

export async function studentRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', requireTeacher);

  app.get('/students', async (request) => {
    const query = request.query as { classId?: string };
    const students = await prisma.student.findMany({
      where: query.classId ? { classId: query.classId } : undefined,
      orderBy: [{ studentNumber: 'asc' }],
    });
    return { students: students.map(studentToDto) };
  });

  app.post('/students', async (request, reply) => {
    const body = studentCreateSchema.safeParse(request.body);
    if (!body.success) throw Errors.badRequest(body.error.issues[0]?.message ?? '参数错误');

    const { name, classId, numberInClass, studentNumber } = body.data;
    const cls = await prisma.class.findUnique({ where: { id: classId } });
    if (!cls) throw Errors.notFound('班级');

    let parsed;
    if (studentNumber) {
      parsed = parseStudentNumber(studentNumber);
      if (!parsed) throw Errors.badRequest('学号格式非法');
      if (parsed.entryYear !== cls.entryYear || parsed.department !== cls.department || parsed.classNumber !== cls.classNumber) {
        throw Errors.badRequest('学号与所选班级不匹配');
      }
    } else {
      parsed = {
        entryYear: cls.entryYear,
        department: cls.department as DepartmentCode,
        classNumber: cls.classNumber,
        numberInClass: numberInClass!,
      };
    }

    const finalNumber = buildStudentNumber(parsed);
    const dup = await prisma.student.findUnique({ where: { studentNumber: finalNumber } });
    if (dup) throw Errors.conflict('该学号已存在');

    const qrToken = await uniqueQrToken();
    const student = await prisma.student.create({
      data: {
        name,
        classId,
        studentNumber: finalNumber,
        entryYear: parsed.entryYear,
        department: parsed.department,
        classNumber: parsed.classNumber,
        numberInClass: parsed.numberInClass,
        qrToken,
      },
    });

    return reply.status(201).send({ student: studentToDto(student) });
  });

  app.put('/students/:id', async (request) => {
    const { id } = request.params as { id: string };
    const body = studentUpdateSchema.safeParse(request.body);
    if (!body.success) throw Errors.badRequest(body.error.issues[0]?.message ?? '参数错误');

    const { name, studentNumber } = body.data;
    const existing = await prisma.student.findUnique({ where: { id } });
    if (!existing) throw Errors.notFound('学生');

    if (studentNumber !== existing.studentNumber) {
      const parsed = parseStudentNumber(studentNumber);
      if (!parsed) throw Errors.badRequest('学号格式非法');
      const dup = await prisma.student.findUnique({ where: { studentNumber } });
      if (dup && dup.id !== id) throw Errors.conflict('该学号已存在');

      const cls = await prisma.class.findUnique({
        where: {
          entryYear_department_classNumber: {
            entryYear: parsed.entryYear,
            department: parsed.department,
            classNumber: parsed.classNumber,
          },
        },
      });
      if (!cls) throw Errors.badRequest('对应班级不存在，请先创建班级');

      const student = await prisma.student.update({
        where: { id },
        data: {
          name,
          studentNumber,
          entryYear: parsed.entryYear,
          department: parsed.department,
          classNumber: parsed.classNumber,
          numberInClass: parsed.numberInClass,
          classId: cls.id,
        },
      });
      return { student: studentToDto(student) };
    }

    const student = await prisma.student.update({ where: { id }, data: { name } });
    return { student: studentToDto(student) };
  });

  app.delete('/students/:id', async (request) => {
    const { id } = request.params as { id: string };
    await prisma.student.delete({ where: { id } });
    return { ok: true };
  });

  app.post('/students/import', async (request, reply) => {
    const file = await request.file();
    if (!file) throw Errors.badRequest('未上传文件');

    const buffer = await file.toBuffer();
    const filename = file.filename.toLowerCase();
    let raw;
    if (filename.endsWith('.csv')) {
      raw = parseCsvText(buffer.toString('utf8').replace(/^\uFEFF/, ''));
    } else if (filename.endsWith('.xlsx') || filename.endsWith('.xls')) {
      raw = parseXlsxBuffer(buffer);
    } else {
      throw Errors.badRequest('仅支持 CSV 或 Excel(.xlsx) 文件');
    }

    if (raw.length === 0) throw Errors.badRequest('文件中没有有效数据');

    const existing = await prisma.student.findMany({ select: { studentNumber: true } });
    const existingNumbers = new Set(existing.map((s) => s.studentNumber));

    const preview = validateImportRows(raw, existingNumbers);
    const skipped = preview.issues;

    let created = 0;
    if (preview.valid.length > 0) {
      await prisma.$transaction(async (tx) => {
        for (const row of preview.valid) {
          const parsed = parseStudentNumber(row.studentNumber)!;
          let cls = await tx.class.findUnique({
            where: {
              entryYear_department_classNumber: {
                entryYear: parsed.entryYear,
                department: parsed.department,
                classNumber: parsed.classNumber,
              },
            },
          });
          if (!cls) {
            cls = await tx.class.create({
              data: { entryYear: parsed.entryYear, department: parsed.department, classNumber: parsed.classNumber },
            });
          }

          const qrToken = await uniqueQrToken();
          await tx.student.create({
            data: {
              name: row.name,
              classId: cls.id,
              studentNumber: row.studentNumber,
              entryYear: parsed.entryYear,
              department: parsed.department,
              classNumber: parsed.classNumber,
              numberInClass: parsed.numberInClass,
              qrToken,
            },
          });
          created++;
        }
      });
    }

    const result: ImportResult = { created, skipped };
    return reply.send({ result, preview });
  });
}

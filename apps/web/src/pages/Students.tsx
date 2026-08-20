import { useEffect, useRef, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import type {
  ClassDto,
  ImportPreview,
  ImportResult,
  ImportValidationIssue,
  StudentDto,
} from '@handyin/types';
import { api } from '../lib/api';
import { qrContent } from '../lib/qr';
import { Button, Card, EmptyState, Input, Label, Modal, Select, Spinner } from '../components/ui';

const REASON_LABEL: Record<ImportValidationIssue['reason'], string> = {
  invalid_number: '非法学号',
  missing_name: '缺失姓名',
  duplicate_in_file: '文件内重复',
  duplicate_in_db: '学号已存在',
};

export default function Students() {
  const [classes, setClasses] = useState<ClassDto[]>([]);
  const [classId, setClassId] = useState('');
  const [students, setStudents] = useState<StudentDto[]>([]);
  const [loading, setLoading] = useState(true);

  const [addOpen, setAddOpen] = useState(false);
  const [qrStudent, setQrStudent] = useState<StudentDto | null>(null);

  const [addForm, setAddForm] = useState({ name: '', numberInClass: '' });
  const [addError, setAddError] = useState('');

  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ result: ImportResult; preview: ImportPreview } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const loadClasses = async () => {
    const d = await api.get<{ classes: ClassDto[] }>('/classes');
    setClasses(d.classes);
    if (d.classes.length > 0) setClassId((prev) => prev || d.classes[0]!.id);
  };

  const loadStudents = async (cid: string) => {
    if (!cid) {
      setStudents([]);
      return;
    }
    const d = await api.get<{ students: StudentDto[] }>(`/classes/${cid}/students`);
    setStudents(d.students);
  };

  useEffect(() => {
    loadClasses().finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (classId) loadStudents(classId);
  }, [classId]);

  const handleAdd = async () => {
    setAddError('');
    try {
      await api.post('/students', {
        name: addForm.name,
        classId,
        numberInClass: Number(addForm.numberInClass),
      });
      setAddOpen(false);
      setAddForm({ name: '', numberInClass: '' });
      await loadStudents(classId);
    } catch (err) {
      setAddError(err instanceof Error ? err.message : '添加失败');
    }
  };

  const handleImport = async (file: File) => {
    setImporting(true);
    setImportResult(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const d = await api.upload<{ result: ImportResult; preview: ImportPreview }>('/students/import', formData);
      setImportResult(d);
      await loadClasses();
      await loadStudents(classId);
    } catch (err) {
      alert(err instanceof Error ? err.message : '导入失败');
    } finally {
      setImporting(false);
    }
  };

  const handleDelete = async (id: string, label: string) => {
    if (!confirm(`确定删除学生「${label}」？`)) return;
    try {
      await api.del(`/students/${id}`);
      await loadStudents(classId);
    } catch (err) {
      alert(err instanceof Error ? err.message : '删除失败');
    }
  };

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">学生管理</h2>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => fileRef.current?.click()}>
            导入
          </Button>
          <Button variant="secondary" onClick={() => students.length && window.print()}>
            打印二维码
          </Button>
          <Button onClick={() => setAddOpen(true)} disabled={!classId}>
            添加学生
          </Button>
        </div>
      </div>

      <div className="mb-4">
        <Select value={classId} onChange={(e) => setClassId(e.target.value)}>
          <option value="">请选择班级</option>
          {classes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.entryYear}级{c.department}部{c.classNumber}班（{c.studentCount}人）
            </option>
          ))}
        </Select>
      </div>

      <input
        ref={fileRef}
        type="file"
        accept=".csv,.xlsx,.xls"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleImport(f);
          e.target.value = '';
        }}
      />

      <Card>
        {loading ? (
          <EmptyState text="加载中…" />
        ) : !classId ? (
          <EmptyState text="请先选择或创建班级" />
        ) : students.length === 0 ? (
          <EmptyState text="该班级暂无学生，可手动添加或文件导入" />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-slate-500">
                <th className="px-4 py-2">学号</th>
                <th className="px-4 py-2">姓名</th>
                <th className="px-4 py-2">班内学号</th>
                <th className="px-4 py-2 text-right">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {students.map((s) => (
                <tr key={s.id}>
                  <td className="px-4 py-2 font-mono">{s.studentNumber}</td>
                  <td className="px-4 py-2">{s.name}</td>
                  <td className="px-4 py-2">{s.numberInClass} 号</td>
                  <td className="px-4 py-2 text-right">
                    <Button variant="ghost" onClick={() => setQrStudent(s)}>
                      二维码
                    </Button>
                    <Button variant="ghost" onClick={() => handleDelete(s.id, `${s.name} ${s.studentNumber}`)}>
                      删除
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      {/* 添加学生 */}
      <Modal open={addOpen} title="添加学生" onClose={() => setAddOpen(false)}>
        <div className="space-y-4">
          <div>
            <Label>姓名</Label>
            <Input value={addForm.name} onChange={(e) => setAddForm({ ...addForm, name: e.target.value })} />
          </div>
          <div>
            <Label>班内学号</Label>
            <Input
              type="number"
              placeholder="例如 12"
              value={addForm.numberInClass}
              onChange={(e) => setAddForm({ ...addForm, numberInClass: e.target.value })}
            />
            <p className="mt-1 text-xs text-slate-400">学号将根据班级自动生成</p>
          </div>
          {addError && <p className="text-sm text-red-600">{addError}</p>}
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setAddOpen(false)}>
              取消
            </Button>
            <Button onClick={handleAdd}>添加</Button>
          </div>
        </div>
      </Modal>

      {/* 导入结果 */}
      <Modal
        open={importing || importResult !== null}
        title="导入学生"
        onClose={() => setImportResult(null)}
      >
        {importing ? (
          <div className="flex items-center justify-center gap-2 py-8">
            <Spinner /> 正在导入…
          </div>
        ) : importResult ? (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded-lg bg-emerald-50 p-3">
                <div className="text-2xl font-semibold text-emerald-600">{importResult.result.created}</div>
                <div className="text-xs text-slate-500">新增</div>
              </div>
              <div className="rounded-lg bg-amber-50 p-3">
                <div className="text-2xl font-semibold text-amber-600">{importResult.result.skipped.length}</div>
                <div className="text-xs text-slate-500">跳过</div>
              </div>
              <div className="rounded-lg bg-slate-50 p-3">
                <div className="text-2xl font-semibold text-slate-600">{importResult.preview.total}</div>
                <div className="text-xs text-slate-500">总行数</div>
              </div>
            </div>
            {importResult.result.skipped.length > 0 && (
              <div className="max-h-48 overflow-y-auto rounded-lg border border-slate-200">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 text-left text-slate-500">
                      <th className="px-3 py-2">行</th>
                      <th className="px-3 py-2">学号</th>
                      <th className="px-3 py-2">姓名</th>
                      <th className="px-3 py-2">原因</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {importResult.result.skipped.map((issue, i) => (
                      <tr key={i}>
                        <td className="px-3 py-1.5">{issue.row}</td>
                        <td className="px-3 py-1.5 font-mono">{issue.studentNumber}</td>
                        <td className="px-3 py-1.5">{issue.name}</td>
                        <td className="px-3 py-1.5">{REASON_LABEL[issue.reason]}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <div className="flex justify-end">
              <Button variant="secondary" onClick={() => setImportResult(null)}>
                完成
              </Button>
            </div>
          </div>
        ) : (
          <EmptyState text="选择 CSV 或 Excel 文件（学号,姓名）" />
        )}
      </Modal>

      {/* 单个二维码 */}
      <Modal open={!!qrStudent} title="学生二维码" onClose={() => setQrStudent(null)}>
        {qrStudent && (
          <div className="flex flex-col items-center gap-3">
            <div className="rounded-lg border border-slate-200 p-4">
              <QRCodeSVG value={qrContent(qrStudent.qrToken)} size={200} />
            </div>
            <div className="text-center">
              <div className="text-lg font-medium">{qrStudent.name}</div>
              <div className="font-mono text-sm text-slate-500">{qrStudent.studentNumber}</div>
            </div>
            <Button onClick={() => window.print()}>打印</Button>
          </div>
        )}
      </Modal>

      {/* 批量打印区域（仅打印时可见） */}
      <div id="print-area">
        {students.map((s) => (
          <div key={s.id} className="print-item" style={{ display: 'inline-block', margin: 12, textAlign: 'center' }}>
            <QRCodeSVG value={qrContent(s.qrToken)} size={120} />
            <div style={{ fontSize: 12 }}>{s.name}</div>
            <div style={{ fontSize: 10, color: '#555' }}>{s.studentNumber}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

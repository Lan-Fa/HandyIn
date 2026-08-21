import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { QRCodeSVG } from 'qrcode.react';
import { FileUp, Plus, Printer, QrCode } from 'lucide-react';
import type { ColumnDef } from '@tanstack/react-table';
import type {
  ClassDto,
  ImportPreview,
  ImportResult,
  ImportValidationIssue,
  StudentDto,
} from '@handyin/types';
import { api } from '../lib/api';
import { qrContent } from '../lib/qr';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { DataTable } from '@/components/ui/data-table';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ConfirmDialog } from '@/components/confirm-dialog';

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
  const [deleteTarget, setDeleteTarget] = useState<StudentDto | null>(null);

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
      toast.success('学生添加成功');
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
      toast.error(err instanceof Error ? err.message : '导入失败');
    } finally {
      setImporting(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await api.del(`/students/${deleteTarget.id}`);
      toast.success('学生已删除');
      setDeleteTarget(null);
      await loadStudents(classId);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '删除失败');
    }
  };

  const columns: ColumnDef<StudentDto>[] = [
    {
      accessorKey: 'studentNumber',
      header: '学号',
      cell: ({ row }) => <span className="font-mono text-sm">{row.original.studentNumber}</span>,
    },
    {
      accessorKey: 'name',
      header: '姓名',
      cell: ({ row }) => <span className="font-medium">{row.original.name}</span>,
    },
    {
      accessorKey: 'numberInClass',
      header: '班内学号',
      cell: ({ row }) => `${row.original.numberInClass} 号`,
    },
    {
      id: 'actions',
      header: () => <span className="sr-only">操作</span>,
      cell: ({ row }) => (
        <div className="flex items-center justify-end gap-1">
          <Button variant="ghost" size="sm" onClick={() => setQrStudent(row.original)}>
            <QrCode className="size-4" />
            二维码
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setDeleteTarget(row.original)}
          >
            删除
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">学生管理</h1>
          <p className="mt-1 text-sm text-muted-foreground">管理学生信息与二维码。</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => fileRef.current?.click()}>
            <FileUp className="size-4" />
            导入
          </Button>
          <Button variant="outline" onClick={() => students.length && window.print()}>
            <Printer className="size-4" />
            打印二维码
          </Button>
          <Button onClick={() => setAddOpen(true)} disabled={!classId}>
            <Plus className="size-4" />
            添加学生
          </Button>
        </div>
      </div>

      <div className="max-w-md">
        <Select value={classId} onValueChange={setClassId}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="请选择班级" />
          </SelectTrigger>
          <SelectContent>
            {classes.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.entryYear}级{c.department}部{c.classNumber}班（{c.studentCount}人）
              </SelectItem>
            ))}
          </SelectContent>
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

      <DataTable
        columns={columns}
        data={students}
        searchPlaceholder="搜索姓名或学号…"
        searchKeys={['name', 'studentNumber']}
        emptyText={loading ? '加载中…' : !classId ? '请先选择或创建班级' : '该班级暂无学生，可手动添加或文件导入'}
      />

      {/* 添加学生 */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>添加学生</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">姓名</Label>
              <Input
                id="name"
                value={addForm.name}
                onChange={(e) => setAddForm({ ...addForm, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="numberInClass">班内学号</Label>
              <Input
                id="numberInClass"
                type="number"
                placeholder="例如 12"
                value={addForm.numberInClass}
                onChange={(e) => setAddForm({ ...addForm, numberInClass: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">学号将根据班级自动生成</p>
            </div>
            {addError && <p className="text-sm text-destructive">{addError}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>
              取消
            </Button>
            <Button onClick={handleAdd}>添加</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 导入结果 */}
      <Dialog
        open={importing || importResult !== null}
        onOpenChange={(open) => !open && setImportResult(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>导入学生</DialogTitle>
          </DialogHeader>
          {importing ? (
            <div className="flex items-center justify-center gap-2 py-8">
              <Spinner className="size-5" /> 正在导入…
            </div>
          ) : importResult ? (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-3 text-center">
                <Card className="bg-emerald-50 py-3">
                  <div className="text-2xl font-semibold text-emerald-600">{importResult.result.created}</div>
                  <div className="text-xs text-muted-foreground">新增</div>
                </Card>
                <Card className="bg-amber-50 py-3">
                  <div className="text-2xl font-semibold text-amber-600">{importResult.result.skipped.length}</div>
                  <div className="text-xs text-muted-foreground">跳过</div>
                </Card>
                <Card className="bg-slate-50 py-3">
                  <div className="text-2xl font-semibold text-slate-600">{importResult.preview.total}</div>
                  <div className="text-xs text-muted-foreground">总行数</div>
                </Card>
              </div>
              {importResult.result.skipped.length > 0 && (
                <div className="max-h-48 overflow-y-auto rounded-lg border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>行</TableHead>
                        <TableHead>学号</TableHead>
                        <TableHead>姓名</TableHead>
                        <TableHead>原因</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {importResult.result.skipped.map((issue, i) => (
                        <TableRow key={i}>
                          <TableCell>{issue.row}</TableCell>
                          <TableCell className="font-mono">{issue.studentNumber}</TableCell>
                          <TableCell>{issue.name}</TableCell>
                          <TableCell>{REASON_LABEL[issue.reason]}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
              <DialogFooter>
                <Button variant="outline" onClick={() => setImportResult(null)}>
                  完成
                </Button>
              </DialogFooter>
            </div>
          ) : (
            <EmptyState text="选择 CSV 或 Excel 文件（学号,姓名）" />
          )}
        </DialogContent>
      </Dialog>

      {/* 单个二维码 */}
      <Dialog open={!!qrStudent} onOpenChange={(open) => !open && setQrStudent(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>学生二维码</DialogTitle>
          </DialogHeader>
          {qrStudent && (
            <div className="flex flex-col items-center gap-3">
              <div className="rounded-lg border p-4">
                <QRCodeSVG value={qrContent(qrStudent.qrToken)} size={200} />
              </div>
              <div className="text-center">
                <div className="text-lg font-medium">{qrStudent.name}</div>
                <div className="font-mono text-sm text-muted-foreground">{qrStudent.studentNumber}</div>
              </div>
              <Button onClick={() => window.print()}>
                <Printer className="size-4" />
                打印
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={deleteTarget !== null}
        title="删除学生"
        description={deleteTarget ? `确定删除学生「${deleteTarget.name} ${deleteTarget.studentNumber}」？` : undefined}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        onConfirm={handleDelete}
      />

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

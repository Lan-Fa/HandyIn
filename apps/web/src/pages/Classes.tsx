import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Plus } from 'lucide-react';
import { DEPARTMENT_CODES, DEPARTMENT_LABELS, type ClassDto, type DepartmentCode } from '@handyin/types';
import { api } from '../lib/api';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import { ConfirmDialog } from '@/components/confirm-dialog';

export default function Classes() {
  const [classes, setClasses] = useState<ClassDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<ClassDto | null>(null);
  const [form, setForm] = useState({
    entryYear: new Date().getFullYear().toString(),
    department: '01' as DepartmentCode,
    classNumber: '',
  });

  const load = async () => {
    const d = await api.get<{ classes: ClassDto[] }>('/classes');
    setClasses(d.classes);
  };

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, []);

  const handleCreate = async () => {
    setError('');
    try {
      await api.post('/classes', {
        entryYear: Number(form.entryYear),
        department: form.department,
        classNumber: Number(form.classNumber),
      });
      setOpen(false);
      setForm({ ...form, classNumber: '' });
      await load();
      toast.success('班级创建成功');
    } catch (err) {
      setError(err instanceof Error ? err.message : '创建失败');
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await api.del(`/classes/${deleteTarget.id}`);
      toast.success('班级已删除');
      setDeleteTarget(null);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '删除失败');
    }
  };

  const classLabel = (c: ClassDto) =>
    `${c.entryYear}级${DEPARTMENT_LABELS[c.department]}${c.classNumber}班`;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">班级管理</h1>
          <p className="mt-1 text-sm text-muted-foreground">管理教学班级，学生按班级组织。</p>
        </div>
        <Button onClick={() => setOpen(true)}>
          <Plus className="size-4" />
          新建班级
        </Button>
      </div>

      <Card>
        {loading ? (
          <EmptyState text="加载中…" />
        ) : classes.length === 0 ? (
          <EmptyState text="暂无班级，点击右上角新建" />
        ) : (
          <ul className="divide-y divide-border">
            {classes.map((c) => (
              <li key={c.id} className="flex items-center justify-between px-5 py-4">
                <div className="flex items-center gap-3">
                  <span className="font-medium">{classLabel(c)}</span>
                  <span className="text-sm text-muted-foreground">{c.studentCount} 名学生</span>
                </div>
                <Button variant="ghost" size="sm" onClick={() => setDeleteTarget(c)}>
                  删除
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>新建班级</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="entryYear">入学年份</Label>
              <Input
                id="entryYear"
                type="number"
                value={form.entryYear}
                onChange={(e) => setForm({ ...form, entryYear: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>学部</Label>
              <Select
                value={form.department}
                onValueChange={(value) => setForm({ ...form, department: value as DepartmentCode })}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="选择学部" />
                </SelectTrigger>
                <SelectContent>
                  {DEPARTMENT_CODES.map((code) => (
                    <SelectItem key={code} value={code}>
                      {DEPARTMENT_LABELS[code]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="classNumber">班级编号</Label>
              <Input
                id="classNumber"
                type="number"
                placeholder="例如 2"
                value={form.classNumber}
                onChange={(e) => setForm({ ...form, classNumber: e.target.value })}
              />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              取消
            </Button>
            <Button onClick={handleCreate}>创建</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={deleteTarget !== null}
        title="删除班级"
        description={deleteTarget ? `确定删除班级「${classLabel(deleteTarget)}」？` : undefined}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        onConfirm={handleDelete}
      />
    </div>
  );
}

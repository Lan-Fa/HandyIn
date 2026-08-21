import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Layers, Plus } from 'lucide-react';
import {
  DEPARTMENT_CODES,
  DEPARTMENT_LABELS,
  type ClassDto,
  type DepartmentCode,
  type JoinableClassDto,
} from '@handyin/types';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { useCurrentClass } from '../lib/current-class';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
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
import { ConfirmDialog } from '@/components/confirm-dialog';

export default function Classes() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';
  const { refreshClasses } = useCurrentClass();

  const [classes, setClasses] = useState<ClassDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [batchOpen, setBatchOpen] = useState(false);
  const [error, setError] = useState('');
  const [batchError, setBatchError] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<ClassDto | null>(null);
  const [leaveTarget, setLeaveTarget] = useState<ClassDto | null>(null);
  const [form, setForm] = useState({
    entryYear: new Date().getFullYear().toString(),
    department: '01' as DepartmentCode,
    classNumber: '',
  });
  const [batchForm, setBatchForm] = useState({
    entryYear: new Date().getFullYear().toString(),
    department: '01' as DepartmentCode,
    count: '',
    startFrom: '1',
  });

  const [joinOpen, setJoinOpen] = useState(false);
  const [joinLoading, setJoinLoading] = useState(false);
  const [available, setAvailable] = useState<JoinableClassDto[]>([]);

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

  const handleBatchCreate = async () => {
    setBatchError('');
    try {
      const d = await api.post<{
        result: { created: unknown[]; skipped: unknown[] };
      }>('/classes/batch', {
        entryYear: Number(batchForm.entryYear),
        department: batchForm.department,
        count: Number(batchForm.count),
        startFrom: Number(batchForm.startFrom),
      });
      const created = d.result.created.length;
      const skipped = d.result.skipped.length;
      let msg = `成功创建 ${created} 个班级`;
      if (skipped > 0) msg += `，跳过 ${skipped} 个已存在班级`;
      toast.success(msg);
      setBatchOpen(false);
      setBatchForm({ ...batchForm, count: '', startFrom: '1' });
      await load();
    } catch (err) {
      setBatchError(err instanceof Error ? err.message : '创建失败');
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

  const handleLeave = async () => {
    if (!leaveTarget) return;
    try {
      await api.del(`/classes/${leaveTarget.id}/join`);
      toast.success('已退出班级');
      setLeaveTarget(null);
      await load();
      await refreshClasses();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '退出失败');
    }
  };

  const openJoin = async () => {
    setJoinOpen(true);
    setJoinLoading(true);
    try {
      const d = await api.get<{ classes: JoinableClassDto[] }>('/classes/available');
      setAvailable(d.classes);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '加载班级失败');
    } finally {
      setJoinLoading(false);
    }
  };

  const toggleJoin = async (c: JoinableClassDto) => {
    try {
      if (c.joined) {
        await api.del(`/classes/${c.id}/join`);
      } else {
        await api.post(`/classes/${c.id}/join`);
      }
      setAvailable((prev) => prev.map((x) => (x.id === c.id ? { ...x, joined: !c.joined } : x)));
      await load();
      await refreshClasses();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '操作失败');
    }
  };

  const classLabel = (c: ClassDto) =>
    `${c.entryYear}级${DEPARTMENT_LABELS[c.department]}${c.classNumber}班`;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">班级管理</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {isAdmin ? '创建班级，学生按班级组织。' : '查看你已加入的班级。'}
          </p>
        </div>
        {isAdmin ? (
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setBatchOpen(true)}>
              <Layers className="size-4" />
              批量创建
            </Button>
            <Button onClick={() => setOpen(true)}>
              <Plus className="size-4" />
              新建班级
            </Button>
          </div>
        ) : (
          <Button onClick={openJoin}>
            <Plus className="size-4" />
            加入班级
          </Button>
        )}
      </div>

      <Card>
        {loading ? (
          <EmptyState text="加载中…" />
        ) : classes.length === 0 ? (
          <EmptyState text={isAdmin ? '暂无班级，点击右上角新建' : '你尚未加入任何班级，点击右上角加入'} />
        ) : (
          <ul className="divide-y divide-border">
            {classes.map((c) => (
              <li key={c.id} className="flex items-center justify-between px-5 py-4">
                <div className="flex items-center gap-3">
                  <span className="font-medium">{classLabel(c)}</span>
                  <span className="text-sm text-muted-foreground">{c.studentCount} 名学生</span>
                </div>
                {isAdmin ? (
                  <Button variant="ghost" size="sm" onClick={() => setDeleteTarget(c)}>
                    删除
                  </Button>
                ) : (
                  <Button variant="ghost" size="sm" onClick={() => setLeaveTarget(c)}>
                    退出班级
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* 单个新建班级 */}
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

      {/* 批量创建班级 */}
      <Dialog open={batchOpen} onOpenChange={setBatchOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>批量创建班级</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="batchEntryYear">入学年份</Label>
              <Input
                id="batchEntryYear"
                type="number"
                value={batchForm.entryYear}
                onChange={(e) => setBatchForm({ ...batchForm, entryYear: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>学部</Label>
              <Select
                value={batchForm.department}
                onValueChange={(value) =>
                  setBatchForm({ ...batchForm, department: value as DepartmentCode })
                }
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
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="batchCount">班级数量</Label>
                <Input
                  id="batchCount"
                  type="number"
                  placeholder="例如 12"
                  value={batchForm.count}
                  onChange={(e) => setBatchForm({ ...batchForm, count: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="batchStartFrom">起始班级号</Label>
                <Input
                  id="batchStartFrom"
                  type="number"
                  placeholder="默认 1"
                  value={batchForm.startFrom}
                  onChange={(e) => setBatchForm({ ...batchForm, startFrom: e.target.value })}
                />
              </div>
            </div>
            {batchForm.count && !Number.isNaN(Number(batchForm.count)) && (
              <p className="text-xs text-muted-foreground">
                将从 {Number(batchForm.startFrom) || 1} 班起创建 {batchForm.count} 个班级；已存在的班级将自动跳过。
              </p>
            )}
            {batchError && <p className="text-sm text-destructive">{batchError}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBatchOpen(false)}>
              取消
            </Button>
            <Button onClick={handleBatchCreate}>创建</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 加入班级 */}
      <Dialog open={joinOpen} onOpenChange={(open) => !open && setJoinOpen(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>加入班级</DialogTitle>
          </DialogHeader>
          {joinLoading ? (
            <div className="flex items-center justify-center gap-2 py-8">
              <Spinner className="size-5" /> 正在加载…
            </div>
          ) : available.length === 0 ? (
            <EmptyState text="暂无可用班级，请等待管理员创建" />
          ) : (
            <ul className="max-h-96 divide-y divide-border overflow-y-auto">
              {available.map((c) => (
                <li key={c.id} className="flex items-center justify-between px-2 py-3">
                  <div className="flex items-center gap-3">
                    <span className="font-medium">{classLabel(c)}</span>
                    <span className="text-sm text-muted-foreground">{c.studentCount} 名学生</span>
                  </div>
                  <Button
                    variant={c.joined ? 'outline' : 'default'}
                    size="sm"
                    onClick={() => toggleJoin(c)}
                  >
                    {c.joined ? '退出' : '加入'}
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={deleteTarget !== null}
        title="删除班级"
        description={deleteTarget ? `确定删除班级「${classLabel(deleteTarget)}」？` : undefined}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        onConfirm={handleDelete}
      />

      <ConfirmDialog
        open={leaveTarget !== null}
        title="退出班级"
        description={leaveTarget ? `确定退出班级「${classLabel(leaveTarget)}」？退出后需重新加入才能管理其学生与作业。` : undefined}
        confirmText="退出"
        onOpenChange={(open) => !open && setLeaveTarget(null)}
        onConfirm={handleLeave}
      />
    </div>
  );
}
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { ChevronRight, Plus } from 'lucide-react';
import { DEPARTMENT_LABELS, type AssignmentDto, type AssignmentStatus, type ClassDto } from '@handyin/types';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { useCurrentClass } from '../lib/current-class';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ConfirmDialog } from '@/components/confirm-dialog';
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

const STATUS_LABEL: Record<AssignmentStatus, string> = {
  DRAFT: '草稿',
  COLLECTING: '收取中',
  FINISHED: '已结束',
};

const STATUS_COLOR: Record<AssignmentStatus, 'slate' | 'green' | 'amber'> = {
  DRAFT: 'slate',
  COLLECTING: 'green',
  FINISHED: 'amber',
};

export default function Assignments() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isTeacher = user?.role === 'TEACHER';
  const isAdmin = user?.role === 'ADMIN';
  const isRep = user?.role === 'REPRESENTATIVE';
  const canDelete = isTeacher || isAdmin;
  const canCreate = isTeacher || isAdmin;
  const { currentClassId } = useCurrentClass();
  const [assignments, setAssignments] = useState<AssignmentDto[]>([]);
  const [classes, setClasses] = useState<ClassDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<AssignmentDto | null>(null);
  const [form, setForm] = useState({ classId: '', title: '', description: '' });

  const load = async () => {
    const d = await api.get<{ assignments: AssignmentDto[] }>('/assignments');
    setAssignments(d.assignments);
  };

  useEffect(() => {
    Promise.all([
      load(),
      api.get<{ classes: ClassDto[] }>('/classes').then((d) => setClasses(d.classes)),
    ]).finally(() => setLoading(false));
  }, []);

  const visibleAssignments =
    (isTeacher || isRep) && currentClassId
      ? assignments.filter((a) => a.classId === currentClassId)
      : assignments;

  const currentClass = classes.find((c) => c.id === currentClassId);

  const handleCreate = async () => {
    setError('');
    try {
      await api.post('/assignments', {
        classId: form.classId,
        title: form.title,
        description: form.description || undefined,
      });
      setOpen(false);
      setForm({ classId: '', title: '', description: '' });
      await load();
      toast.success('作业创建成功');
    } catch (err) {
      setError(err instanceof Error ? err.message : '创建失败');
    }
  };

  const openCreate = () => {
    setForm((f) => ({ ...f, classId: isTeacher && currentClassId ? currentClassId : f.classId }));
    setOpen(true);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await api.del(`/assignments/${deleteTarget.id}`);
      toast.success('作业已删除');
      setDeleteTarget(null);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '删除失败');
    }
  };

  const classLabel = (c: ClassDto) => `${c.entryYear}级${DEPARTMENT_LABELS[c.department]}${c.classNumber}班`;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">作业</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {isRep
              ? '查看并收取你所在班级的作业。'
              : (isTeacher && currentClass
                  ? `${classLabel(currentClass)} · 创建作业并实时统计收取进度。`
                  : '创建作业并实时统计收取进度。')}
          </p>
        </div>
        {canCreate && (
          <Button onClick={openCreate}>
            <Plus className="size-4" />
            新建作业
          </Button>
        )}
      </div>

      <Card>
        {loading ? (
          <EmptyState text="加载中…" />
        ) : visibleAssignments.length === 0 ? (
          <EmptyState text="暂无作业，点击右上角新建" />
        ) : (
          <ul className="divide-y divide-border">
            {visibleAssignments.map((a) => (
              <li
                key={a.id}
                className="group flex cursor-pointer items-center justify-between px-5 py-4 transition-colors hover:bg-muted/50"
                onClick={() => navigate(`/assignments/${a.id}`)}
              >
                <div className="flex items-center gap-3">
                  <span className="font-medium">{a.title}</span>
                  <Badge variant={STATUS_COLOR[a.status]}>{STATUS_LABEL[a.status]}</Badge>
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span>
                    {a.submittedCount ?? 0} / {a.totalCount ?? 0}
                  </span>
                  {canDelete && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeleteTarget(a);
                      }}
                    >
                      删除
                    </Button>
                  )}
                  <ChevronRight className="size-4 text-muted-foreground/50 transition-transform group-hover:translate-x-0.5" />
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>新建作业</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>班级</Label>
              <Select value={form.classId} onValueChange={(value) => setForm({ ...form, classId: value })}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="请选择班级" />
                </SelectTrigger>
                <SelectContent>
                  {classes.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {classLabel(c)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="title">作业标题</Label>
              <Input
                id="title"
                placeholder="例如：数学 · 第7次作业"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">说明（可选）</Label>
              <Textarea
                id="description"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              取消
            </Button>
            <Button onClick={handleCreate} disabled={!form.classId || !form.title}>
              创建
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={deleteTarget !== null}
        title="删除作业"
        description={deleteTarget ? `确定删除作业「${deleteTarget.title}」？该作业下的收取记录将一并删除。` : undefined}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        onConfirm={handleDelete}
      />
    </div>
  );
}

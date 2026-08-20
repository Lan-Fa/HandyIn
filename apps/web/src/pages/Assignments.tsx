import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { AssignmentDto, AssignmentStatus, ClassDto } from '@handyin/types';
import { api } from '../lib/api';
import { Badge, Button, Card, EmptyState, Input, Label, Modal, Select, Textarea } from '../components/ui';

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
  const [assignments, setAssignments] = useState<AssignmentDto[]>([]);
  const [classes, setClasses] = useState<ClassDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState('');
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
    } catch (err) {
      setError(err instanceof Error ? err.message : '创建失败');
    }
  };

  const classLabel = (c: ClassDto) => `${c.entryYear}级${c.department}部${c.classNumber}班`;

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold">作业</h2>
        <Button onClick={() => setOpen(true)}>新建作业</Button>
      </div>

      <Card>
        {loading ? (
          <EmptyState text="加载中…" />
        ) : assignments.length === 0 ? (
          <EmptyState text="暂无作业" />
        ) : (
          <ul className="divide-y divide-slate-100">
            {assignments.map((a) => (
              <li
                key={a.id}
                className="flex cursor-pointer items-center justify-between px-4 py-3 hover:bg-slate-50"
                onClick={() => navigate(`/assignments/${a.id}`)}
              >
                <div>
                  <span className="font-medium">{a.title}</span>
                  <span className="ml-3">
                    <Badge color={STATUS_COLOR[a.status]}>{STATUS_LABEL[a.status]}</Badge>
                  </span>
                </div>
                <div className="text-sm text-slate-500">
                  {a.submittedCount ?? 0} / {a.totalCount ?? 0}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Modal open={open} title="新建作业" onClose={() => setOpen(false)}>
        <div className="space-y-4">
          <div>
            <Label>班级</Label>
            <Select value={form.classId} onChange={(e) => setForm({ ...form, classId: e.target.value })}>
              <option value="">请选择班级</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {classLabel(c)}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label>作业标题</Label>
            <Input
              placeholder="例如：数学 · 第7次作业"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
            />
          </div>
          <div>
            <Label>说明（可选）</Label>
            <Textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setOpen(false)}>
              取消
            </Button>
            <Button onClick={handleCreate} disabled={!form.classId || !form.title}>
              创建
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

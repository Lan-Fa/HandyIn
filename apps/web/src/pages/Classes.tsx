import { useEffect, useState } from 'react';
import { DEPARTMENT_CODES, DEPARTMENT_LABELS, type ClassDto, type DepartmentCode } from '@handyin/types';
import { api } from '../lib/api';
import { Button, Card, EmptyState, Input, Label, Modal, Select } from '../components/ui';

export default function Classes() {
  const [classes, setClasses] = useState<ClassDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState('');
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
    } catch (err) {
      setError(err instanceof Error ? err.message : '创建失败');
    }
  };

  const handleDelete = async (id: string, label: string) => {
    if (!confirm(`确定删除班级「${label}」？`)) return;
    try {
      await api.del(`/classes/${id}`);
      await load();
    } catch (err) {
      alert(err instanceof Error ? err.message : '删除失败');
    }
  };

  const classLabel = (c: ClassDto) =>
    `${c.entryYear}级${DEPARTMENT_LABELS[c.department]}${c.classNumber}班`;

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold">班级管理</h2>
        <Button onClick={() => setOpen(true)}>新建班级</Button>
      </div>

      <Card>
        {loading ? (
          <EmptyState text="加载中…" />
        ) : classes.length === 0 ? (
          <EmptyState text="暂无班级，点击右上角新建" />
        ) : (
          <ul className="divide-y divide-slate-100">
            {classes.map((c) => (
              <li key={c.id} className="flex items-center justify-between px-4 py-3">
                <div>
                  <span className="font-medium">{classLabel(c)}</span>
                  <span className="ml-3 text-sm text-slate-500">{c.studentCount} 名学生</span>
                </div>
                <Button variant="ghost" onClick={() => handleDelete(c.id, classLabel(c))}>
                  删除
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Modal open={open} title="新建班级" onClose={() => setOpen(false)}>
        <div className="space-y-4">
          <div>
            <Label>入学年份</Label>
            <Input
              type="number"
              value={form.entryYear}
              onChange={(e) => setForm({ ...form, entryYear: e.target.value })}
            />
          </div>
          <div>
            <Label>学部</Label>
            <Select
              value={form.department}
              onChange={(e) => setForm({ ...form, department: e.target.value as DepartmentCode })}
            >
              {DEPARTMENT_CODES.map((code) => (
                <option key={code} value={code}>
                  {DEPARTMENT_LABELS[code]}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label>班级编号</Label>
            <Input
              type="number"
              placeholder="例如 2"
              value={form.classNumber}
              onChange={(e) => setForm({ ...form, classNumber: e.target.value })}
            />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setOpen(false)}>
              取消
            </Button>
            <Button onClick={handleCreate}>创建</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

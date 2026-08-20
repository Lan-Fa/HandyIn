import { useEffect, useState } from 'react';
import type { Role } from '@handyin/types';
import { api } from '../lib/api';
import { Badge, Button, Card, EmptyState, Input, Label, Modal, Select } from '../components/ui';

interface UserRow {
  id: string;
  username: string;
  name: string | null;
  role: Role;
  createdAt: string;
}

export default function Users() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ username: '', password: '', name: '', role: 'REPRESENTATIVE' as Role });

  const load = async () => {
    const d = await api.get<{ users: UserRow[] }>('/users');
    setUsers(d.users);
  };

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, []);

  const handleCreate = async () => {
    setError('');
    try {
      await api.post('/users', {
        username: form.username,
        password: form.password,
        name: form.name || undefined,
        role: form.role,
      });
      setOpen(false);
      setForm({ username: '', password: '', name: '', role: 'REPRESENTATIVE' });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : '创建失败');
    }
  };

  const handleDelete = async (id: string, username: string) => {
    if (!confirm(`确定删除用户「${username}」？`)) return;
    try {
      await api.del(`/users/${id}`);
      await load();
    } catch (err) {
      alert(err instanceof Error ? err.message : '删除失败');
    }
  };

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold">用户管理</h2>
        <Button onClick={() => setOpen(true)}>新建用户</Button>
      </div>

      <Card>
        {loading ? (
          <EmptyState text="加载中…" />
        ) : users.length === 0 ? (
          <EmptyState text="暂无用户" />
        ) : (
          <ul className="divide-y divide-slate-100">
            {users.map((u) => (
              <li key={u.id} className="flex items-center justify-between px-4 py-3">
                <div>
                  <span className="font-medium">{u.name || u.username}</span>
                  <span className="ml-2 text-sm text-slate-400">@{u.username}</span>
                  <span className="ml-3">
                    <Badge color={u.role === 'TEACHER' ? 'indigo' : 'amber'}>
                      {u.role === 'TEACHER' ? '教师' : '课代表'}
                    </Badge>
                  </span>
                </div>
                <Button variant="ghost" onClick={() => handleDelete(u.id, u.username)}>
                  删除
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Modal open={open} title="新建用户" onClose={() => setOpen(false)}>
        <div className="space-y-4">
          <div>
            <Label>角色</Label>
            <Select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as Role })}>
              <option value="TEACHER">教师</option>
              <option value="REPRESENTATIVE">课代表</option>
            </Select>
          </div>
          <div>
            <Label>用户名</Label>
            <Input value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} />
          </div>
          <div>
            <Label>姓名（可选）</Label>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div>
            <Label>初始密码</Label>
            <Input
              type="password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              placeholder="至少 8 位"
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

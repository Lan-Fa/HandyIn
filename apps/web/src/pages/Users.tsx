import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Plus } from 'lucide-react';
import type { ColumnDef } from '@tanstack/react-table';
import { ROLE_LABELS, type Role } from '@handyin/types';
import { api } from '../lib/api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DataTable } from '@/components/ui/data-table';
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

interface UserRow {
  id: string;
  username: string;
  name: string | null;
  role: Role;
  createdAt: string;
}

const ROLE_VARIANT: Record<Role, 'red' | 'indigo' | 'amber'> = {
  ADMIN: 'red',
  TEACHER: 'indigo',
  REPRESENTATIVE: 'amber',
};

export default function Users() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<UserRow | null>(null);
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
      toast.success('用户创建成功');
    } catch (err) {
      setError(err instanceof Error ? err.message : '创建失败');
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await api.del(`/users/${deleteTarget.id}`);
      toast.success('用户已删除');
      setDeleteTarget(null);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '删除失败');
    }
  };

  const columns: ColumnDef<UserRow>[] = [
    {
      accessorKey: 'username',
      header: '用户',
      cell: ({ row }) => (
        <div>
          <div className="font-medium">{row.original.name || row.original.username}</div>
          <div className="text-xs text-muted-foreground">@{row.original.username}</div>
        </div>
      ),
    },
    {
      accessorKey: 'role',
      header: '角色',
      cell: ({ row }) => (
        <Badge variant={ROLE_VARIANT[row.original.role]}>
          {ROLE_LABELS[row.original.role]}
        </Badge>
      ),
    },
    {
      id: 'actions',
      header: () => <span className="sr-only">操作</span>,
      cell: ({ row }) => (
        <div className="text-right">
          <Button variant="ghost" size="sm" onClick={() => setDeleteTarget(row.original)}>
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
          <h1 className="text-xl font-semibold tracking-tight">用户管理</h1>
          <p className="mt-1 text-sm text-muted-foreground">管理教师与课代表账号。</p>
        </div>
        <Button onClick={() => setOpen(true)}>
          <Plus className="size-4" />
          新建用户
        </Button>
      </div>

      <DataTable
        columns={columns}
        data={users}
        searchPlaceholder="搜索用户名或姓名…"
        searchKeys={['username', 'name']}
        emptyText={loading ? '加载中…' : '暂无用户'}
      />

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>新建用户</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>角色</Label>
              <Select
                value={form.role}
                onValueChange={(value) => setForm({ ...form, role: value as Role })}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ADMIN">管理员</SelectItem>
                  <SelectItem value="TEACHER">教师</SelectItem>
                  <SelectItem value="REPRESENTATIVE">课代表</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="username">用户名</Label>
              <Input
                id="username"
                value={form.username}
                onChange={(e) => setForm({ ...form, username: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="name">姓名（可选）</Label>
              <Input
                id="name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">初始密码</Label>
              <Input
                id="password"
                type="password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                placeholder="至少 8 位"
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
        title="删除用户"
        description={deleteTarget ? `确定删除用户「${deleteTarget.username}」？` : undefined}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        onConfirm={handleDelete}
      />
    </div>
  );
}

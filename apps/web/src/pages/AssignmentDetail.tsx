import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { QrCode, UserPlus } from 'lucide-react';
import type { AssignmentDto, AssignmentStats } from '@handyin/types';
import { api, wsUrl } from '../lib/api';
import { useAuth } from '../lib/auth';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Spinner } from '@/components/ui/spinner';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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

interface SubmissionRow {
  studentId: string;
  name: string;
  studentNumber: string;
  numberInClass: number;
  submittedAt?: string;
  operatorName?: string;
  submissionId?: string;
}

interface RepRow {
  id: string;
  userId: string;
  username: string;
  name: string | null;
  expiresAt: string | null;
  active: boolean;
}

interface UserRow {
  id: string;
  username: string;
  name: string | null;
  role: string;
}

const STATUS_LABEL: Record<string, string> = {
  DRAFT: '草稿',
  COLLECTING: '收取中',
  FINISHED: '已结束',
};

export default function AssignmentDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isTeacher = user?.role === 'TEACHER';

  const [assignment, setAssignment] = useState<AssignmentDto | null>(null);
  const [stats, setStats] = useState<AssignmentStats | null>(null);
  const [submitted, setSubmitted] = useState<SubmissionRow[]>([]);
  const [unsubmitted, setUnsubmitted] = useState<SubmissionRow[]>([]);
  const [tab, setTab] = useState<'submitted' | 'unsubmitted'>('unsubmitted');
  const [loading, setLoading] = useState(true);

  const [reps, setReps] = useState<RepRow[]>([]);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [repOpen, setRepOpen] = useState(false);
  const [repUserId, setRepUserId] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<SubmissionRow | null>(null);

  const loadStats = useCallback(async () => {
    const d = await api.get<{ stats: AssignmentStats; submitted: SubmissionRow[]; unsubmitted: SubmissionRow[] }>(
      `/assignments/${id}/stats`,
    );
    setStats(d.stats);
    setSubmitted(d.submitted);
    setUnsubmitted(d.unsubmitted);
  }, [id]);

  const loadReps = useCallback(async () => {
    const d = await api.get<{ reps: RepRow[] }>(`/assignments/${id}/reps`);
    setReps(d.reps);
  }, [id]);

  useEffect(() => {
    Promise.all([
      api.get<{ assignment: AssignmentDto }>(`/assignments/${id}`).then((d) => setAssignment(d.assignment)),
      loadStats(),
      ...(isTeacher ? [loadReps(), api.get<{ users: UserRow[] }>('/users').then((d) => setUsers(d.users))] : []),
    ]).finally(() => setLoading(false));
  }, [id, isTeacher, loadStats, loadReps]);

  useEffect(() => {
    const ws = new WebSocket(wsUrl(id!));
    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg?.type === 'submission' || msg?.type === 'submission_deleted') {
          if (msg.stats) {
            setStats(msg.stats);
            setAssignment((prev) =>
              prev ? { ...prev, submittedCount: msg.stats.submitted, totalCount: msg.stats.total } : prev,
            );
          }
          loadStats();
        }
      } catch {
        /* ignore */
      }
    };
    return () => ws.close();
  }, [id, loadStats]);

  const setStatus = async (status: AssignmentDto['status']) => {
    await api.put(`/assignments/${id}`, { status });
    const d = await api.get<{ assignment: AssignmentDto }>(`/assignments/${id}`);
    setAssignment(d.assignment);
  };

  const grantRep = async () => {
    try {
      await api.post(`/assignments/${id}/reps`, { userId: repUserId });
      setRepOpen(false);
      setRepUserId('');
      await loadReps();
      toast.success('授权成功');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '授权失败');
    }
  };

  const revokeRep = async (userId: string) => {
    await api.del(`/assignments/${id}/reps/${userId}`);
    await loadReps();
  };

  const deleteSubmission = async () => {
    if (!deleteTarget?.submissionId) return;
    try {
      await api.del(`/submissions/${deleteTarget.submissionId}`);
      toast.success('收取记录已删除');
      setDeleteTarget(null);
      await loadStats();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '删除失败');
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Spinner className="size-8" />
      </div>
    );
  }

  if (!assignment) return <EmptyState text="作业不存在" />;

  const repCandidates = users.filter((u) => u.role === 'REPRESENTATIVE');

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">{assignment.title}</h1>
          <div className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
            <Badge
              variant={
                assignment.status === 'COLLECTING'
                  ? 'green'
                  : assignment.status === 'FINISHED'
                    ? 'amber'
                    : 'slate'
              }
            >
              {STATUS_LABEL[assignment.status]}
            </Badge>
            {assignment.description && <span>{assignment.description}</span>}
          </div>
        </div>
        <div className="flex shrink-0 gap-2">
          <Button onClick={() => navigate(`/scan/${assignment.id}`)}>
            <QrCode className="size-4" />
            开始扫码
          </Button>
          {isTeacher && assignment.status === 'DRAFT' && (
            <Button variant="outline" onClick={() => setStatus('COLLECTING')}>
              开始收取
            </Button>
          )}
          {isTeacher && assignment.status === 'COLLECTING' && (
            <Button variant="outline" onClick={() => setStatus('FINISHED')}>
              结束收取
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="py-4 text-center">
            <div className="text-2xl font-semibold">{stats?.total ?? 0}</div>
            <div className="mt-1 text-sm text-muted-foreground">总人数</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4 text-center">
            <div className="text-2xl font-semibold text-emerald-600">{stats?.submitted ?? 0}</div>
            <div className="mt-1 text-sm text-muted-foreground">已交</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4 text-center">
            <div className="text-2xl font-semibold text-destructive">{stats?.unsubmitted ?? 0}</div>
            <div className="mt-1 text-sm text-muted-foreground">未交</div>
          </CardContent>
        </Card>
      </div>

      <Tabs value={tab} onValueChange={(value) => setTab(value as 'submitted' | 'unsubmitted')}>
        <TabsList>
          <TabsTrigger value="unsubmitted">未交（{unsubmitted.length}）</TabsTrigger>
          <TabsTrigger value="submitted">已交（{submitted.length}）</TabsTrigger>
        </TabsList>
        <TabsContent value="unsubmitted">
          <Card>
            {unsubmitted.length === 0 ? (
              <EmptyState text="全部已交" />
            ) : (
              <ul className="divide-y divide-border">
                {unsubmitted.map((s) => (
                  <li key={s.studentId} className="flex items-center justify-between px-5 py-3">
                    <span>
                      <span className="text-muted-foreground">{String(s.numberInClass).padStart(2, '0')}号</span>
                      <span className="ml-2 font-medium">{s.name}</span>
                    </span>
                    <span className="font-mono text-sm text-muted-foreground">{s.studentNumber}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </TabsContent>
        <TabsContent value="submitted">
          <Card>
            {submitted.length === 0 ? (
              <EmptyState text="尚未收取" />
            ) : (
              <ul className="divide-y divide-border">
                {submitted.map((s) => (
                  <li key={s.studentId} className="flex items-center justify-between px-5 py-3">
                    <span>
                      <span className="text-muted-foreground">{String(s.numberInClass).padStart(2, '0')}号</span>
                      <span className="ml-2 font-medium">{s.name}</span>
                    </span>
                    <span className="flex items-center gap-3">
                      <span className="text-xs text-muted-foreground">
                        {s.submittedAt ? new Date(s.submittedAt).toLocaleTimeString() : ''} · {s.operatorName}
                      </span>
                      {isTeacher && s.submissionId && (
                        <Button variant="ghost" size="sm" onClick={() => setDeleteTarget(s)}>
                          删除
                        </Button>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </TabsContent>
      </Tabs>

      {isTeacher && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-medium">课代表授权</h2>
              <p className="mt-1 text-sm text-muted-foreground">授权课代表扫码收取该作业。</p>
            </div>
            <Button variant="outline" onClick={() => setRepOpen(true)}>
              <UserPlus className="size-4" />
              授权课代表
            </Button>
          </div>
          <Card>
            {reps.length === 0 ? (
              <EmptyState text="尚未授权课代表" />
            ) : (
              <ul className="divide-y divide-border">
                {reps.map((r) => (
                  <li key={r.id} className="flex items-center justify-between px-5 py-3">
                    <span>
                      <span className="font-medium">{r.name || r.username}</span>
                      <span className="ml-2 text-sm text-muted-foreground">@{r.username}</span>
                      <span className="ml-2">
                        <Badge variant={r.active ? 'green' : 'slate'}>{r.active ? '有效' : '已过期'}</Badge>
                      </span>
                    </span>
                    <Button variant="ghost" size="sm" onClick={() => revokeRep(r.userId)}>
                      取消授权
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      )}

      <Dialog open={repOpen} onOpenChange={setRepOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>授权课代表</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {repCandidates.length === 0 ? (
              <p className="text-sm text-muted-foreground">没有可授权的课代表，请先在「用户」中创建课代表账号。</p>
            ) : (
              <Select value={repUserId} onValueChange={setRepUserId}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="请选择课代表" />
                </SelectTrigger>
                <SelectContent>
                  {repCandidates.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.name || u.username}（@{u.username}）
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRepOpen(false)}>
              取消
            </Button>
            <Button onClick={grantRep} disabled={!repUserId}>
              授权
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={deleteTarget !== null}
        title="删除收取记录"
        description={deleteTarget ? `确定删除「${deleteTarget.name}」的收取记录？` : undefined}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        onConfirm={deleteSubmission}
      />
    </div>
  );
}

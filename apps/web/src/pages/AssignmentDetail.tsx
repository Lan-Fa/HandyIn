import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import type { AssignmentDto, AssignmentStats } from '@handyin/types';
import { api, wsUrl } from '../lib/api';
import { useAuth } from '../lib/auth';
import { Badge, Button, Card, EmptyState, Modal, Select, Spinner } from '../components/ui';

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
    } catch (err) {
      alert(err instanceof Error ? err.message : '授权失败');
    }
  };

  const revokeRep = async (userId: string) => {
    await api.del(`/assignments/${id}/reps/${userId}`);
    await loadReps();
  };

  const deleteSubmission = async (submissionId: string, name: string) => {
    if (!confirm(`确定删除「${name}」的收取记录？`)) return;
    try {
      await api.del(`/submissions/${submissionId}`);
      await loadStats();
    } catch (err) {
      alert(err instanceof Error ? err.message : '删除失败');
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Spinner className="h-8 w-8" />
      </div>
    );
  }

  if (!assignment) return <EmptyState text="作业不存在" />;

  const repCandidates = users.filter((u) => u.role === 'REPRESENTATIVE');

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-xl font-semibold">{assignment.title}</h2>
          <div className="mt-1 flex items-center gap-2 text-sm text-slate-500">
            <Badge color={assignment.status === 'COLLECTING' ? 'green' : assignment.status === 'FINISHED' ? 'amber' : 'slate'}>
              {STATUS_LABEL[assignment.status]}
            </Badge>
            <span>{assignment.description}</span>
          </div>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => navigate(`/scan/${assignment.id}`)}>开始扫码</Button>
          {isTeacher && assignment.status === 'DRAFT' && (
            <Button variant="secondary" onClick={() => setStatus('COLLECTING')}>
              开始收取
            </Button>
          )}
          {isTeacher && assignment.status === 'COLLECTING' && (
            <Button variant="secondary" onClick={() => setStatus('FINISHED')}>
              结束收取
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Card className="p-4 text-center">
          <div className="text-2xl font-semibold">{stats?.total ?? 0}</div>
          <div className="text-sm text-slate-500">总人数</div>
        </Card>
        <Card className="p-4 text-center">
          <div className="text-2xl font-semibold text-emerald-600">{stats?.submitted ?? 0}</div>
          <div className="text-sm text-slate-500">已交</div>
        </Card>
        <Card className="p-4 text-center">
          <div className="text-2xl font-semibold text-red-600">{stats?.unsubmitted ?? 0}</div>
          <div className="text-sm text-slate-500">未交</div>
        </Card>
      </div>

      <div>
        <div className="mb-2 flex gap-2">
          <Button variant={tab === 'unsubmitted' ? 'primary' : 'secondary'} onClick={() => setTab('unsubmitted')}>
            未交（{unsubmitted.length}）
          </Button>
          <Button variant={tab === 'submitted' ? 'primary' : 'secondary'} onClick={() => setTab('submitted')}>
            已交（{submitted.length}）
          </Button>
        </div>
        <Card>
          {tab === 'unsubmitted' ? (
            unsubmitted.length === 0 ? (
              <EmptyState text="全部已交" />
            ) : (
              <ul className="divide-y divide-slate-100">
                {unsubmitted.map((s) => (
                  <li key={s.studentId} className="flex items-center justify-between px-4 py-2">
                    <span>
                      <span className="text-slate-400">{String(s.numberInClass).padStart(2, '0')}号</span>
                      <span className="ml-2">{s.name}</span>
                    </span>
                    <span className="font-mono text-sm text-slate-400">{s.studentNumber}</span>
                  </li>
                ))}
              </ul>
            )
          ) : submitted.length === 0 ? (
            <EmptyState text="尚未收取" />
          ) : (
            <ul className="divide-y divide-slate-100">
              {submitted.map((s) => (
                <li key={s.studentId} className="flex items-center justify-between px-4 py-2">
                  <span>
                    <span className="text-slate-400">{String(s.numberInClass).padStart(2, '0')}号</span>
                    <span className="ml-2">{s.name}</span>
                  </span>
                  <span className="flex items-center gap-3">
                    <span className="text-xs text-slate-400">
                      {s.submittedAt ? new Date(s.submittedAt).toLocaleTimeString() : ''} · {s.operatorName}
                    </span>
                    {isTeacher && s.submissionId && (
                      <Button variant="ghost" onClick={() => deleteSubmission(s.submissionId!, s.name)}>
                        删除
                      </Button>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {isTeacher && (
        <div>
          <div className="mb-2 flex items-center justify-between">
            <h3 className="font-medium">课代表授权</h3>
            <Button variant="secondary" onClick={() => setRepOpen(true)}>
              授权课代表
            </Button>
          </div>
          <Card>
            {reps.length === 0 ? (
              <EmptyState text="尚未授权课代表" />
            ) : (
              <ul className="divide-y divide-slate-100">
                {reps.map((r) => (
                  <li key={r.id} className="flex items-center justify-between px-4 py-2">
                    <span>
                      {r.name || r.username}
                      <span className="ml-2 text-sm text-slate-400">@{r.username}</span>
                      <span className="ml-2">
                        <Badge color={r.active ? 'green' : 'slate'}>{r.active ? '有效' : '已过期'}</Badge>
                      </span>
                    </span>
                    <Button variant="ghost" onClick={() => revokeRep(r.userId)}>
                      取消授权
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      )}

      <Modal open={repOpen} title="授权课代表" onClose={() => setRepOpen(false)}>
        <div className="space-y-4">
          {repCandidates.length === 0 ? (
            <p className="text-sm text-slate-500">没有可授权的课代表，请先在「用户」中创建课代表账号。</p>
          ) : (
            <Select value={repUserId} onChange={(e) => setRepUserId(e.target.value)}>
              <option value="">请选择课代表</option>
              {repCandidates.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name || u.username}（@{u.username}）
                </option>
              ))}
            </Select>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setRepOpen(false)}>
              取消
            </Button>
            <Button onClick={grantRep} disabled={!repUserId}>
              授权
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

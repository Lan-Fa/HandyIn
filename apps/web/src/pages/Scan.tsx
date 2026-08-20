import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { BrowserMultiFormatReader, type IScannerControls } from '@zxing/browser';
import type { AssignmentDto, AssignmentStats } from '@handyin/types';
import { api, wsUrl } from '../lib/api';
import { enqueuePending, getPending, removePending, type PendingSubmission } from '../lib/offline';

interface ScanResponse {
  status: 'submitted' | 'duplicate';
  student: { name: string; numberInClass: number; studentNumber: string };
  submittedAt: string;
  operatorName: string;
  stats: AssignmentStats;
}

interface LastResult {
  kind: 'success' | 'duplicate' | 'error' | 'queued';
  text: string;
}

function playTone(kind: 'success' | 'duplicate' | 'error'): void {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    if (kind === 'success') {
      osc.frequency.value = 880;
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.18);
      osc.start();
      osc.stop(ctx.currentTime + 0.2);
    } else if (kind === 'duplicate') {
      osc.frequency.value = 440;
      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
      osc.start();
      osc.stop(ctx.currentTime + 0.3);
    } else {
      osc.frequency.value = 220;
      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
      osc.start();
      osc.stop(ctx.currentTime + 0.35);
    }
  } catch {
    /* 音频不可用时忽略 */
  }
}

function vibrate(kind: 'success' | 'duplicate' | 'error'): void {
  try {
    if (kind === 'success') navigator.vibrate?.(80);
    else if (kind === 'duplicate') navigator.vibrate?.([60, 40, 60]);
    else navigator.vibrate?.(200);
  } catch {
    /* ignore */
  }
}

export default function Scan() {
  const { assignmentId } = useParams<{ assignmentId: string }>();
  const navigate = useNavigate();
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const processingRef = useRef(false);
  const lastTokenRef = useRef<{ token: string; time: number }>({ token: '', time: 0 });

  const [assignment, setAssignment] = useState<AssignmentDto | null>(null);
  const [stats, setStats] = useState<AssignmentStats | null>(null);
  const [last, setLast] = useState<LastResult | null>(null);
  const [pendingCount, setPendingCount] = useState(0);
  const [error, setError] = useState('');

  const submit = useCallback(
    async (token: string): Promise<'success' | 'duplicate' | 'error' | 'queued'> => {
      try {
        const d = await api.post<ScanResponse>('/submissions', { assignmentId, qrToken: token });
        setStats(d.stats);
        setAssignment((prev) =>
          prev ? { ...prev, submittedCount: d.stats.submitted, totalCount: d.stats.total } : prev,
        );
        if (d.status === 'duplicate') {
          setLast({ kind: 'duplicate', text: `${d.student.name} 已收` });
          return 'duplicate';
        }
        setLast({ kind: 'success', text: `${d.student.numberInClass}号 ${d.student.name}` });
        return 'success';
      } catch (err) {
        const status = (err as { status?: number }).status;
        if (status === 0) {
          await enqueuePending({ assignmentId: assignmentId!, qrToken: token });
          setPendingCount((c) => c + 1);
          setLast({ kind: 'queued', text: '已记录，等待同步' });
          return 'queued';
        }
        setLast({ kind: 'error', text: err instanceof Error ? err.message : '无法识别' });
        return 'error';
      }
    },
    [assignmentId],
  );

  useEffect(() => {
    if (!assignmentId) return;
    api
      .get<{ assignment: AssignmentDto }>(`/assignments/${assignmentId}`)
      .then((d) => setAssignment(d.assignment))
      .catch((err) => setError(err instanceof Error ? err.message : '加载失败'));

    api
      .get<{ stats: AssignmentStats }>(`/assignments/${assignmentId}/stats`)
      .then((d) => setStats(d.stats))
      .catch(() => {});

    getPending().then((items) => setPendingCount(items.filter((i) => i.assignmentId === assignmentId).length));
  }, [assignmentId]);

  // 摄像头启动
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const reader = new BrowserMultiFormatReader();
    let cancelled = false;

    reader
      .decodeFromConstraints(
        { audio: false, video: { facingMode: 'environment' } },
        video,
        (result, _err, controls) => {
          controlsRef.current = controls;
          if (cancelled || !result) return;
          const token = result.getText();
          const now = Date.now();
          if (processingRef.current) return;
          if (token === lastTokenRef.current.token && now - lastTokenRef.current.time < 2500) return;

          lastTokenRef.current = { token, time: now };
          processingRef.current = true;

          submit(token)
            .then((kind) => {
              playTone(kind === 'success' ? 'success' : kind === 'duplicate' ? 'duplicate' : 'error');
              vibrate(kind === 'success' ? 'success' : kind === 'duplicate' ? 'duplicate' : 'error');
            })
            .finally(() => {
              processingRef.current = false;
            });
        },
      )
      .catch(() => {
        if (!cancelled) setError('无法访问摄像头，请检查权限');
      });

    return () => {
      cancelled = true;
      controlsRef.current?.stop();
      controlsRef.current = null;
    };
  }, [submit]);

  // 离线队列重试 + WebSocket 实时同步
  useEffect(() => {
    if (!assignmentId) return;

    const flush = async () => {
      const items = await getPending();
      const mine = items.filter((i) => i.assignmentId === assignmentId);
      for (const item of mine) {
        try {
          const d = await api.post<ScanResponse>('/submissions', {
            assignmentId: item.assignmentId,
            qrToken: item.qrToken,
          });
          setStats(d.stats);
          await removePending(item.id);
          setPendingCount((c) => Math.max(0, c - 1));
        } catch (err) {
          const status = (err as { status?: number }).status;
          if (status === 0) break; // 仍离线
        }
      }
    };

    const timer = setInterval(flush, 5000);
    window.addEventListener('online', flush);

    const ws = new WebSocket(wsUrl(assignmentId));
    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg?.stats) setStats(msg.stats);
      } catch {
        /* ignore */
      }
    };

    return () => {
      clearInterval(timer);
      window.removeEventListener('online', flush);
      ws.close();
    };
  }, [assignmentId]);

  return (
    <div className="flex min-h-full flex-col bg-slate-900 text-white">
      <div className="flex items-center justify-between px-4 py-3">
        <button onClick={() => navigate(-1)} className="text-sm text-slate-300">
          ← 返回
        </button>
        <div className="text-center">
          <div className="font-medium">{assignment?.title ?? '加载中…'}</div>
          <div className="text-sm text-slate-400">
            {stats ? `${stats.submitted} / ${stats.total}` : ''}
          </div>
        </div>
        <div className="text-sm text-slate-400">{pendingCount > 0 ? `待同步 ${pendingCount}` : ''}</div>
      </div>

      <div className="relative mx-auto w-full max-w-md flex-1 overflow-hidden">
        <video ref={videoRef} className="h-full w-full object-cover" muted playsInline />
        {last && (
          <div
            className={`absolute inset-x-0 top-1/2 -translate-y-1/2 mx-auto w-max rounded-lg px-6 py-3 text-center text-lg font-medium ${
              last.kind === 'success'
                ? 'bg-emerald-500/90'
                : last.kind === 'duplicate'
                  ? 'bg-amber-500/90'
                  : last.kind === 'queued'
                    ? 'bg-indigo-500/90'
                    : 'bg-red-500/90'
            }`}
          >
            {last.text}
          </div>
        )}
      </div>

      <div className="px-4 py-3 text-center text-sm text-slate-400">
        {error || '对准学生二维码，自动连续扫描'}
      </div>
    </div>
  );
}

import { useEffect, useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  ClipboardList,
  GraduationCap,
  LogOut,
  Menu,
  School,
  ShieldCheck,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { useAuth } from '../lib/auth';
import { useCurrentClass } from '../lib/current-class';
import { DEPARTMENT_LABELS, ROLE_LABELS, type ClassDto } from '@handyin/types';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';

interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
}

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const isAdmin = user?.role === 'ADMIN';
  const isTeacher = user?.role === 'TEACHER';
  const isRep = user?.role === 'REPRESENTATIVE';
  const { currentClassId, setCurrentClassId, classes } = useCurrentClass();

  useEffect(() => {
    if ((!isTeacher && !isRep) || classes.length === 0) return;
    const first = classes[0]!;
    const valid = classes.some((c) => c.id === currentClassId);
    if (!valid) setCurrentClassId(first.id);
  }, [isTeacher, isRep, classes, currentClassId, setCurrentClassId]);

  const classLabel = (c: ClassDto) =>
    `${c.entryYear}级${DEPARTMENT_LABELS[c.department]}${c.classNumber}班`;

  const navItems: NavItem[] = [
    { to: '/assignments', label: '作业', icon: ClipboardList },
    ...(isAdmin || isTeacher
      ? [
          { to: '/classes', label: '班级', icon: School },
          { to: '/students', label: '学生', icon: Users },
        ]
      : []),
    ...(isAdmin ? [{ to: '/users', label: '用户', icon: ShieldCheck }] : []),
  ];

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const displayName = user?.name || user?.username || '';
  const roleLabel = user ? ROLE_LABELS[user.role] : '';

  const sidebarContent = (
    <>
      <div className="flex h-16 items-center gap-2.5 px-5">
        <div className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <GraduationCap className="size-5" />
        </div>
        <div className="leading-tight">
          <div className="text-sm font-semibold tracking-wide">HandyIn</div>
          <div className="text-xs text-muted-foreground">作业收取系统</div>
        </div>
      </div>
      <Separator />
      {(isTeacher || isRep) && (
        <>
          <div className="p-3">
            <div className="mb-2 px-1 text-xs font-medium text-muted-foreground">当前班级</div>
            <Select value={currentClassId ?? undefined} onValueChange={setCurrentClassId}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="选择班级" />
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
          <Separator />
        </>
      )}
      <nav className="flex-1 space-y-1 overflow-y-auto p-3">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            onClick={() => setMobileOpen(false)}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-secondary text-foreground'
                  : 'text-muted-foreground hover:bg-secondary/60 hover:text-foreground',
              )
            }
          >
            <item.icon className="size-4" />
            {item.label}
          </NavLink>
        ))}
      </nav>
      <Separator />
      <div className="p-3">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-left transition-colors hover:bg-secondary/60">
              <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                {displayName.slice(0, 1).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1 leading-tight">
                <div className="truncate text-sm font-medium">{displayName}</div>
                <div className="text-xs text-muted-foreground">{roleLabel}</div>
              </div>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56" sideOffset={8}>
            <DropdownMenuLabel className="font-normal">
              <div className="text-sm font-medium">{displayName}</div>
              <div className="text-xs text-muted-foreground">@{user?.username}</div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleLogout}>
              <LogOut className="size-4" />
              退出登录
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </>
  );

  return (
    <div className="flex min-h-full">
      {/* 桌面端 Sidebar */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r bg-card lg:flex">
        {sidebarContent}
      </aside>

      {/* 移动端抽屉 */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setMobileOpen(false)} />
          <aside className="absolute inset-y-0 left-0 flex w-64 flex-col bg-card shadow-lg">
            {sidebarContent}
          </aside>
        </div>
      )}

      <div className="flex min-h-full w-full flex-1 flex-col lg:pl-64">
        {/* 移动端顶栏 */}
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b bg-card px-4 lg:hidden">
          <Button variant="ghost" size="icon" onClick={() => setMobileOpen(true)}>
            <Menu className="size-5" />
            <span className="sr-only">打开菜单</span>
          </Button>
          <div className="flex items-center gap-2">
            <GraduationCap className="size-5 text-primary" />
            <span className="text-sm font-semibold">HandyIn</span>
          </div>
        </header>

        <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6 lg:px-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

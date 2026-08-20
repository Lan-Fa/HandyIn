import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { cn } from './ui';

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const isTeacher = user?.role === 'TEACHER';

  const links = [
    { to: '/assignments', label: '作业', show: true },
    { to: '/classes', label: '班级', show: isTeacher },
    { to: '/students', label: '学生', show: isTeacher },
    { to: '/users', label: '用户', show: isTeacher },
  ].filter((l) => l.show);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div className="flex min-h-full flex-col">
      <header className="bg-indigo-600 text-white">
        <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between px-4">
          <div className="flex items-center gap-6">
            <span className="font-semibold tracking-wide">HandyIn</span>
            <nav className="flex items-center gap-1">
              {links.map((l) => (
                <NavLink
                  key={l.to}
                  to={l.to}
                  className={({ isActive }) =>
                    cn(
                      'rounded-md px-3 py-1.5 text-sm transition-colors',
                      isActive ? 'bg-white/20 font-medium' : 'hover:bg-white/10',
                    )
                  }
                >
                  {l.label}
                </NavLink>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-indigo-100">
              {user?.name || user?.username}
              {isTeacher ? '' : '（课代表）'}
            </span>
            <button
              onClick={handleLogout}
              className="rounded-md px-3 py-1.5 text-sm hover:bg-white/10"
            >
              退出
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}

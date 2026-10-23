'use client';

import { useRouter } from 'next/navigation';
import { Menu, Bell, Moon, Sun, LogOut } from 'lucide-react';
import { useTheme } from 'next-themes';
import { Button } from '@/components/ui/button';
import { useAuthStore } from '@/stores/auth-store';
import { useUiStore } from '@/stores/ui-store';

export function Header({ title }: { title: string }) {
  const router = useRouter();
  const { user, logout } = useAuthStore();
  const { toggleSidebar } = useUiStore();
  const { theme, setTheme } = useTheme();

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  return (
    <header className="sticky top-0 z-30 flex h-[4.25rem] items-center justify-between border-b border-border/80 bg-card/80 px-4 backdrop-blur-md lg:px-8">
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          className="lg:hidden"
          onClick={toggleSidebar}
        >
          <Menu className="h-5 w-5" />
        </Button>
        <div className="animate-fade-up">
          <p className="text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            Workspace
          </p>
          <h1 className="text-lg font-semibold tracking-tight text-foreground lg:text-xl">
            {title}
          </h1>
        </div>
      </div>

      <div className="flex items-center gap-1.5 sm:gap-2">
        <Button variant="ghost" size="icon" className="relative text-muted-foreground hover:text-foreground">
          <Bell className="h-4.5 w-4.5 h-[1.15rem] w-[1.15rem]" />
          <span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-primary" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="relative text-muted-foreground hover:text-foreground"
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
        >
          <Sun className="h-[1.15rem] w-[1.15rem] rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
          <Moon className="absolute h-[1.15rem] w-[1.15rem] rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
        </Button>
        <div className="mx-1 hidden h-8 w-px bg-border sm:block" />
        <div className="hidden items-center gap-3 sm:flex">
          <div className="text-right">
            <p className="text-sm font-medium leading-none">{user?.name}</p>
            <p className="mt-1 text-[0.7rem] uppercase tracking-wide text-muted-foreground">
              {user?.role}
            </p>
          </div>
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/12 text-sm font-semibold text-primary">
            {user?.name?.charAt(0) || 'U'}
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="text-muted-foreground hover:text-foreground"
          onClick={handleLogout}
        >
          <LogOut className="h-[1.15rem] w-[1.15rem]" />
        </Button>
      </div>
    </header>
  );
}

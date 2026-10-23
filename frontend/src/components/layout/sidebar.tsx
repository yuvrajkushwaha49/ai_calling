'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Users,
  Building2,
  Phone,
  Calendar,
  Bot,
  BarChart3,
  Building,
  X,
  BookOpen,
  PhoneCall,
  MessageSquare,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { NAV_ITEMS } from '@/lib/constants';
import { useUiStore } from '@/stores/ui-store';

const iconMap = {
  LayoutDashboard,
  Users,
  Building2,
  Phone,
  Calendar,
  Bot,
  BarChart3,
  BookOpen,
  PhoneCall,
  MessageSquare,
};

export function Sidebar() {
  const pathname = usePathname();
  const { sidebarOpen, setSidebarOpen } = useUiStore();

  return (
    <>
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-[hsl(200_28%_10%/0.45)] backdrop-blur-[2px] lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex h-dvh w-64 flex-col border-r border-border/80 bg-card transition-transform duration-300',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
        )}
      >
        <div className="flex h-[4.25rem] items-center justify-between border-b border-border/80 px-5">
          <Link href="/dashboard" className="group flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground transition-transform duration-300 group-hover:scale-[1.03]">
              <Building className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[0.95rem] font-semibold tracking-tight text-foreground">
                RealEstate
              </p>
              <p className="text-[0.7rem] font-medium uppercase tracking-[0.08em] text-muted-foreground">
                AI Calling CRM
              </p>
            </div>
          </Link>
          <button
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground lg:hidden"
            onClick={() => setSidebarOpen(false)}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-1 space-y-0.5 overflow-y-auto p-3">
          {NAV_ITEMS.map((item) => {
            const Icon = iconMap[item.icon as keyof typeof iconMap];
            const isActive = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setSidebarOpen(false)}
                className={cn(
                  'flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors duration-200',
                  isActive
                    ? 'nav-link-active'
                    : 'text-muted-foreground hover:bg-accent/70 hover:text-foreground',
                )}
              >
                <Icon className="h-4 w-4 shrink-0 opacity-90" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-border/80 p-4">
          <div className="rounded-lg border border-primary/15 bg-[hsl(var(--teal-soft))] px-3.5 py-3">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary/40 opacity-60" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
              </span>
              <p className="text-xs font-semibold text-primary">AI Agent Active</p>
            </div>
            <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
              Making calls 9 AM – 6 PM
            </p>
          </div>
        </div>
      </aside>
    </>
  );
}

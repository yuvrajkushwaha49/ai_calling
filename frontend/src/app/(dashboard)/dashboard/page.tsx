'use client';

import Link from 'next/link';
import {
  Users,
  Phone,
  UserCheck,
  Calendar,
  IndianRupee,
  ArrowUpRight,
  Activity as ActivityIcon,
  Bot,
  TrendingUp,
  Target,
  Zap,
} from 'lucide-react';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { StatCard } from '@/components/dashboard/stat-card';
import {
  ChartCard,
  CallsBarChart,
  LeadSourcePieChart,
} from '@/components/dashboard/charts';
import { Button } from '@/components/ui/button';
import { PageLoader } from '@/components/common/loading';
import { ErrorMessage } from '@/components/common/error-message';
import { useDashboardStats } from '@/hooks/use-api';
import { useAuthStore } from '@/stores/auth-store';
import { formatCurrency, formatDateTime } from '@/lib/utils';
import { cn } from '@/lib/utils';

function greetingForHour(hour: number) {
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

function activityTone(description: string) {
  const d = description.toLowerCase();
  if (/call|demo|turn|recording/.test(d)) {
    return { icon: Phone, tint: 'bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300' };
  }
  if (/appointment|meeting|visit|calendar/.test(d)) {
    return {
      icon: Calendar,
      tint: 'bg-teal-100 text-teal-800 dark:bg-teal-900/40 dark:text-teal-300',
    };
  }
  if (/lead|qualif|interest/.test(d)) {
    return {
      icon: Users,
      tint: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300',
    };
  }
  return {
    icon: Zap,
    tint: 'bg-primary/10 text-primary',
  };
}

export default function DashboardPage() {
  const { data, isLoading, isError, error } = useDashboardStats();
  const { user } = useAuthStore();

  const now = new Date();
  const hour = now.getHours();
  const greeting = greetingForHour(hour);
  const todayLabel = new Intl.DateTimeFormat('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(now);

  return (
    <DashboardLayout title="Dashboard">
      {isLoading && <PageLoader />}
      {isError && <ErrorMessage message={(error as Error).message} />}
      {data && (
        <div className="mx-auto max-w-7xl space-y-6 lg:space-y-8">
          {(() => {
            const callSpark = data.callsAnalytics.map((d) => d.count);
            const weekCalls = callSpark.reduce((a, b) => a + b, 0);
            const qualifyRate =
              data.totalLeads > 0
                ? Math.round((data.qualifiedLeads / data.totalLeads) * 100)
                : 0;
            const topSource = [...data.leadSources].sort((a, b) => b.count - a.count)[0];
            const callDelta =
              callSpark.length >= 2
                ? callSpark[callSpark.length - 1] - callSpark[callSpark.length - 2]
                : 0;

            return (
              <>
                {/* Hero */}
                <section className="panel-surface relative overflow-hidden">
                  <div
                    className="pointer-events-none absolute inset-0 opacity-90"
                    style={{
                      backgroundImage:
                        'radial-gradient(ellipse 55% 80% at 100% 0%, hsl(173 55% 32% / 0.16), transparent 55%), radial-gradient(ellipse 40% 60% at 0% 100%, hsl(200 30% 40% / 0.08), transparent 50%)',
                    }}
                    aria-hidden
                  />
                  <div className="relative grid gap-6 px-5 py-6 lg:grid-cols-[1.4fr_1fr] lg:px-7 lg:py-7">
                    <div>
                      <div className="inline-flex items-center gap-2 rounded-md border border-primary/20 bg-primary/5 px-2.5 py-1 text-xs font-medium text-primary">
                        <span className="relative flex h-1.5 w-1.5">
                          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary/50" />
                          <span className="relative h-1.5 w-1.5 rounded-full bg-primary" />
                        </span>
                        AI agent online · {todayLabel}
                      </div>
                      <h2 className="mt-3 text-2xl font-semibold tracking-tight text-foreground lg:text-3xl">
                        {greeting}
                        {user?.name ? `, ${user.name.split(' ')[0]}` : ''}
                      </h2>
                      <p className="mt-2 max-w-lg text-sm leading-relaxed text-muted-foreground">
                        {data.callsToday > 0
                          ? `${data.callsToday} call${data.callsToday === 1 ? '' : 's'} today · ${data.qualifiedLeads} qualified leads in pipeline.`
                          : 'No calls yet today — start a demo from Leads when you are ready.'}
                      </p>
                      <div className="mt-5 flex flex-wrap gap-2">
                        <Button asChild size="sm">
                          <Link href="/leads">
                            Open leads
                            <ArrowUpRight className="h-3.5 w-3.5" />
                          </Link>
                        </Button>
                        <Button asChild variant="outline" size="sm" className="bg-card/80">
                          <Link href="/calls">
                            Call logs
                            <ArrowUpRight className="h-3.5 w-3.5" />
                          </Link>
                        </Button>
                        <Button asChild variant="outline" size="sm" className="bg-card/80">
                          <Link href="/ai-settings">
                            <Bot className="h-3.5 w-3.5" />
                            AI agent
                          </Link>
                        </Button>
                      </div>
                    </div>

                    {/* Pulse cards */}
                    <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
                      <div className="rounded-lg border border-border/80 bg-card/80 p-3.5 backdrop-blur-sm">
                        <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                          <Target className="h-3.5 w-3.5 text-primary" />
                          Qualify rate
                        </div>
                        <p className="mt-2 text-2xl font-semibold tabular-nums tracking-tight">
                          {qualifyRate}%
                        </p>
                        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
                          <div
                            className="h-full rounded-full bg-primary transition-all duration-700"
                            style={{ width: `${Math.min(100, qualifyRate)}%` }}
                          />
                        </div>
                      </div>
                      <div className="rounded-lg border border-border/80 bg-card/80 p-3.5 backdrop-blur-sm">
                        <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                          <TrendingUp className="h-3.5 w-3.5 text-primary" />
                          Week calls
                        </div>
                        <p className="mt-2 text-2xl font-semibold tabular-nums tracking-tight">
                          {weekCalls}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {callDelta === 0
                            ? 'Same as yesterday'
                            : callDelta > 0
                              ? `+${callDelta} vs yesterday`
                              : `${callDelta} vs yesterday`}
                        </p>
                      </div>
                      <div className="rounded-lg border border-border/80 bg-card/80 p-3.5 backdrop-blur-sm">
                        <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                          <Zap className="h-3.5 w-3.5 text-primary" />
                          Top source
                        </div>
                        <p className="mt-2 truncate text-lg font-semibold tracking-tight">
                          {topSource
                            ? topSource.source.replace(/_/g, ' ')
                            : '—'}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {topSource ? `${topSource.count} leads` : 'No sources yet'}
                        </p>
                      </div>
                    </div>
                  </div>
                </section>

                {/* Metrics */}
                <section className="stagger-children grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
                  <StatCard
                    title="Total Leads"
                    value={data.totalLeads}
                    icon={Users}
                    hint="All time in CRM"
                    className="xl:col-span-1"
                  />
                  <StatCard
                    title="Calls Today"
                    value={data.callsToday}
                    icon={Phone}
                    spark={callSpark}
                    hint="7-day pulse below"
                    className="xl:col-span-1"
                  />
                  <StatCard
                    title="Qualified"
                    value={data.qualifiedLeads}
                    icon={UserCheck}
                    hint={`${qualifyRate}% of total leads`}
                    className="xl:col-span-1"
                  />
                  <StatCard
                    title="Appointments"
                    value={data.appointments}
                    icon={Calendar}
                    hint="Scheduled visits"
                    className="xl:col-span-1"
                  />
            <StatCard
              title="Revenue"
              value={formatCurrency(data.revenue)}
              icon={IndianRupee}
                    featured
                    hint="Pipeline value"
                    className="sm:col-span-2 xl:col-span-2"
                  />
                </section>

                {/* Charts + activity */}
                <section className="grid gap-5 xl:grid-cols-5">
                  <div className="grid gap-5 md:grid-cols-2 xl:col-span-3">
                    <ChartCard
                      title="Calls — last 7 days"
                      description="Daily outbound and demo call volume"
                    >
              <CallsBarChart data={data.callsAnalytics} />
            </ChartCard>
                    <ChartCard
                      title="Lead sources"
                      description="Where new leads are coming from"
                    >
              <LeadSourcePieChart data={data.leadSources} />
            </ChartCard>
          </div>

                  <div className="panel-surface flex max-h-[34rem] flex-col overflow-hidden xl:col-span-2 xl:max-h-none">
                    <div className="flex items-center justify-between border-b border-border/80 px-5 py-4">
                      <div className="flex items-center gap-2">
                        <ActivityIcon className="h-4 w-4 text-primary" />
                        <h3 className="text-sm font-semibold tracking-tight">Live feed</h3>
                      </div>
                      <Link
                        href="/calls"
                        className="text-xs font-medium text-primary hover:underline"
                      >
                        View all
                      </Link>
                    </div>
                    <div className="flex-1 overflow-y-auto">
                      {data.recentActivities.length === 0 ? (
                        <div className="flex flex-col items-center justify-center gap-2 px-5 py-14 text-center">
                          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                            <Bot className="h-5 w-5" />
                          </div>
                          <p className="text-sm font-medium">Waiting for the first spark</p>
                          <p className="max-w-[14rem] text-xs text-muted-foreground">
                            Run a demo call from a lead — activity will show up here.
                          </p>
                          <Button asChild size="sm" className="mt-2">
                            <Link href="/leads">Go to leads</Link>
                          </Button>
            </div>
                      ) : (
                        <ul className="divide-y divide-border/60">
                          {data.recentActivities.slice(0, 8).map((activity, idx) => {
                            const tone = activityTone(activity.description);
                            const Icon = tone.icon;
                            return (
                              <li
                                key={activity.id}
                                className="flex gap-3 px-5 py-3.5 transition-colors hover:bg-muted/30"
                                style={{ animationDelay: `${idx * 40}ms` }}
                              >
                                <span
                                  className={cn(
                                    'mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md',
                                    tone.tint,
                                  )}
                                >
                                  <Icon className="h-3.5 w-3.5" />
                                </span>
                                <div className="min-w-0 flex-1">
                                  <p className="text-sm leading-snug text-foreground">
                                    {activity.description}
                                  </p>
                                  <p className="mt-1 text-xs text-muted-foreground">
                                    {activity.lead?.name || '—'}
                                    <span className="mx-1.5 text-border">·</span>
                                    {activity.user?.name || 'System'}
                                    <span className="mx-1.5 text-border">·</span>
                        {formatDateTime(activity.createdAt)}
                                  </p>
                                </div>
                              </li>
                            );
                          })}
                        </ul>
                      )}
            </div>
          </div>
                </section>
              </>
            );
          })()}
        </div>
      )}
    </DashboardLayout>
  );
}

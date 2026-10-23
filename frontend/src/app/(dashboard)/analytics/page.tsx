'use client';

import { TrendingUp, Users, Phone, Target } from 'lucide-react';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { StatCard } from '@/components/dashboard/stat-card';
import {
  ChartCard,
  CallsBarChart,
  LineTrendChart,
  ProjectBarChart,
} from '@/components/dashboard/charts';
import { PageLoader } from '@/components/common/loading';
import { ErrorMessage } from '@/components/common/error-message';
import { useAnalytics } from '@/hooks/use-api';

export default function AnalyticsPage() {
  const { data, isLoading, isError, error } = useAnalytics();

  return (
    <DashboardLayout title="Analytics">
      {isLoading && <PageLoader />}
      {isError && <ErrorMessage message={(error as Error).message} />}

      {data && (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              title="Qualified Leads"
              value={data.qualifiedLeads}
              icon={Users}
            />
            <StatCard
              title="Conversion Rate"
              value={`${data.conversionRate}%`}
              icon={Target}
            />
            <StatCard
              title="Daily Calls (30d)"
              value={data.dailyCalls.reduce((s, d) => s + d.count, 0)}
              icon={Phone}
            />
            <StatCard
              title="Monthly Calls"
              value={data.monthlyCalls[data.monthlyCalls.length - 1]?.count ?? 0}
              icon={TrendingUp}
              trend="Current month"
            />
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <ChartCard title="Daily Calls (Last 30 Days)">
              <CallsBarChart data={data.dailyCalls} />
            </ChartCard>
            <ChartCard title="Monthly Calls">
              <LineTrendChart
                data={data.monthlyCalls}
                dataKey="count"
                xKey="month"
              />
            </ChartCard>
          </div>

          <ChartCard title="Project Performance">
            <ProjectBarChart data={data.projectPerformance} />
          </ChartCard>

          <div className="rounded-xl border bg-card shadow-sm">
            <div className="border-b p-6">
              <h3 className="text-base font-semibold">Agent Performance</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="px-6 py-3 text-left font-medium text-muted-foreground">Agent</th>
                    <th className="px-6 py-3 text-left font-medium text-muted-foreground">Activities</th>
                    <th className="px-6 py-3 text-left font-medium text-muted-foreground">Performance</th>
                  </tr>
                </thead>
                <tbody>
                  {data.agentPerformance.map((agent) => {
                    const maxActivities = Math.max(
                      ...data.agentPerformance.map((a) => a.activities),
                      1,
                    );
                    const percentage = Math.round((agent.activities / maxActivities) * 100);
                    return (
                      <tr key={agent.id} className="border-b last:border-0">
                        <td className="px-6 py-4 font-medium">{agent.name}</td>
                        <td className="px-6 py-4">{agent.activities}</td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="h-2 flex-1 max-w-[200px] rounded-full bg-muted">
                              <div
                                className="h-2 rounded-full bg-gradient-to-r from-blue-600 to-blue-400"
                                style={{ width: `${percentage}%` }}
                              />
                            </div>
                            <span className="text-xs text-muted-foreground">{percentage}%</span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}

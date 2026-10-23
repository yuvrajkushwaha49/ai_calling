'use client';

import { useState } from 'react';
import { Calendar, MapPin, Clock } from 'lucide-react';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Button } from '@/components/ui/button';
import { PageLoader } from '@/components/common/loading';
import { ErrorMessage } from '@/components/common/error-message';
import { useAppointments, useUpdateAppointment } from '@/hooks/use-api';
import { formatDate } from '@/lib/utils';
import { APPOINTMENT_STATUS_LABELS, STATUS_COLORS } from '@/lib/constants';
import { cn } from '@/lib/utils';
import type { AppointmentStatus } from '@/types';

const TABS: { label: string; status?: AppointmentStatus }[] = [
  { label: 'All', status: undefined },
  { label: 'Upcoming', status: 'SCHEDULED' },
  { label: 'Completed', status: 'COMPLETED' },
  { label: 'Cancelled', status: 'CANCELLED' },
];

export default function AppointmentsPage() {
  const [activeTab, setActiveTab] = useState<AppointmentStatus | undefined>('SCHEDULED');
  const { data: appointments, isLoading, isError, error } = useAppointments(activeTab);
  const updateAppointment = useUpdateAppointment();

  const handleStatusChange = async (id: string, status: AppointmentStatus) => {
    await updateAppointment.mutateAsync({ id, data: { status } });
  };

  const groupedByDate = appointments?.reduce(
    (acc, apt) => {
      const date = formatDate(apt.date);
      if (!acc[date]) acc[date] = [];
      acc[date].push(apt);
      return acc;
    },
    {} as Record<string, typeof appointments>,
  );

  return (
    <DashboardLayout title="Appointments">
      <div className="space-y-6">
        <div className="flex flex-wrap gap-2">
          {TABS.map((tab) => (
            <Button
              key={tab.label}
              variant={activeTab === tab.status ? 'default' : 'outline'}
              size="sm"
              onClick={() => setActiveTab(tab.status)}
              className={activeTab === tab.status ? 'bg-gradient-to-r from-blue-600 to-blue-700' : ''}
            >
              {tab.label}
            </Button>
          ))}
        </div>

        {isLoading && <PageLoader />}
        {isError && <ErrorMessage message={(error as Error).message} />}

        {appointments && (
          <div className="space-y-6">
            {Object.entries(groupedByDate || {}).map(([date, apts]) => (
              <div key={date}>
                <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-muted-foreground">
                  <Calendar className="h-4 w-4" />
                  {date}
                </h3>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {apts?.map((apt) => (
                    <div
                      key={apt.id}
                      className="rounded-xl border bg-card p-5 shadow-sm transition-shadow hover:shadow-md"
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="font-semibold">{apt.lead?.name}</p>
                          <p className="text-sm text-muted-foreground">{apt.lead?.phone}</p>
                        </div>
                        <span
                          className={cn(
                            'rounded-full px-2 py-0.5 text-xs font-medium',
                            STATUS_COLORS[apt.status],
                          )}
                        >
                          {APPOINTMENT_STATUS_LABELS[apt.status]}
                        </span>
                      </div>
                      <div className="mt-3 space-y-1 text-sm">
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Clock className="h-3.5 w-3.5" />
                          {apt.time}
                        </div>
                        {apt.project && (
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <MapPin className="h-3.5 w-3.5" />
                            {apt.project.name}
                          </div>
                        )}
                      </div>
                      {apt.status === 'SCHEDULED' && (
                        <div className="mt-4 flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            className="flex-1 text-green-600"
                            onClick={() => handleStatusChange(apt.id, 'COMPLETED')}
                          >
                            Complete
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="flex-1 text-destructive"
                            onClick={() => handleStatusChange(apt.id, 'CANCELLED')}
                          >
                            Cancel
                          </Button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
            {appointments.length === 0 && (
              <div className="rounded-xl border border-dashed p-12 text-center text-muted-foreground">
                No appointments found
              </div>
            )}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

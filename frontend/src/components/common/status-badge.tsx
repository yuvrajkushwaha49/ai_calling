import { cn } from '@/lib/utils';
import { STATUS_COLORS, LEAD_STATUS_LABELS } from '@/lib/constants';

export function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium',
        STATUS_COLORS[status] || 'bg-muted text-muted-foreground',
      )}
    >
      {LEAD_STATUS_LABELS[status] || status}
    </span>
  );
}

import { cn } from '@/lib/utils';
import { LucideIcon } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  trend?: string;
  className?: string;
  featured?: boolean;
  /** Mini sparkline values (0+) */
  spark?: number[];
  hint?: string;
}

function MiniSpark({ values }: { values: number[] }) {
  const max = Math.max(...values, 1);
  return (
    <div className="mt-4 flex h-8 items-end gap-0.5" aria-hidden>
      {values.map((v, i) => (
        <span
          key={i}
          className="spark-bar w-full rounded-sm bg-primary/25"
          style={{
            height: `${Math.max(12, Math.round((v / max) * 100))}%`,
            animationDelay: `${i * 40}ms`,
          }}
        />
      ))}
    </div>
  );
}

export function StatCard({
  title,
  value,
  icon: Icon,
  trend,
  className,
  featured = false,
  spark,
  hint,
}: StatCardProps) {
  return (
    <div
      className={cn(
        'panel-surface group relative overflow-hidden p-5 transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/35',
        featured && 'border-primary/20 bg-[hsl(var(--teal-soft))]/60',
        className,
      )}
    >
      {featured && (
        <div
          className="pointer-events-none absolute -right-8 -top-10 h-28 w-28 rounded-full bg-primary/10 transition-transform duration-500 group-hover:scale-110"
          aria-hidden
        />
      )}
      <div className="relative flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-[0.06em] text-muted-foreground">
            {title}
          </p>
          <p
            className={cn(
              'mt-2 font-semibold tracking-tight text-foreground',
              featured ? 'text-3xl lg:text-4xl' : 'truncate text-2xl lg:text-3xl',
            )}
          >
            {value}
          </p>
          {(trend || hint) && (
            <p className="mt-1.5 text-xs text-muted-foreground">{trend || hint}</p>
          )}
        </div>
        <div
          className={cn(
            'flex shrink-0 items-center justify-center rounded-lg text-primary transition-transform duration-300 group-hover:scale-105',
            featured ? 'h-12 w-12 bg-primary/15' : 'h-11 w-11 bg-primary/10',
          )}
        >
          <Icon className={featured ? 'h-6 w-6' : 'h-5 w-5'} />
        </div>
      </div>
      {spark && spark.length > 0 && <MiniSpark values={spark} />}
    </div>
  );
}

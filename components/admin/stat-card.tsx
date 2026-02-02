import { LucideIcon } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  trend?: {
    value: string;
    isPositive: boolean;
  };
}

export function StatCard({ title, value, subtitle, icon: Icon, trend }: StatCardProps) {
  return (
    <div className="rounded-lg border border-border bg-white p-6 shadow-sm hover:shadow-md transition-shadow">
      <div className="mb-4 flex items-start justify-between">
        <div className="text-sm font-medium text-muted-foreground">{title}</div>
        <div className="rounded-lg bg-gray-100 p-2">
          <Icon className="h-5 w-5 text-gray-600" />
        </div>
      </div>

      <div className="mb-1 text-3xl font-bold text-foreground">{value}</div>

      {subtitle && <div className="text-sm text-muted-foreground">{subtitle}</div>}

      {trend && (
        <div className="mt-2 flex items-center gap-1 text-sm">
          <span className={trend.isPositive ? 'text-green-600' : 'text-red-600'}>
            {trend.isPositive ? '+' : ''}
            {trend.value}
          </span>
          <span className="text-muted-foreground">vs minulý mesiac</span>
        </div>
      )}
    </div>
  );
}

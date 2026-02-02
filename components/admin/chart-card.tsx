import { ReactNode } from 'react';

interface ChartCardProps {
  title: string;
  subtitle?: string;
  children: ReactNode;
  actions?: ReactNode;
}

export function ChartCard({ title, subtitle, children, actions }: ChartCardProps) {
  return (
    <div className="rounded-lg border border-border bg-white p-6 shadow-sm">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h3 className="font-semibold text-foreground">{title}</h3>
          {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
        </div>
        {actions && <div>{actions}</div>}
      </div>

      <div>{children}</div>
    </div>
  );
}

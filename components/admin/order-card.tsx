import { ExternalLink } from 'lucide-react';
import { AdminButton } from './admin-button';
import { AdminBadge } from './admin-badge';

interface OrderCardProps {
  orderId: string;
  date: string;
  customer: {
    name: string;
    email: string;
  };
  items: {
    name: string;
    quantity: number;
  }[];
  total: number;
  status: 'pending' | 'processing' | 'completed' | 'cancelled';
  onViewDetails?: () => void;
}

const statusVariantMap = {
  pending: 'warning' as const,
  processing: 'default' as const,
  completed: 'success' as const,
  cancelled: 'inactive' as const,
};

const statusLabelMap = {
  pending: 'Čaká sa',
  processing: 'Spracováva sa',
  completed: 'Dokončená',
  cancelled: 'Zrušená',
};

export function OrderCard({ orderId, date, customer, items, total, status, onViewDetails }: OrderCardProps) {
  return (
    <div className="rounded-lg border border-border bg-white p-6 shadow-sm hover:shadow-md transition-shadow">
      <div className="mb-4 flex items-start justify-between">
        <div>
          <h3 className="font-semibold text-foreground">Objednávka {orderId}</h3>
          <p className="text-sm text-muted-foreground">{date}</p>
        </div>
        <AdminBadge variant={statusVariantMap[status]}>
          {statusLabelMap[status]}
        </AdminBadge>
      </div>

      <div className="mb-4 border-b border-border pb-4">
        <div className="text-sm">
          <div className="font-medium text-foreground">{customer.name}</div>
          <div className="text-muted-foreground">{customer.email}</div>
        </div>
      </div>

      <div className="mb-4">
        <div className="text-xs font-semibold uppercase text-muted-foreground mb-2">Položky objednávky</div>
        {items.map((item, index) => (
          <div key={index} className="flex justify-between text-sm py-1">
            <span className="text-muted-foreground">{item.name}</span>
            <span className="font-medium">{item.quantity} ks</span>
          </div>
        ))}
      </div>

      <div className="mb-4 flex items-center justify-between border-t border-border pt-4">
        <span className="text-sm font-medium text-muted-foreground">Celkom</span>
        <span className="text-xl font-bold text-foreground">{total.toFixed(2)} €</span>
      </div>

      <AdminButton variant="outline" size="sm" icon={ExternalLink} iconPosition="right" fullWidth onClick={onViewDetails}>
        Detail
      </AdminButton>
    </div>
  );
}

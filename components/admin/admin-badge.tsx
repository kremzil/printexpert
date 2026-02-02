interface AdminBadgeProps {
  children: React.ReactNode;
  variant?: 'default' | 'b2b' | 'b2c' | 'active' | 'inactive' | 'success' | 'warning' | 'danger';
  size?: 'sm' | 'md';
}

export function AdminBadge({ children, variant = 'default', size = 'md' }: AdminBadgeProps) {
  const variantClasses = {
    default: 'bg-gray-100 text-gray-800',
    b2b: 'bg-blue-100 text-blue-800',
    b2c: 'bg-red-100 text-red-800',
    active: 'bg-green-100 text-green-800',
    inactive: 'bg-gray-100 text-gray-600',
    success: 'bg-green-100 text-green-800',
    warning: 'bg-yellow-100 text-yellow-800',
    danger: 'bg-red-100 text-red-800',
  };

  const sizeClasses = {
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-2.5 py-1 text-sm',
  };

  return (
    <span
      className={`inline-flex items-center rounded-full font-medium ${variantClasses[variant]} ${sizeClasses[size]}`}
    >
      {children}
    </span>
  );
}

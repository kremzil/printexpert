import { LucideIcon } from 'lucide-react';
import { ReactNode } from 'react';

interface AdminButtonProps {
  children: ReactNode;
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  icon?: LucideIcon;
  iconPosition?: 'left' | 'right';
  fullWidth?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  type?: 'button' | 'submit' | 'reset';
  className?: string;
}

export function AdminButton({
  children,
  variant = 'primary',
  size = 'md',
  icon: Icon,
  iconPosition = 'left',
  fullWidth = false,
  disabled = false,
  onClick,
  type = 'button',
  className = '',
}: AdminButtonProps) {
  const baseClasses = 'inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-all focus:outline-none focus:ring-2 focus:ring-offset-2';

  const variantClasses = {
    primary: 'bg-gray-900 text-white hover:bg-gray-800 focus:ring-gray-900 disabled:bg-gray-400',
    secondary: 'bg-gray-100 text-gray-900 hover:bg-gray-200 focus:ring-gray-500',
    outline: 'border-2 border-gray-900 bg-white text-gray-900 hover:bg-gray-50 focus:ring-gray-900',
    ghost: 'text-gray-700 hover:bg-gray-100 focus:ring-gray-500',
    danger: 'bg-red-600 text-white hover:bg-red-700 focus:ring-red-600 disabled:bg-red-400',
  };

  const sizeClasses = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2 text-sm',
    lg: 'px-6 py-3 text-base',
  };

  const iconSizes = {
    sm: 'h-4 w-4',
    md: 'h-4 w-4',
    lg: 'h-5 w-5',
  };

  const classes = `${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]} ${
    fullWidth ? 'w-full' : ''
  } ${disabled ? 'cursor-not-allowed opacity-50' : ''} ${className}`;

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={classes}
    >
      {Icon && iconPosition === 'left' && <Icon className={iconSizes[size]} />}
      {children}
      {Icon && iconPosition === 'right' && <Icon className={iconSizes[size]} />}
    </button>
  );
}

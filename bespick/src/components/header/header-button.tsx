import Link from 'next/link';
import type { LucideIcon } from 'lucide-react';

type HeaderButtonProps = {
  href: string;
  icon: LucideIcon;
  label: string;
  showLabel?: boolean;
  className?: string;
  iconClassName?: string;
  onClick?: () => void;
  showNotification?: boolean;
};

export function HeaderButton({
  href,
  icon: Icon,
  label,
  showLabel = true,
  className = '',
  iconClassName = '',
  onClick,
  showNotification = false,
}: HeaderButtonProps) {
  return (
    <Link
      href={href}
      aria-label={label}
      onClick={onClick}
      className={`group relative inline-flex items-center gap-2 rounded-full border border-border bg-secondary/80 px-3 py-2 text-sm font-medium text-foreground transition hover:bg-primary/10 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background ${className}`}
    >
      <Icon
        className={`h-5 w-5 transition-transform duration-150 group-hover:scale-110 ${iconClassName}`}
        aria-hidden={true}
        strokeWidth={1.75}
      />
      {showNotification && (
        <span className='absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-red-500 ring-2 ring-background' />
      )}
      {showLabel ? (
        <span>{label}</span>
      ) : (
        <span className='sr-only'>{label}</span>
      )}
    </Link>
  );
}

'use client';

import { useEffect, useRef, useState } from 'react';
import { MoreVertical } from 'lucide-react';

type ActionMenuItem = {
  label: string;
  onClick: () => void | Promise<void>;
  disabled?: boolean;
  tone?: 'default' | 'muted' | 'danger';
};

type ActionMenuProps = {
  label: string;
  items: ActionMenuItem[];
};

const toneClasses = {
  default: 'text-foreground hover:bg-secondary',
  muted: 'text-muted-foreground hover:bg-secondary',
  danger: 'text-destructive hover:bg-destructive/10',
};

export function ActionMenu({ label, items }: ActionMenuProps) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleClick = (event: MouseEvent) => {
      if (
        menuRef.current &&
        event.target instanceof Node &&
        !menuRef.current.contains(event.target)
      ) {
        setOpen(false);
      }
    };

    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKey);

    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKey);
    };
  }, [open]);

  const handleItemClick = async (item: ActionMenuItem) => {
    await item.onClick();
    setOpen(false);
  };

  return (
    <div className='relative flex'>
      <button
        type='button'
        onClick={() => setOpen((prev) => !prev)}
        aria-haspopup='menu'
        aria-expanded={open}
        className='rounded-full border border-transparent p-1 text-muted-foreground transition hover:border-border hover:bg-secondary/40 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background'
      >
        <MoreVertical className='h-4 w-4' aria-hidden={true} />
        <span className='sr-only'>{label}</span>
      </button>
      {open && (
        <div
          ref={menuRef}
          className='absolute right-0 top-8 z-20 w-36 rounded-md border border-border bg-popover p-1 shadow-lg'
          role='menu'
        >
          {items.map((item) => (
            <button
              key={item.label}
              type='button'
              onClick={() => void handleItemClick(item)}
              disabled={item.disabled}
              className={`flex w-full items-center justify-between rounded-sm px-3 py-2 text-sm transition disabled:opacity-60 ${
                toneClasses[item.tone ?? 'default']
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

import type { ReactNode } from 'react';
import { Inbox } from 'lucide-react';
import { cn } from '@/lib/utils';

export function EmptyState({
  text,
  icon,
  className,
}: {
  text: string;
  icon?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-col items-center justify-center gap-2 py-12 text-center', className)}>
      <div className="text-muted-foreground/40">{icon ?? <Inbox className="size-8" />}</div>
      <p className="text-sm text-muted-foreground">{text}</p>
    </div>
  );
}

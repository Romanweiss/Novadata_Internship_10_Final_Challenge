import { cn } from '../../utils/format';

interface PageLoaderProps {
  className?: string;
}

export function PageLoader({ className }: PageLoaderProps) {
  return (
    <div className={cn('flex min-h-[360px] items-center justify-center', className)}>
      <img src="/assets/load.svg" alt="Loading" className="h-24 w-24 select-none object-contain" draggable={false} />
    </div>
  );
}

import { cn } from '../../utils/format';

interface CardProps {
  className?: string;
  children: React.ReactNode;
}

export function Card({ className, children }: CardProps) {
  return <section className={cn('card-surface app-transition', className)}>{children}</section>;
}

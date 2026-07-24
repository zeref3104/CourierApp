import { cn } from '../../utils/cn';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  padding?: boolean;
}

export function Card({ children, className, padding = true }: CardProps) {
  return (
    <div className={cn('bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm', padding && 'p-6', className)}>
      {children}
    </div>
  );
}

export function StatCard({ label, value, icon, trend }: { label: string; value: string | number; icon?: string; trend?: { direction: 'up' | 'down'; value: string } }) {
  return (
    <Card>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-500 dark:text-gray-400">{label}</p>
          <p className="text-2xl font-semibold mt-1">{value}</p>
          {trend && (
            <p className={cn('text-xs mt-1', trend.direction === 'up' ? 'text-green-600' : 'text-red-600')}>
              {trend.direction === 'up' ? '↑' : '↓'} {trend.value}
            </p>
          )}
        </div>
        {icon && <span className="text-3xl opacity-60">{icon}</span>}
      </div>
    </Card>
  );
}
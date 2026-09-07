import { useRef, useEffect, KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '../../utils/cn';

interface ScanInputProps {
  onScan: (tracking: string) => void;
  disabled?: boolean;
}

export function ScanInput({ onScan, disabled }: ScanInputProps) {
  const { t } = useTranslation();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const value = (e.target as HTMLInputElement).value.trim();
      if (value) {
        onScan(value);
        (e.target as HTMLInputElement).value = '';
      }
    }
  };

  return (
    <div className="relative max-w-md">
      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-lg">
        {disabled ? '⏳' : '📷'}
      </span>
      <input
        ref={inputRef}
        type="text"
        onKeyDown={handleKeyDown}
        disabled={disabled}
        placeholder={t('scanner.instruction')}
        className={cn(
          'w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 pl-10 pr-4 py-3 text-sm font-mono',
          'placeholder:text-gray-400 dark:placeholder:text-gray-500',
          'focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent',
          'disabled:opacity-50 disabled:cursor-not-allowed',
          'transition-shadow',
          !disabled && 'shadow-sm focus:shadow-md'
        )}
        autoComplete="off"
        autoFocus
      />
    </div>
  );
}

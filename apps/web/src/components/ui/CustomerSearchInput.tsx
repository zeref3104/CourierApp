import { useState, useEffect, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import type { RootState } from '../../store';
import { setSearchResults, setSearchLoading, clearSearchResults } from '../../store/slices/customerSlice';
import { customerService } from '../../services/customer.service';
import { useDebounce } from '../../hooks/useDebounce';
import { cn } from '../../utils/cn';

interface CustomerSearchInputProps {
  value: string;
  onChange: (customerId: string, customer: { code: string; name: string; lastName: string }) => void;
  error?: string;
}

export default function CustomerSearchInput({ value, onChange, error }: CustomerSearchInputProps) {
  const dispatch = useDispatch();
  const { t } = useTranslation();
  const { searchResults, searchLoading } = useSelector((s: RootState) => s.customers);
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [selectedLabel, setSelectedLabel] = useState('');
  const debouncedQuery = useDebounce(query, 300);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Close the dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Search when the debounced query changes
  useEffect(() => {
    if (!debouncedQuery || debouncedQuery.length < 2) {
      dispatch(clearSearchResults());
      return;
    }
    dispatch(setSearchLoading(true));
    customerService.findAll({ search: debouncedQuery, limit: 10 }).then((res) => {
      dispatch(setSearchResults(res.data));
      setOpen(true);
    });
  }, [debouncedQuery, dispatch]);

  const handleSelect = (customer: any) => {
    setSelectedLabel(`${customer.code} - ${customer.name} ${customer.lastName}`);
    setQuery('');
    onChange(customer._id, { code: customer.code, name: customer.name, lastName: customer.lastName });
    setOpen(false);
    dispatch(clearSearchResults());
  };

  const handleClear = () => {
    setSelectedLabel('');
    onChange('', { code: '', name: '', lastName: '' });
    setQuery('');
  };

  return (
    <div className="space-y-1" ref={wrapperRef}>
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
        {t('common.customer')}
      </label>

      {selectedLabel ? (
        <div className="flex items-center justify-between rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm">
          <span>{selectedLabel}</span>
          <button
            type="button"
            onClick={handleClear}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-lg leading-none"
          >
            &times;
          </button>
        </div>
      ) : (
        <div className="relative">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => searchResults.length > 0 && setOpen(true)}
            placeholder={t('common.searchCustomer')}
            className={cn(
              'w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm',
              'placeholder:text-gray-400 dark:placeholder:text-gray-500',
              'focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent',
              error && 'border-red-500 focus:ring-red-500',
            )}
          />

          {open && searchResults.length > 0 && (
            <ul className="absolute z-50 mt-1 w-full rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 shadow-lg max-h-60 overflow-auto">
              {searchResults.map((c: any) => (
                <li
                  key={c._id}
                  onClick={() => handleSelect(c)}
                  className="px-3 py-2 text-sm cursor-pointer hover:bg-primary-50 dark:hover:bg-primary-900/30 flex justify-between items-center"
                >
                  <span>
                    <span className="font-medium">{c.code}</span> — {c.name} {c.lastName}
                  </span>
                  <span className="text-xs text-gray-400">{c.document || ''}</span>
                </li>
              ))}
            </ul>
          )}

          {searchLoading && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              <span className="text-xs text-gray-400">{t('common.searching')}</span>
            </div>
          )}

          {open && debouncedQuery.length >= 2 && searchResults.length === 0 && !searchLoading && (
            <div className="absolute z-50 mt-1 w-full rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 shadow-lg p-3 text-sm text-gray-500 text-center">
              {t('common.noResults')}
            </div>
          )}
        </div>
      )}

      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}

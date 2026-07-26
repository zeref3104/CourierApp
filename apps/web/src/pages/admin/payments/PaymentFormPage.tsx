import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { paymentService } from '../../../services/payment.service';
import { customerService } from '../../../services/customer.service';
import { Card } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { Badge } from '../../../components/ui/Badge';
import { formatCurrency } from '../../../utils/formatCurrency';
import { useDebounce } from '../../../hooks/useDebounce';

export default function PaymentFormPage() {
  const navigate = useNavigate();
  const [customerId, setCustomerId] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const debouncedSearch = useDebounce(searchQuery, 300);
  const [packages, setPackages] = useState<any[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('cash');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [packagesLoading, setPackagesLoading] = useState(false);

  // Search customers when debounced search changes
  useEffect(() => {
    if (!debouncedSearch || debouncedSearch.length < 2) {
      setSearchResults([]);
      return;
    }
    setSearching(true);
    customerService.findAll({ search: debouncedSearch, limit: 10 })
      .then((r) => setSearchResults(r.data || []))
      .catch(() => setSearchResults([]))
      .finally(() => setSearching(false));
  }, [debouncedSearch]);

  // Close dropdown on click outside
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // Load customer packages when selected
  useEffect(() => {
    if (!customerId) {
      setPackages([]);
      setSelectedIds(new Set());
      return;
    }
    setPackagesLoading(true);
    customerService.getPackages(customerId, { limit: 200 })
      .then((r) => {
        const list = r.data || [];
        setPackages(list.filter((p: any) => !p.isPaid));
      })
      .catch(() => setPackages([]))
      .finally(() => setPackagesLoading(false));
  }, [customerId]);

  const selectedPackages = packages.filter((p) => selectedIds.has(p._id));
  const selectedTotal = selectedPackages.reduce((s, p) => s + p.total, 0);

  const togglePackage = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedIds.size === 0) return;

    setLoading(true);
    try {
      await paymentService.create({
        packages: Array.from(selectedIds),
        customerId,
        amount: Number(amount),
        method,
        notes,
      });
      navigate('/payments');
    } catch (err: any) {
      alert(err.response?.data?.error?.message || 'Error al registrar el pago');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-bold mb-6">Nuevo Pago</h1>
      <Card>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Cliente — search + dropdown */}
          <div ref={searchRef}>
            <label className="block text-sm font-medium mb-1">Cliente</label>
            {selectedCustomer ? (
              <div className="flex items-center justify-between rounded-lg border border-primary-500 bg-primary-50 dark:bg-primary-900/20 px-3 py-2 text-sm">
                <div>
                  <span className="font-medium">{selectedCustomer.name} {selectedCustomer.lastName}</span>
                  <span className="ml-2 text-gray-500">{selectedCustomer.code}</span>
                  {selectedCustomer.phone && <span className="ml-2 text-gray-400">• {selectedCustomer.phone}</span>}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedCustomer(null);
                    setCustomerId('');
                    setSearchQuery('');
                    setSearchResults([]);
                  }}
                  className="text-gray-400 hover:text-gray-600 text-lg leading-none"
                >
                  ✕
                </button>
              </div>
            ) : (
              <div className="relative">
                <Input
                  placeholder="Buscar por nombre, código o teléfono..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setShowDropdown(true);
                  }}
                  onFocus={() => searchResults.length > 0 && setShowDropdown(true)}
                  icon="🔍"
                />
                {showDropdown && debouncedSearch.length >= 2 && (
                  <div className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                    {searching ? (
                      <div className="px-3 py-2 text-sm text-gray-400">Buscando...</div>
                    ) : searchResults.length === 0 ? (
                      <div className="px-3 py-2 text-sm text-gray-400">Sin resultados</div>
                    ) : (
                      searchResults.map((c: any) => (
                        <button
                          key={c._id}
                          type="button"
                          onClick={() => {
                            setSelectedCustomer(c);
                            setCustomerId(c._id);
                            setSearchQuery('');
                            setSearchResults([]);
                            setShowDropdown(false);
                          }}
                          className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 border-b border-gray-100 dark:border-gray-700 last:border-0"
                        >
                          <span className="font-medium">{c.name} {c.lastName}</span>
                          <span className="ml-2 text-gray-500">{c.code}</span>
                          {c.phone && <span className="ml-2 text-gray-400">{c.phone}</span>}
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Paquetes */}
          {customerId && (
            <div>
              <label className="block text-sm font-medium mb-2">
                Paquetes pendientes
                {packagesLoading && <span className="ml-2 text-gray-400">Cargando...</span>}
              </label>

              {!packagesLoading && packages.length === 0 && (
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  No hay paquetes pendientes de pago para este cliente.
                </p>
              )}

              {packages.length > 0 && (
                <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 dark:bg-gray-800">
                      <tr>
                        <th className="px-3 py-2 text-left w-10">
                          <input
                            type="checkbox"
                            checked={selectedIds.size === packages.length}
                            onChange={() => {
                              if (selectedIds.size === packages.length) {
                                setSelectedIds(new Set());
                              } else {
                                setSelectedIds(new Set(packages.map((p) => p._id)));
                              }
                            }}
                            className="rounded"
                          />
                        </th>
                        <th className="px-3 py-2 text-left">Tracking</th>
                        <th className="px-3 py-2 text-left">Descripción</th>
                        <th className="px-3 py-2 text-right">Total</th>
                        <th className="px-3 py-2 text-center">Estado</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                      {packages.map((pkg) => (
                        <tr
                          key={pkg._id}
                          className={`hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer ${
                            selectedIds.has(pkg._id) ? 'bg-primary-50 dark:bg-primary-900/20' : ''
                          }`}
                          onClick={() => togglePackage(pkg._id)}
                        >
                          <td className="px-3 py-2">
                            <input
                              type="checkbox"
                              checked={selectedIds.has(pkg._id)}
                              onChange={() => togglePackage(pkg._id)}
                              className="rounded"
                              onClick={(e) => e.stopPropagation()}
                            />
                          </td>
                          <td className="px-3 py-2 font-medium">{pkg.tracking}</td>
                          <td className="px-3 py-2 text-gray-600 dark:text-gray-400 truncate max-w-[200px]">
                            {pkg.description || '—'}
                          </td>
                          <td className="px-3 py-2 text-right">{formatCurrency(pkg.total)}</td>
                          <td className="px-3 py-2 text-center">
                            <Badge variant={pkg.isPaid ? 'success' : 'warning'}>
                              {pkg.isPaid ? 'Pagado' : 'Pendiente'}
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Resumen de selección */}
              {selectedPackages.length > 0 && (
                <div className="mt-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg text-sm space-y-1">
                  <div className="flex justify-between">
                    <span>Paquetes seleccionados:</span>
                    <span className="font-medium">{selectedPackages.length}</span>
                  </div>
                  <div className="flex justify-between text-base font-bold">
                    <span>Total a pagar:</span>
                    <span>{formatCurrency(selectedTotal)}</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Monto */}
          <Input
            label="Monto a pagar"
            type="number"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            required
          />

          {/* Método */}
          <div>
            <label className="block text-sm font-medium mb-1">Método de pago</label>
            <select
              value={method}
              onChange={(e) => setMethod(e.target.value)}
              className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm"
            >
              <option value="cash">Efectivo</option>
              <option value="card">Tarjeta</option>
              <option value="transfer">Transferencia</option>
            </select>
          </div>

          {/* Notas */}
          <Input
            label="Notas"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />

          <div className="flex gap-3 pt-4">
            <Button
              type="submit"
              loading={loading}
              disabled={selectedIds.size === 0}
            >
              {selectedIds.size === 0
                ? 'Seleccioná al menos un paquete'
                : `Pagar ${formatCurrency(Number(amount) || selectedTotal)}`}
            </Button>
            <Button type="button" variant="secondary" onClick={() => navigate('/payments')}>
              Cancelar
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}

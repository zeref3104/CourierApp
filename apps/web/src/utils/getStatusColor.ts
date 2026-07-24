const statusColors: Record<string, string> = {
  recibido_miami: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  almacen_miami: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200',
  en_transito: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  llego_rd: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
  almacen_rd: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
  disponible: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  en_reparto: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-200',
  entregado: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200',
  cancelado: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
  extraviado: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200',
};

export function getStatusColor(status: string): string {
  return statusColors[status] || 'bg-gray-100 text-gray-800';
}
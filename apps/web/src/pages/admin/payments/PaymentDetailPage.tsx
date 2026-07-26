import { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { paymentService } from '../../../services/payment.service';
import { Card } from '../../../components/ui/Card';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { formatDateTime } from '../../../utils/formatDate';
import { formatCurrency } from '../../../utils/formatCurrency';

const METHOD_LABELS: Record<string, string> = {
  cash: 'Efectivo',
  card: 'Tarjeta',
  transfer: 'Transferencia',
};

function openPrintWindow(html: string) {
  const win = window.open('', '_blank');
  if (!win) return;
  win.document.write(html);
  win.document.close();
  win.focus();
  setTimeout(() => win.print(), 500);
}

function buildReceiptHtml(payment: any) {
  const customer = payment.customerId || {};
  const receipt = payment.receipt;

  // Build from packages — they have weight, tracking, cost, tax, total
  const packages = payment.packages || [];
  const items = packages.length > 0
    ? packages.map((p: any) => ({
        description: p.description ? `Envío #${p.tracking} — ${p.description}` : `Envío #${p.tracking}`,
        tracking: p.tracking,
        weight: p.weight,
        amount: p.cost || 0,
        tax: p.tax || 0,
        total: p.total || 0,
      }))
    : (receipt?.items || []).map((i: any) => ({
        description: i.description,
        tracking: '',
        weight: 0,
        amount: i.amount || 0,
        tax: i.tax || 0,
        total: i.total || 0,
      }));

  const subtotal = items.reduce((s: number, i: any) => s + i.amount, 0);
  const tax = items.reduce((s: number, i: any) => s + i.tax, 0);
  const total = items.reduce((s: number, i: any) => s + i.total, 0);

  const methodLabel = METHOD_LABELS[payment.method] || payment.method;
  const paidDate = payment.paidAt
    ? new Date(payment.paidAt).toLocaleString('es-DO', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })
    : new Date().toLocaleDateString('es-DO');
  const receiptNum = payment.receiptNumber || payment._id.slice(-6);

  const pkgRows = items.map((i: any) => {
    const tracking = i.tracking || '';
    const desc = i.description?.replace(/^Envío #\S+ — /, '').replace(/^Envío #\S+/, '') || '';
    const weight = Number(i.weight) || 0;
    const pricePerLb = weight > 0 ? Number(i.amount) / weight : 0;
    return `
    <tr>
      <td style="padding:8px 10px;border-bottom:1px solid #e0e0e0">
        <strong style="font-family:monospace;font-size:13px">${tracking || '—'}</strong>
        <div style="color:#666;font-size:11px;margin-top:2px">${desc || '—'}</div>
      </td>
      <td style="padding:8px 10px;border-bottom:1px solid #e0e0e0;text-align:center;font-size:13px;font-weight:600">${weight > 0 ? `${weight.toFixed(1)}` : '—'}</td>
      <td style="padding:8px 10px;border-bottom:1px solid #e0e0e0;text-align:right;font-size:12px">$${pricePerLb.toFixed(2)}</td>
      <td style="padding:8px 10px;border-bottom:1px solid #e0e0e0;text-align:right;font-size:12px;color:#666">$${Number(i.tax).toFixed(2)}</td>
      <td style="padding:8px 10px;border-bottom:1px solid #e0e0e0;text-align:right;font-size:13px;font-weight:600">$${Number(i.total).toFixed(2)}</td>
    </tr>`;
  }).join('');

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Recibo #${receiptNum}</title>
  <style>
    @page { margin: 12mm 15mm; size: A4; }
    * { box-sizing: border-box; }
    body {
      font-family: 'Segoe UI', 'Helvetica Neue', Arial, sans-serif;
      font-size: 12px; color: #222; margin: 0; padding: 0;
      line-height: 1.5;
    }
    .container { max-width: 210mm; margin: 0 auto; padding: 0; }

    /* Header */
    .header { text-align: center; margin-bottom: 24px; padding-bottom: 16px; border-bottom: 3px solid #1a237e; }
    .header .company { font-size: 22px; font-weight: 700; color: #1a237e; letter-spacing: 1px; margin: 0 0 4px; }
    .header .title { font-size: 16px; font-weight: 600; color: #333; margin: 0 0 8px; text-transform: uppercase; letter-spacing: 2px; }
    .header .meta { font-size: 11px; color: #666; margin: 0; }
    .header .meta strong { color: #333; }
    .header .receipt-num { font-size: 28px; font-weight: 700; color: #1a237e; margin: 8px 0; font-family: monospace; letter-spacing: 1px; }

    /* Sections */
    .section { margin-bottom: 20px; }
    .section-title {
      font-size: 13px; font-weight: 700; color: #1a237e;
      text-transform: uppercase; letter-spacing: 1px;
      margin: 0 0 10px; padding-bottom: 6px;
      border-bottom: 2px solid #1a237e;
    }
    .info-table { width: 100%; border-collapse: collapse; }
    .info-table td { padding: 4px 8px 4px 0; vertical-align: top; font-size: 12px; }
    .info-table .label { color: #888; width: 100px; font-size: 11px; }
    .info-table .value { font-weight: 600; color: #222; }

    /* Packages table */
    .pkg-table { width: 100%; border-collapse: collapse; margin-top: 4px; }
    .pkg-table thead th {
      background: #1a237e; color: #fff; padding: 10px;
      text-align: left; font-size: 11px; font-weight: 600;
      text-transform: uppercase; letter-spacing: 0.5px;
    }
    .pkg-table thead th.right { text-align: right; }
    .pkg-table thead th.center { text-align: center; }
    .pkg-table tbody tr:nth-child(even) { background: #f8f9fc; }
    .pkg-table tbody tr:last-child td { border-bottom: 2px solid #1a237e; }

    /* Totals */
    .totals { margin-left: auto; width: 320px; margin-top: 8px; }
    .totals table { width: 100%; border-collapse: collapse; }
    .totals td { padding: 6px 10px; font-size: 13px; }
    .totals .label { text-align: right; color: #666; }
    .totals .amount { text-align: right; font-weight: 600; width: 120px; }
    .totals .separator td { border-top: 1px solid #ccc; padding: 0; }
    .totals .grand td { font-size: 16px; font-weight: 700; color: #1a237e; padding-top: 8px; padding-bottom: 8px; border-top: 2px solid #1a237e; }
    .totals .grand .amount { font-size: 18px; }

    /* Footer */
    .footer { margin-top: 32px; text-align: center; font-size: 10px; color: #999; border-top: 1px solid #ddd; padding-top: 16px; }
    .footer p { margin: 2px 0; }

    /* Payment summary box */
    .payment-box { background: #f0f4ff; border: 1px solid #c5cae9; border-radius: 6px; padding: 12px 16px; margin-bottom: 20px; }
    .payment-box table { width: 100%; border-collapse: collapse; }
    .payment-box td { padding: 3px 8px; font-size: 12px; }
    .payment-box .label { color: #555; width: 110px; }
    .payment-box .value { font-weight: 600; }

    @media print {
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .pkg-table thead th { background: #1a237e !important; color: #fff !important; }
      .pkg-table tbody tr:nth-child(even) { background: #f8f9fc !important; }
      .payment-box { background: #f0f4ff !important; }
    }
  </style>
</head>
<body>
  <div class="container">

    <!-- Header -->
    <div class="header">
      <p class="company">COURIER SERVICE</p>
      <p class="title">Recibo de Pago</p>
      <p class="receipt-num">${receiptNum}</p>
      <p class="meta">Fecha: ${paidDate} &nbsp;|&nbsp; Método: <strong>${methodLabel}</strong></p>
    </div>

    <!-- Customer -->
    <div class="section">
      <div class="section-title">Cliente</div>
      <table class="info-table">
        <tr>
          <td class="label">Nombre</td>
          <td class="value">${customer.name || ''} ${customer.lastName || ''}</td>
          <td class="label">Código</td>
          <td class="value">${customer.code || '—'}</td>
        </tr>
        <tr>
          <td class="label">Documento</td>
          <td class="value">${customer.document || '—'}</td>
          <td class="label">Teléfono</td>
          <td class="value">${customer.phone || '—'}</td>
        </tr>
      </table>
    </div>

    <!-- Payment summary -->
    <div class="payment-box">
      <table>
        <tr>
          <td class="label">Monto pagado</td>
          <td class="value" style="font-size:18px;font-weight:700;color:#1a237e">$${Number(payment.amount || total).toFixed(2)}</td>
          <td class="label">Pagado por</td>
          <td class="value">${payment.processedById?.name || '—'}</td>
          <td class="label">Estado</td>
          <td class="value" style="color:#2e7d32">${payment.status === 'paid' ? 'Pagado' : payment.status}</td>
        </tr>
      </table>
    </div>

    <!-- Packages -->
    <div class="section">
      <div class="section-title">Paquetes incluidos</div>
      <table class="pkg-table">
        <thead>
          <tr>
            <th style="width:30%">Tracking / Descripción</th>
            <th class="center" style="width:10%">Lbs</th>
            <th class="right" style="width:17%">Precio x lb</th>
            <th class="right" style="width:17%">ITBIS</th>
            <th class="right" style="width:17%">Total</th>
          </tr>
        </thead>
        <tbody>
          ${pkgRows || '<tr><td colspan="5" style="padding:16px;text-align:center;color:#999">Sin paquetes detallados</td></tr>'}
        </tbody>
      </table>

      <!-- Totals -->
      <table class="totals">
        <tr>
          <td class="label">Subtotal</td>
          <td class="amount">$${Number(subtotal).toFixed(2)}</td>
        </tr>
        <tr>
          <td class="label">ITBIS (18%)</td>
          <td class="amount">$${Number(tax).toFixed(2)}</td>
        </tr>
        <tr class="separator"><td colspan="2"></td></tr>
        <tr class="grand">
          <td class="label">TOTAL</td>
          <td class="amount">$${Number(total).toFixed(2)}</td>
        </tr>
      </table>
    </div>

    <!-- Notes -->
    ${payment.notes ? `
    <div class="section">
      <div class="section-title">Notas</div>
      <p style="margin:0;font-size:12px;color:#555">${payment.notes}</p>
    </div>` : ''}

    <!-- Footer -->
    <div class="footer">
      <p>Gracias por confiar en nosotros.</p>
      <p>Este recibo fue generado electrónicamente el ${paidDate}.</p>
    </div>

  </div>
</body>
</html>`;
}

export default function PaymentDetailPage() {
  const { id } = useParams();
  const [payment, setPayment] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    paymentService.findById(id)
      .then((res) => setPayment(res.data))
      .finally(() => setLoading(false));
  }, [id]);

  const handlePrint = useCallback(() => {
    if (!payment) return;
    openPrintWindow(buildReceiptHtml(payment));
  }, [payment]);

  if (loading) return <div className="text-center py-12 text-gray-400">Cargando...</div>;
  if (!payment) return <div className="text-center py-12 text-gray-400">Pago no encontrado</div>;

  const receipt = payment.receipt;
  const receiptNum = payment.receiptNumber || payment._id.slice(-6);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Pago {receiptNum}</h1>
          <p className="text-sm text-gray-500">Recibo #{receiptNum}</p>
        </div>
        <div className="flex items-center gap-3">
          <Button onClick={handlePrint}>Imprimir Recibo</Button>
          {receipt?.pdfUrl && (
            <a
              href={receipt.pdfUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-primary-600 hover:text-primary-700 underline"
            >
              Descargar PDF
            </a>
          )}
          <Link
            to="/payments"
            className="px-4 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            Volver a pagos
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Payment info */}
        <Card className="lg:col-span-2">
          <h2 className="text-lg font-semibold mb-4">Información del pago</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-gray-500">Cliente</p>
              <p className="font-medium">
                {payment.customerId?.name} {payment.customerId?.lastName}
              </p>
              {payment.customerId?.code && (
                <p className="text-sm text-gray-500">{payment.customerId.code}</p>
              )}
              {payment.customerId?.document && (
                <p className="text-sm text-gray-500">Doc: {payment.customerId.document}</p>
              )}
              {payment.customerId?.phone && (
                <p className="text-sm text-gray-500">Tel: {payment.customerId.phone}</p>
              )}
            </div>
            <div className="space-y-2">
              <div>
                <p className="text-sm text-gray-500">Monto</p>
                <p className="text-xl font-bold">{formatCurrency(payment.amount)}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Método</p>
                <Badge>{METHOD_LABELS[payment.method] || payment.method}</Badge>
              </div>
              <div>
                <p className="text-sm text-gray-500">Estado</p>
                <Badge variant={payment.status === 'paid' ? 'success' : payment.status === 'pending' ? 'warning' : 'default'}>
                  {payment.status === 'paid' ? 'Pagado' : payment.status === 'pending' ? 'Pendiente' : payment.status}
                </Badge>
              </div>
            </div>
            <div>
              <p className="text-sm text-gray-500">Fecha de pago</p>
              <p className="font-medium">{payment.paidAt ? formatDateTime(payment.paidAt) : '—'}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Procesado por</p>
              <p className="font-medium">{payment.processedById?.name || '—'}</p>
            </div>
            {payment.notes && (
              <div className="col-span-2">
                <p className="text-sm text-gray-500">Notas</p>
                <p className="font-medium">{payment.notes}</p>
              </div>
            )}
          </div>
        </Card>

        {/* Receipt summary */}
        {receipt && (
          <Card>
            <h2 className="text-lg font-semibold mb-4">Resumen del recibo</h2>
            <div className="space-y-3 text-sm">
              {receipt.items?.map((item: any, i: number) => (
                <div key={i} className="border-b border-gray-100 dark:border-gray-700 pb-2">
                  <p className="font-medium truncate">{item.description}</p>
                  <div className="flex justify-between text-gray-500">
                    <span>Subtotal</span>
                    <span>{formatCurrency(item.amount)}</span>
                  </div>
                  <div className="flex justify-between text-gray-500">
                    <span>Impuesto</span>
                    <span>{formatCurrency(item.tax)}</span>
                  </div>
                  <div className="flex justify-between font-medium">
                    <span>Total</span>
                    <span>{formatCurrency(item.total)}</span>
                  </div>
                </div>
              ))}
              <hr className="dark:border-gray-700" />
              <div className="flex justify-between">
                <span>Subtotal</span>
                <span>{formatCurrency(receipt.subtotal)}</span>
              </div>
              <div className="flex justify-between">
                <span>Impuesto</span>
                <span>{formatCurrency(receipt.tax)}</span>
              </div>
              <div className="flex justify-between font-semibold text-base">
                <span>Total</span>
                <span>{formatCurrency(receipt.total)}</span>
              </div>
            </div>
          </Card>
        )}
      </div>

      {/* Packages */}
      <Card>
        <h2 className="text-lg font-semibold mb-4">Paquetes incluidos</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700">
                <th className="text-left py-2 px-3 font-medium text-gray-500">Tracking</th>
                <th className="text-left py-2 px-3 font-medium text-gray-500">Descripción</th>
                <th className="text-right py-2 px-3 font-medium text-gray-500">Peso</th>
                <th className="text-right py-2 px-3 font-medium text-gray-500">Total</th>
                <th className="text-center py-2 px-3 font-medium text-gray-500">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {payment.packages?.map((pkg: any) => (
                <tr key={pkg._id} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                  <td className="py-2 px-3 font-mono">{pkg.tracking}</td>
                  <td className="py-2 px-3 text-gray-600 dark:text-gray-400 truncate max-w-[250px]">
                    {pkg.description || '—'}
                  </td>
                  <td className="py-2 px-3 text-right">{pkg.weight ? `${pkg.weight} lbs` : '—'}</td>
                  <td className="py-2 px-3 text-right font-medium">{formatCurrency(pkg.total)}</td>
                  <td className="py-2 px-3 text-center">
                    <Badge variant={pkg.status === 'entregado' ? 'success' : 'default'}>
                      {pkg.status?.replace(/_/g, ' ') || '—'}
                    </Badge>
                  </td>
                </tr>
              ))}
              {(!payment.packages || payment.packages.length === 0) && (
                <tr>
                  <td colSpan={5} className="text-center py-8 text-gray-400">
                    Sin paquetes asociados
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

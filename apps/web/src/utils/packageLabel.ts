import JsBarcode from 'jsbarcode';
import type { Package } from '../types/package';
import { formatDate } from './formatDate';

const DEFAULT_COMPANY_NAME = 'COURIER EXPRESS';

// Debounce: prevent rapid repeated clicks from opening multiple print windows.
let lastPrintAt = 0;
const PRINT_COOLDOWN_MS = 1500;

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function truncate(value: string, maxLength = 48): string {
  return value.length > maxLength ? `${value.slice(0, maxLength - 1)}…` : value;
}

/**
 * Builds the exact-size label HTML (100mm x 60mm) for a package.
 * Pure function, safe to test without a browser. The barcode SVG is rendered
 * later (in printPackageLabel) into the placeholder below.
 */
export function buildPackageLabelHtml(pkg: Package, companyName?: string): string {
  const company = companyName || DEFAULT_COMPANY_NAME;
  const customer = pkg.customerId || ({} as any);
  const customerName = [customer.name, customer.lastName].filter(Boolean).join(' ').trim();
  const customerCode = customer.code || '—';
  const weight = Number(pkg.weight) || 0;
  let receivedAt = '—';
  try {
    receivedAt = pkg.receivedAt ? formatDate(pkg.receivedAt) : '—';
  } catch {
    receivedAt = '—';
  }
  const branchName = pkg.branchId?.name || '—';
  const description = pkg.description ? escapeHtml(truncate(pkg.description)) : '—';

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Etiqueta ${escapeHtml(pkg.tracking)}</title>
  <style>
    @page { size: 100mm 60mm; margin: 0; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    html, body { width: 100mm; height: 60mm; overflow: hidden; }
    body {
      font-family: 'Segoe UI', 'Helvetica Neue', Arial, sans-serif;
      color: #000;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .label-sheet {
      width: 100mm;
      height: 60mm;
      padding: 3mm 4mm;
      display: flex;
      flex-direction: column;
    }
    .header {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      border-bottom: 2px solid #000;
      padding-bottom: 1.5mm;
    }
    .company { font-size: 14px; font-weight: 700; letter-spacing: 1px; }
    .tag { font-size: 9px; font-weight: 600; letter-spacing: 1px; text-transform: uppercase; color: #444; }
    .tracking {
      font-family: Consolas, 'Courier New', monospace;
      font-size: 16px;
      font-weight: 700;
      letter-spacing: 2px;
      margin-top: 1.5mm;
    }
    .fields { width: 100%; border-collapse: collapse; margin-top: 2mm; }
    .fields td { font-size: 10px; padding: 0.8mm 1mm 0.8mm 0; vertical-align: top; }
    .fields .label {
      color: #555;
      font-size: 8px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      white-space: nowrap;
    }
    .fields .label + td { padding-left: 0; padding-right: 3mm; font-weight: 600; }
    .barcode {
      margin-top: auto;
      text-align: center;
      padding-top: 2mm;
      border-top: 1px solid #ccc;
    }
    .barcode svg { display: block; margin: 0 auto; max-width: 100%; height: auto; }
    .barcode .tracking-text {
      font-family: Consolas, 'Courier New', monospace;
      font-size: 12px;
      font-weight: 700;
      letter-spacing: 3px;
      margin-top: 1mm;
    }
  </style>
</head>
<body>
  <div class="label-sheet">
    <div class="header">
      <span class="company">${escapeHtml(company)}</span>
      <span class="tag">Paquete</span>
    </div>
    <div class="tracking">${escapeHtml(pkg.tracking)}</div>
    <table class="fields">
      <tr>
        <td class="label">Cliente</td>
        <td>${escapeHtml(customerName || '—')}</td>
        <td class="label">Peso</td>
        <td>${weight > 0 ? `${weight.toFixed(1)} lbs` : '—'}</td>
      </tr>
      <tr>
        <td class="label">Código</td>
        <td>${escapeHtml(customerCode)}</td>
        <td class="label">Fecha</td>
        <td>${receivedAt}</td>
      </tr>
      <tr>
        <td class="label">Sucursal</td>
        <td>${escapeHtml(branchName)}</td>
        <td class="label"></td>
        <td></td>
      </tr>
      <tr>
        <td class="label">Descripción</td>
        <td colspan="3">${description}</td>
      </tr>
    </table>
    <div class="barcode">
      <svg id="barcode"></svg>
      <div class="tracking-text">${escapeHtml(pkg.tracking)}</div>
    </div>
  </div>
</body>
</html>`;
}

/**
 * Opens a blank window, writes the label HTML, renders the Code128 barcode of
 * the tracking number into the SVG placeholder, and triggers the browser print
 * dialog. Follows the same pattern as PaymentDetailPage.openPrintWindow.
 */
export function printPackageLabel(pkg: Package, companyName?: string): void {
  const now = Date.now();
  if (now - lastPrintAt < PRINT_COOLDOWN_MS) return;
  lastPrintAt = now;

  const win = window.open('', '_blank');
  if (!win) {
    alert('Pop-up bloqueado. Permití ventanas emergentes para imprimir la etiqueta.');
    return;
  }

  try {
    win.document.write(buildPackageLabelHtml(pkg, companyName));
  } catch (err) {
    win.close();
    console.error('Error generando la etiqueta:', err);
    alert('No se pudo generar la etiqueta. Revisá los datos del paquete.');
    return;
  }
  win.document.close();
  win.focus();

  const svg = win.document.getElementById('barcode');
  if (svg) {
    try {
      JsBarcode(svg as unknown as SVGSVGElement, pkg.tracking, {
        format: 'CODE128',
        width: 1.8,
        height: 48,
        displayValue: false,
        margin: 0,
        xmlDocument: win.document as XMLDocument,
      });
    } catch (err) {
      // Barcode failed to render; label still prints without it.
      console.error('Error rendering barcode:', err);
    }
  }

  setTimeout(() => win.print(), 500);
}

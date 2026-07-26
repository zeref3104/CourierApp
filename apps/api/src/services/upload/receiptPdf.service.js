const PDFDocument = require('pdfkit');
const cloudinary = require('cloudinary').v2;
const stream = require('stream');
const path = require('path');
const fs = require('fs');
const os = require('os');
const config = require('../../config');
const logger = require('../../logs/logger');

/**
 * PDF Receipt Generator.
 * Creates a PDF receipt for a payment and uploads it to Cloudinary.
 */
class ReceiptPdfService {
  /**
   * Generate a receipt PDF and return its URL.
   *
   * @param {Object} receiptData - { receiptNumber, package, customer, payment, items, subtotal, tax, total, companyName }
   * @returns {Promise<string|null>} PDF URL or null if generation fails
   */
  async generateReceipt(receiptData) {
    try {
      const doc = new PDFDocument({
        size: 'A4',
        margin: 50,
        info: {
          Title: `Recibo #${receiptData.receiptNumber}`,
          Author: 'Courier SaaS Platform',
        },
      });

      // Collect PDF chunks into a buffer
      const chunks = [];
      const writeStream = new stream.Writable({
        write(chunk, encoding, callback) {
          chunks.push(chunk);
          callback();
        },
      });

      doc.pipe(writeStream);

      // --- Header ---
      doc.fontSize(22).font('Helvetica-Bold').text(receiptData.companyName || 'Courier Service', { align: 'center' });
      doc.fontSize(10).font('Helvetica').text('RECIBO DE PAGO', { align: 'center' });
      doc.moveDown(0.5);
      doc.fontSize(10).text(`Recibo #: ${receiptData.receiptNumber}`, { align: 'right' });
      doc.text(`Fecha: ${new Date().toLocaleDateString('es-DO')}`, { align: 'right' });
      doc.text(`Método de pago: ${receiptData.payment?.method || 'N/A'}`, { align: 'right' });
      doc.moveDown(1);

      // --- Separator ---
      doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke();
      doc.moveDown(0.5);

      // --- Customer info ---
      doc.fontSize(11).font('Helvetica-Bold').text('Cliente:');
      doc.fontSize(10).font('Helvetica').text(`${receiptData.customer?.name || ''} ${receiptData.customer?.lastName || ''}`);
      if (receiptData.customer?.document) doc.text(`Documento: ${receiptData.customer.document}`);
      if (receiptData.customer?.phone) doc.text(`Teléfono: ${receiptData.customer.phone}`);
      doc.moveDown(1);

      // --- Package(s) info ---
      const pkgList = receiptData.packages || (receiptData.package ? [receiptData.package] : []);
      doc.fontSize(11).font('Helvetica-Bold').text(pkgList.length > 1 ? 'Paquetes:' : 'Paquete:');
      doc.fontSize(10).font('Helvetica');
      pkgList.forEach((p, i) => {
        doc.text(`${i + 1}. Tracking: ${p.tracking || 'N/A'} — ${p.description || 'Sin descripción'} (${p.weight || 0} lbs)`);
      });
      doc.moveDown(1);

      // --- Items table ---
      doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke();
      doc.moveDown(0.5);

      const tableTop = doc.y;
      const col1 = 50;
      const col2 = 350;
      const col3 = 450;
      const col4 = 500;

      doc.fontSize(10).font('Helvetica-Bold');
      doc.text('Descripción', col1, tableTop);
      doc.text('Monto', col2, tableTop, { width: 90, align: 'right' });
      doc.text('ITBIS', col3, tableTop, { width: 50, align: 'right' });
      doc.text('Total', col4, tableTop, { width: 50, align: 'right' });

      doc.moveDown(0.3);
      doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke();
      doc.moveDown(0.3);

      doc.fontSize(10).font('Helvetica');

      const items = receiptData.items || (Array.isArray(receiptData.packages)
        ? receiptData.packages.map((p) => ({
            description: `Envío #${p.tracking || ''}`,
            amount: p.cost || 0,
            tax: p.tax || 0,
            total: p.total || 0,
          }))
        : [{
            description: `Envío #${receiptData.package?.tracking || ''}`,
            amount: receiptData.subtotal || 0,
            tax: receiptData.tax || 0,
            total: receiptData.total || 0,
          }]
      );

      items.forEach((item) => {
        const y = doc.y;
        doc.text(item.description, col1, y, { width: 290 });
        doc.text(`$${Number(item.amount).toFixed(2)}`, col2, y, { width: 90, align: 'right' });
        doc.text(`$${Number(item.tax).toFixed(2)}`, col3, y, { width: 50, align: 'right' });
        doc.text(`$${Number(item.total).toFixed(2)}`, col4, y, { width: 50, align: 'right' });
        doc.moveDown(0.5);
      });

      // --- Totals ---
      doc.moveDown(0.5);
      doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke();
      doc.moveDown(0.5);

      const totalY = doc.y;
      doc.fontSize(11).font('Helvetica-Bold');
      doc.text('Subtotal:', col1, totalY);
      doc.text(`$${Number(receiptData.subtotal || 0).toFixed(2)}`, col4, totalY, { width: 50, align: 'right' });

      doc.moveDown(0.5);
      const taxY = doc.y;
      doc.fontSize(10).font('Helvetica');
      doc.text('ITBIS:', col1, taxY);
      doc.text(`$${Number(receiptData.tax || 0).toFixed(2)}`, col4, taxY, { width: 50, align: 'right' });

      doc.moveDown(0.5);
      const finalY = doc.y;
      doc.fontSize(13).font('Helvetica-Bold');
      doc.text('TOTAL:', col1, finalY);
      doc.text(`$${Number(receiptData.total || 0).toFixed(2)}`, col4, finalY, { width: 50, align: 'right' });

      doc.moveDown(2);
      doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke();
      doc.moveDown(1);

      // --- Footer ---
      doc.fontSize(9).font('Helvetica').fillColor('#666');
      doc.text('Gracias por confiar en nosotros.', { align: 'center' });
      doc.text('Este es un documento generado automáticamente.', { align: 'center' });

      doc.end();

      // Wait for the PDF to finish writing
      return new Promise((resolve, reject) => {
        writeStream.on('finish', async () => {
          const buffer = Buffer.concat(chunks);

          try {
            // Upload to Cloudinary
            if (config.cloudinary.cloudName && config.cloudinary.apiKey) {
              const result = await new Promise((resolveUpload, rejectUpload) => {
                const uploadStream = cloudinary.uploader.upload_stream(
                  {
                    folder: 'courier/receipts',
                    public_id: `receipt-${receiptData.receiptNumber}`,
                    resource_type: 'raw',
                    format: 'pdf',
                  },
                  (error, result) => {
                    if (error) rejectUpload(error);
                    else resolveUpload(result);
                  }
                );
                const bufferStream = new stream.PassThrough();
                bufferStream.end(buffer);
                bufferStream.pipe(uploadStream);
              });

              logger.debug('Receipt PDF uploaded to Cloudinary: %s', result.secure_url);
              resolve(result.secure_url);
            } else {
              // Fallback: save locally
              const receiptsDir = path.join(os.tmpdir(), 'courier-receipts');
              if (!fs.existsSync(receiptsDir)) {
                fs.mkdirSync(receiptsDir, { recursive: true });
              }
              const filePath = path.join(receiptsDir, `receipt-${receiptData.receiptNumber}.pdf`);
              fs.writeFileSync(filePath, buffer);
              logger.debug('Receipt PDF saved locally: %s', filePath);
              resolve(filePath);
            }
          } catch (err) {
            logger.error('Receipt PDF upload failed: %s', err.message);
            resolve(null);
          }
        });

        writeStream.on('error', (err) => {
          logger.error('Receipt PDF stream error: %s', err.message);
          resolve(null);
        });
      });
    } catch (err) {
      logger.error('Receipt PDF generation failed: %s', err.message);
      return null;
    }
  }
}

module.exports = new ReceiptPdfService();

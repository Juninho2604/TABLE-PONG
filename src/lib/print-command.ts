'use client';

/**
 * Utilidad para imprimir recibos y comandas con formato térmico 80mm
 * Tipografía estilo sistema de facturación venezolano
 */

interface ReceiptItem {
    name: string;
    quantity: number;
    unitPrice: number;
    total: number;
    sku?: string;
    modifiers: string[];
    notes?: string;
}

interface ReceiptData {
    orderNumber: string;
    orderType: 'RESTAURANT' | 'DELIVERY';
    date: Date | string;
    cashierName: string;
    customerName?: string;
    customerAddress?: string;
    items: ReceiptItem[];
    subtotal?: number;
    discount?: number;
    total: number;
    serviceFee?: number;
}

export function printReceipt(data: ReceiptData) {
    const printWindow = window.open('', '_blank', 'width=380,height=700');
    if (!printWindow) {
        alert('Habilite popups para imprimir');
        return;
    }

    const date = new Date(data.date);
    const formattedDate = date.toLocaleDateString('es-VE', { timeZone: 'America/Caracas' });
    const formattedTime = date.toLocaleTimeString('es-VE', {
        hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false, timeZone: 'America/Caracas'
    });

    const subtotal = data.subtotal ?? data.items.reduce((s, i) => s + i.total, 0);
    const discountAmount = data.discount ?? 0;
    const netTotal = data.total;
    const serviceFee = netTotal * 0.10;
    const totalConServicio = netTotal + serviceFee;

    // Número corto de orden (últimos dígitos)
    const shortNum = data.orderNumber.split('-').pop() || data.orderNumber;

    const itemRows = data.items.map((item) => {
        const modText = item.modifiers.length > 0
            ? `<div class="mod">  + ${item.modifiers.join(', ')}</div>`
            : '';
        const noteText = item.notes
            ? `<div class="note">  * ${item.notes}</div>`
            : '';
        return `
        <tr>
          <td class="col-item">
            <span class="item-name">${item.name.toUpperCase()}</span>
            ${modText}${noteText}
          </td>
          <td class="col-qty">${item.quantity.toFixed(2)}</td>
          <td class="col-price">$${item.unitPrice.toFixed(2)}</td>
          <td class="col-total">$${item.total.toFixed(2)}</td>
        </tr>`;
    }).join('');

    const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<title>Factura ${shortNum}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }

  body {
    font-family: 'Courier New', Courier, 'Lucida Console', monospace;
    font-size: 11px;
    line-height: 1.4;
    color: #000;
    background: #fff;
    width: 76mm;
    padding: 3mm 2mm;
  }

  /* ── CABECERA ── */
  .header {
    text-align: center;
    margin-bottom: 6px;
  }
  .logo {
    font-size: 22px;
    font-weight: 900;
    letter-spacing: 4px;
    font-family: Arial Black, sans-serif;
    line-height: 1.1;
  }
  .subtitle {
    font-size: 9px;
    letter-spacing: 2px;
    margin: 1px 0;
  }
  .company {
    font-size: 10px;
    font-weight: bold;
    margin-top: 3px;
    letter-spacing: 1px;
  }
  .rif {
    font-size: 9px;
    letter-spacing: 1px;
  }
  .doc-type {
    font-size: 12px;
    font-weight: 900;
    letter-spacing: 3px;
    border: 2px solid #000;
    display: inline-block;
    padding: 2px 8px;
    margin-top: 4px;
  }

  /* ── SEPARADORES ── */
  .sep  { border-top: 1px dashed #000; margin: 4px 0; }
  .sep2 { border-top: 2px solid #000;  margin: 4px 0; }

  /* ── DATOS ORDEN ── */
  .info-row {
    display: flex;
    justify-content: space-between;
    font-size: 10px;
    padding: 1px 0;
  }
  .info-row .lbl { font-weight: bold; }

  /* ── CLIENTE ── */
  .cliente-block {
    font-size: 10px;
    padding: 3px 0;
  }
  .cliente-block .lbl { font-weight: bold; font-size: 9px; letter-spacing: 1px; }
  .cliente-block .val { font-size: 11px; text-transform: uppercase; }

  /* ── TABLA DE ITEMS ── */
  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 10px;
  }
  thead tr th {
    font-weight: bold;
    font-size: 9px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    border-bottom: 1px solid #000;
    padding: 2px 1px;
  }
  .col-item  { width: 48%; text-align: left;  padding: 3px 1px; }
  .col-qty   { width: 14%; text-align: center; padding: 3px 1px; }
  .col-price { width: 19%; text-align: right;  padding: 3px 1px; }
  .col-total { width: 19%; text-align: right;  padding: 3px 1px; }
  .item-name { font-weight: bold; font-size: 10px; }
  .mod  { font-style: italic; font-size: 9px; color: #333; }
  .note { font-style: italic; font-size: 9px; }
  tbody tr { border-bottom: 1px dotted #ccc; }

  /* ── TOTALES ── */
  .totals { margin-top: 4px; }
  .tot-row {
    display: flex;
    justify-content: space-between;
    padding: 1px 0;
    font-size: 11px;
  }
  .tot-row.big {
    font-size: 13px;
    font-weight: 900;
    padding: 3px 0;
  }
  .tot-row.service {
    font-size: 10px;
    font-style: italic;
    color: #333;
  }
  .tot-row.grand {
    font-size: 14px;
    font-weight: 900;
    border-top: 2px solid #000;
    border-bottom: 2px solid #000;
    padding: 3px 0;
    margin: 2px 0;
  }
  .tot-row.pagado { font-size: 10px; }

  /* ── PIE ── */
  .footer {
    text-align: center;
    margin-top: 10px;
    font-size: 9px;
    letter-spacing: 1px;
  }
  .footer .gracias {
    font-size: 11px;
    font-weight: bold;
    letter-spacing: 2px;
    margin-bottom: 2px;
  }

  @media print {
    @page { margin: 0; size: 80mm auto; }
    body  { padding: 2mm; }
  }
</style>
</head>
<body>

<!-- CABECERA -->
<div class="header">
  <div class="logo">TABLE PONG</div>
  <div class="subtitle">- SANTA PAULA -</div>
  <div class="company">TABLE PONG SANTA PAULA, C.A.</div>
  <div class="rif">RIF: J-XXXXXXXXX-X</div>
  <div class="doc-type">RECIBO DE PAGO</div>
</div>

<div class="sep2"></div>

<!-- DATOS DE LA ORDEN -->
<div class="info-row"><span class="lbl">NUMERO:</span><span>${shortNum}</span></div>
<div class="info-row"><span class="lbl">FECHA :</span><span>${formattedDate}</span></div>
<div class="info-row"><span class="lbl">HORA  :</span><span>${formattedTime}</span></div>
<div class="info-row"><span class="lbl">CAJA  :</span><span>${data.cashierName.toUpperCase()}</span></div>
<div class="info-row"><span class="lbl">TIPO  :</span><span>${data.orderType === 'RESTAURANT' ? 'RESTAURANTE' : 'DELIVERY'}</span></div>

<div class="sep"></div>

<!-- CLIENTE -->
<div class="cliente-block">
  <div class="lbl">CLIENTE:</div>
  <div class="val">${(data.customerName && data.customerName.trim()) ? data.customerName.trim() : 'CONSUMIDOR FINAL'}</div>
  ${data.customerAddress ? `<div style="font-size:9px;margin-top:1px;">DIR: ${data.customerAddress}</div>` : ''}
</div>

<div class="sep2"></div>

<!-- ITEMS -->
<table>
  <thead>
    <tr>
      <th class="col-item">Descripción</th>
      <th class="col-qty">Cant</th>
      <th class="col-price">P.Unit</th>
      <th class="col-total">Monto</th>
    </tr>
  </thead>
  <tbody>
    ${itemRows}
  </tbody>
</table>

<div class="sep2"></div>

<!-- TOTALES -->
<div class="totals">
  <div class="tot-row"><span>Subtotal:</span><span>$${subtotal.toFixed(2)}</span></div>
  ${discountAmount > 0 ? `<div class="tot-row"><span>Descuento:</span><span>-$${discountAmount.toFixed(2)}</span></div>` : ''}
  <div class="tot-row big"><span>TOTAL:</span><span>$${netTotal.toFixed(2)}</span></div>
  <div class="sep"></div>
  <div class="tot-row service"><span>+ 10% Servicio (sugerido):</span><span>$${serviceFee.toFixed(2)}</span></div>
  <div class="tot-row grand"><span>TOTAL C/SERVICIO:</span><span>$${totalConServicio.toFixed(2)}</span></div>
</div>

<div class="sep"></div>

<!-- PIE -->
<div class="footer">
  <div class="gracias">¡GRACIAS POR SU VISITA!</div>
  <div>Vuelva pronto · table-pong.vercel.app</div>
  <div style="margin-top:6px; font-size:8px;">Este recibo no es una factura fiscal</div>
</div>

<script>
  window.onload = function() {
    window.print();
    setTimeout(function() { window.close(); }, 600);
  };
</script>
</body>
</html>`;

    printWindow.document.write(html);
    printWindow.document.close();
}

/**
 * COMANDA COCINA (Sin precios, letras grandes)
 */
export function printKitchenCommand(data: any) {
    const printWindow = window.open('', '_blank', 'width=380,height=600');
    if (!printWindow) return;

    const date = new Date(data.createdAt);
    const formattedTime = date.toLocaleTimeString('es-VE', {
        hour: '2-digit', minute: '2-digit', timeZone: 'America/Caracas'
    });
    const shortNum = data.orderNumber?.split('-').pop() || data.orderNumber;

    const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>COCINA ${shortNum}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: Arial Black, Arial, sans-serif;
    width: 76mm;
    padding: 3mm;
    font-weight: 900;
    background: #fff;
    color: #000;
  }
  .header {
    text-align: center;
    border-bottom: 4px solid #000;
    padding-bottom: 6px;
    margin-bottom: 8px;
  }
  .title { font-size: 16px; letter-spacing: 2px; }
  .num   { font-size: 36px; line-height: 1; margin: 4px 0; }
  .meta  { font-size: 13px; margin-top: 4px; }
  .item  {
    display: flex;
    align-items: flex-start;
    padding: 6px 0;
    border-bottom: 1px dashed #000;
  }
  .qty-box {
    background: #000; color: #fff;
    font-size: 24px;
    min-width: 36px;
    text-align: center;
    padding: 2px 6px;
    border-radius: 4px;
    margin-right: 8px;
    flex-shrink: 0;
  }
  .details { flex: 1; }
  .name { font-size: 17px; line-height: 1.1; }
  .mods { font-size: 13px; font-style: italic; margin-top: 3px; font-weight: 400; }
  .note { font-size: 12px; background: #eee; padding: 2px 4px; margin-top: 2px; border-radius: 2px; font-weight: 400; }
  @media print {
    @page { margin: 0; size: 80mm auto; }
    body  { padding: 2mm; }
  }
</style>
</head>
<body>
<div class="header">
  <div class="title">◆ COMANDA COCINA ◆</div>
  <div class="num">#${shortNum}</div>
  <div class="meta">${formattedTime} &nbsp;·&nbsp; ${data.orderType === 'RESTAURANT' ? 'SALA' : 'DELIVERY'}</div>
  ${data.customerName ? `<div style="font-size:13px;margin-top:3px;">${data.customerName.toUpperCase()}</div>` : ''}
</div>

${(data.items || []).map((item: any) => `
<div class="item">
  <div class="qty-box">${item.quantity}</div>
  <div class="details">
    <div class="name">${item.name.toUpperCase()}</div>
    ${item.modifiers && item.modifiers.length > 0 ? `<div class="mods">+ ${item.modifiers.join('<br>+ ')}</div>` : ''}
    ${item.notes ? `<div class="note">📝 ${item.notes}</div>` : ''}
  </div>
</div>`).join('')}

<script>
  window.onload = function() {
    window.print();
    setTimeout(function() { window.close(); }, 600);
  };
</script>
</body>
</html>`;

    printWindow.document.write(html);
    printWindow.document.close();
}
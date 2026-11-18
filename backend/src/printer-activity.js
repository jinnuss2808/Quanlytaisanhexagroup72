/**
 * Tổng hợp lịch sử bảo trì/đổ mực từ assetMaintenance, không tạo dữ liệu trùng.
 * Danh sách máy in được nhận diện bởi caller (printer-core.js).
 * Tách hàm thuần để kiểm thử độc lập với Firebase.
 */
export const PRINTER_ACTIVITY_TYPES = Object.freeze([
  'replace_toner', 'repair', 'printer_service', 'replace_part', 'maintenance'
]);
const KNOWN_TYPES = new Set(PRINTER_ACTIVITY_TYPES);

export function listPrinterActivity(printers = [], maintenanceByAsset = {}, options = {}) {
  const rows = [];
  for (const printer of printers) {
    if (!printer?.id) continue;
    const history = maintenanceByAsset?.[printer.id] || {};
    if (!history || typeof history !== 'object' || Array.isArray(history)) continue;
    for (const [key, event] of Object.entries(history)) {
      if (!event || typeof event !== 'object' || !KNOWN_TYPES.has(event.type)) continue;
      rows.push({
        id: String(event.id || key),
        printerId: printer.id,
        assetCode: printer.assetCode || '',
        assetName: printer.assetName || 'Máy in chưa có tên',
        ipAddress: printer.ipAddress || '',
        location: printer.location || '',
        deleted: Boolean(printer.deletedAt),
        type: event.type,
        date: event.date || '',
        at: Number.isFinite(Number(event.at)) ? Number(event.at) : 0,
        summary: event.summary || '',
        notes: event.notes || '',
        byName: event.byName || event.performedBy || '',
        performedBy: event.performedBy || '',
        replacedParts: event.replacedParts || '',
        serviceProvider: event.serviceProvider || '',
        stockName: event.stockName || '',
        stockQuantity: event.stockQuantity || null,
        cost: Number.isFinite(Number(event.cost)) ? Number(event.cost) : null,
      });
    }
  }
  const kind = options.kind === 'toner' || options.kind === 'repair' ? options.kind : 'all';
  const q = String(options.search || '').trim().toLocaleLowerCase('vi');
  const filtered = rows.filter(row => {
    if (kind === 'toner' && row.type !== 'replace_toner') return false;
    if (kind === 'repair' && row.type === 'replace_toner') return false;
    return !q || [row.assetCode,row.assetName,row.ipAddress,row.location,row.type,
      row.summary,row.notes,row.byName,row.stockName,row.replacedParts]
      .some(value => String(value ?? '').toLocaleLowerCase('vi').includes(q));
  });
  filtered.sort((a,b)=>b.at-a.at || b.date.localeCompare(a.date) ||
    a.assetCode.localeCompare(b.assetCode,'vi') || a.id.localeCompare(b.id,'vi'));
  const pageSize = Math.min(100, Math.max(1, Math.floor(Number(options.pageSize) || 30)));
  const page = Math.max(1, Math.floor(Number(options.page) || 1));
  return {items:filtered.slice((page-1)*pageSize,page*pageSize),total:filtered.length,
    page,pageSize,totalPages:Math.max(1,Math.ceil(filtered.length/pageSize))};
}

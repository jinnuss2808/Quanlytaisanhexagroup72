import { assetError, asText } from './asset-core.js';
import { isIP } from 'node:net';

// Both legacy Excel categories and newly created assets can identify a printer.
export function isPrinterAsset(item = {}) {
  if (item.isPrinter === true || item.assetType === 'printer') return true;
  const identity = [item.categoryName, item.categoryCode, item.assetName]
    .filter(Boolean).join(' ').normalize('NFC').toLowerCase();
  return /(máy\s*in|may\s*in|printer|laserjet|deskjet|pixma|bizhub|imageclass|image\s*runner|canon\s*(?:lbp|mf|ir)|brother\s*(?:hl|dcp|mfc)|epson\s*l\d+)/i.test(identity);
}

export function validatePrinterToner({printer,stock,stockItemId,operationId,notes}) {
  if (!isPrinterAsset(printer) || printer.deletedAt) throw assetError(400,'Tài sản được chọn không phải máy in đang quản lý.');
  if (!/^[A-Za-z0-9_-]{8,100}$/.test(String(operationId||''))) throw assetError(400,'Mã thao tác đổ mực không hợp lệ.');
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(String(stockItemId||''))) throw assetError(400,'Vui lòng chọn mã mực trong kho.');
  if (!stock || stock.deletedAt || stock.category !== 'ink') throw assetError(400,'Mặt hàng không phải mực in đang quản lý.');
  const previousMovement = stock.movements?.['printer_toner_'+operationId];
  if (!previousMovement && (!Number.isSafeInteger(stock.quantity) || stock.quantity < 1)) throw assetError(409,'Loại mực này đã hết tồn kho.');
  return {operationId,stockItemId,notes:asText(notes,1500)};
}

// Chỉ các trường dành cho hồ sơ máy in; tách khỏi quy trình bàn giao tài sản.
export function normalizePrinterDetails(input = {}) {
  const assetName = asText(input.assetName ?? input.name, 255);
  const ipAddress = asText(input.ipAddress ?? input.ip, 50);
  const tonerType = asText(input.tonerType, 120);
  const tonerStockItemId = asText(input.tonerStockItemId, 128);
  const location = asText(input.location, 255);
  const serialNumber = asText(input.serialNumber, 255);
  const ownerDepartmentId = asText(input.ownerDepartmentId, 128);
  const description = asText(input.description, 1000);
  if (!assetName) throw assetError(400, 'Vui lòng nhập tên máy in.');
  if (ipAddress && !isIP(ipAddress)) throw assetError(400, 'Địa chỉ IP không hợp lệ. Nếu máy in kết nối USB, có thể để trống.');
  if (!tonerType) throw assetError(400, 'Vui lòng nhập loại mực máy in sử dụng.');
  if (tonerStockItemId && !/^[a-zA-Z0-9_-]{1,128}$/.test(tonerStockItemId))
    throw assetError(400, 'Mã mực trong kho không hợp lệ.');
  if (ownerDepartmentId && !/^[a-zA-Z0-9_-]{1,128}$/.test(ownerDepartmentId))
    throw assetError(400, 'Mã công ty sở hữu không hợp lệ.');
  return {assetName, ipAddress:ipAddress||null, tonerType, tonerStockItemId:tonerStockItemId||null,
    location:location||null, serialNumber:serialNumber||null,
    ownerDepartmentId:ownerDepartmentId||null, description:description||null};
}

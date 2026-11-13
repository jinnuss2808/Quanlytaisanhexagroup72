import { gzipSync } from 'node:zlib';

// Inventory scope, excluding Authentication credentials and user account records.
export const BACKUP_PATHS = Object.freeze([
 'assets','assetCodeIndex','assetPublicIds','assetCategories','assetDepartments',
 'assetHistory','assetAssignments','assetMaintenance','assetSoftware','assetImages',
 'warehouseStock','warehouseStockCodes','assetStocktakes'
]);
export async function collectInventoryBackup(db, now=Date.now()){
 const entries=await Promise.all(BACKUP_PATHS.map(async path=>[path,(await db.ref(path).get()).val()]));
 return {schema:'hexa-inventory-backup-v1',createdAt:now,scope:'inventory-only',data:Object.fromEntries(entries)};
}
export function zippedInventoryBackup(snapshot){return gzipSync(Buffer.from(JSON.stringify(snapshot)),{level:6});}

import { randomUUID } from 'node:crypto';
import { db } from './firebase.js';
import { crossedStockThreshold } from './asset-ops.js';
import { notifyPeople } from './notify.js';

// One alert per low-stock period; retries of the same printer refill do not spam IT.
export async function recordStockThreshold(before, after){
  if(!after?.id)return;
  const low=Number(after.quantity)<=Number(after.minQuantity??0);
  const crossing=crossedStockThreshold(before,after);
  const marker='low_'+randomUUID().replaceAll('-','');
  const ref=db.ref(`warehouseAlerts/${after.id}`);
  const tx=await ref.transaction(previous=>{
    const wasActive=previous?.active===true;
    const next={stockId:after.id,sku:after.sku,name:after.name,category:after.category,
      remaining:after.quantity,minQuantity:after.minQuantity??0,active:low,updatedAt:Date.now()};
    if(low&&crossing&&!wasActive)return {...next,notificationMarker:marker};
    // Keep a prior notification marker only while still low. Replenishment resets it.
    return {...next,notificationMarker:low?(previous?.notificationMarker||null):null};
  },undefined,false);
  if(!tx.committed||tx.snapshot.val()?.notificationMarker!==marker)return;
  const users=(await db.ref('users').get()).val()||{};
  const managers=Object.entries(users).filter(([,u])=>u.active===true&&u.role==='manager').map(([uid])=>uid);
  if(managers.length)await notifyPeople(managers,null,`Cảnh báo tồn kho · ${after.sku}`,
    `${after.name}: chỉ còn ${after.quantity} ${after.unit||'đơn vị'}, ngưỡng tối thiểu ${after.minQuantity??0}.`);
}

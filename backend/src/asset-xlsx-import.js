import { assetError, normalizeAsset, asText, keyForCode } from './asset-core.js';

export const canon = v => String(v??'').trim().toLowerCase().replace(/đ/g,'d').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,' ');
export function prepareExcelImport(rows,categories={},departments={},existingCodes=new Set()) {
  const cats={...categories},depts={...departments},existing=new Set(existingCodes);
  const newCategories=[],newDepartments=[],assets=[],errors=[];let skipped=0;
  const getCatalog=(label,dictionary,created,prefix)=>{
    const name=asText(label,255);
    if(!name)return null;
    const match=Object.entries(dictionary).find(([id,x])=>canon(x.name)===canon(name)||canon(x.code)===canon(name));
    if(match)return match[0];
    const id=`${prefix}_${Buffer.from(name).toString('base64url').slice(0,90)}`;
    dictionary[id]={id,name,code:asText(name.toUpperCase(),50),description:'Nhập tự động từ Excel',createdAt:Date.now()};
    created.push(dictionary[id]);return id;
  };
  for(const {row,values} of rows){
    try {
      const [assetCode,categoryName,assetName,departmentName,assignedName,purchasePrice,description,ipAddress]=values;
      const code=asText(assetCode,100);
      if(!code||!asText(assetName,255))throw assetError(400,'Thiếu mã hoặc tên tài sản.');
      const key=keyForCode(code);
      if(existing.has(key)){skipped++;continue;}
      const categoryId=getCatalog(categoryName,cats,newCategories,'excelcat');
      const ownerDepartmentId=getCatalog(departmentName,depts,newDepartments,'exceldept');
      const assignedTo=asText(assignedName,255);
      const data=normalizeAsset({assetCode:code,assetName,categoryId,ownerDepartmentId,assignedTo,
        purchasePrice:purchasePrice===''?null:purchasePrice,description,ipAddress,
        status:assignedTo?'using':'available'});
      assets.push(data);existing.add(key);
    } catch(e){errors.push({row,message:e.message});}
  }
  return {assets,newCategories,newDepartments,errors,skipped};
}

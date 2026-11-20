// HEXA_QR_PHOTO_FIX_20261120
// Kích thước request ảnh nên nhỏ hơn giới hạn payload serverless của Vercel.
export const MAX_UPLOAD_BYTES = 2_800_000;
export const MAX_SOURCE_BYTES = 15 * 1024 * 1024;
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

function asJpeg(blob, originalName) {
  return new File([blob], (originalName || 'anh-tai-san').replace(/\.[^.]+$/, '') + '.jpg', { type: 'image/jpeg' });
}

async function decodeImage(file) {
  if (typeof createImageBitmap === 'function') {
    try {
      const bitmap = await createImageBitmap(file);
      return { width: bitmap.width, height: bitmap.height, draw: (ctx,w,h) => ctx.drawImage(bitmap,0,0,w,h), close: () => bitmap.close() };
    } catch { /* Safari fallback */ }
  }
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    await new Promise((resolve,reject) => { image.onload=resolve; image.onerror=()=>reject(new Error('Không đọc được ảnh.')); image.src=url; });
    return { width:image.naturalWidth, height:image.naturalHeight, draw:(ctx,w,h)=>ctx.drawImage(image,0,0,w,h), close:()=>{} };
  } finally { URL.revokeObjectURL(url); }
}

export async function prepareAssetPhoto(file) {
  if (!file || !ALLOWED_TYPES.includes(file.type)) throw new Error('Chỉ nhận ảnh JPG, PNG hoặc WebP.');
  if (file.size === 0) throw new Error('Tệp ảnh rỗng.');
  if (file.size > MAX_SOURCE_BYTES) throw new Error('Ảnh gốc tối đa 15 MB. Hãy chọn ảnh nhỏ hơn.');
  if (file.size <= MAX_UPLOAD_BYTES) return file;
  let src;
  try {
    src = await decodeImage(file);
    if (!src.width || !src.height) throw new Error('Kích thước ảnh không hợp lệ.');
    let maxSide = 1800;
    let quality = 0.84;
    for (let i=0; i<7; i++) {
      const scale = Math.min(1, maxSide / Math.max(src.width,src.height));
      const width = Math.max(1,Math.round(src.width*scale));
      const height = Math.max(1,Math.round(src.height*scale));
      const canvas = document.createElement('canvas');
      canvas.width=width; canvas.height=height;
      const ctx=canvas.getContext('2d');
      if (!ctx) throw new Error('Trình duyệt không hỗ trợ xử lý ảnh.');
      ctx.fillStyle='#FFFFFF'; ctx.fillRect(0,0,width,height); src.draw(ctx,width,height);
      const blob = await new Promise(resolve => canvas.toBlob(resolve,'image/jpeg',quality));
      canvas.width=0;canvas.height=0;
      if (!blob) throw new Error('Không thể nén ảnh trong trình duyệt.');
      if (blob.size <= MAX_UPLOAD_BYTES) return asJpeg(blob,file.name);
      maxSide=Math.max(500,Math.round(maxSide*0.78)); quality=Math.max(0.45,quality-0.085);
    }
    throw new Error('Không thể giảm ảnh xuống dưới 2,8 MB. Hãy dùng ảnh nhỏ hơn.');
  } finally { src?.close(); }
}

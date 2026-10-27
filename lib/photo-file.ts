export const MAX_PHOTO_BYTES=8*1024*1024;
export function imageSignature(bytes:Uint8Array):string|undefined {
 if(bytes[0]===0xff&&bytes[1]===0xd8&&bytes[2]===0xff)return 'image/jpeg';
 if([137,80,78,71,13,10,26,10].every((v,i)=>bytes[i]===v))return 'image/png';
 if(String.fromCharCode(...bytes.slice(0,4))==='RIFF'&&String.fromCharCode(...bytes.slice(8,12))==='WEBP')return 'image/webp';
}
export async function validatePhoto(file:File){
 if(!file.size||file.size>MAX_PHOTO_BYTES)throw new Error('Use imagem de até 8 MB.');
 const signature=imageSignature(new Uint8Array(await file.slice(0,12).arrayBuffer()));
 if(!signature||signature!==file.type)throw new Error('Formato recusado. Use JPEG, PNG ou WebP válido.');
}

/** Conservative display grammar. Never repair characters, infer units or convert values. */
export type PhotoReading =
 | {kind:'glucose';value:number;unit:'mg/dL'|'mmol/L'}
 | {kind:'pressure';systolic:number;diastolic:number;pulse?:number;unit:'mmHg'};
export type ParseResult = {ok:true;reading:PhotoReading}|{ok:false;reason:string};
export function parseDisplay(text:string,confidence:number):ParseResult {
 const fail=():ParseResult=>({ok:false,reason:'Leitura indeterminada. Fotografe novamente ou preencha manualmente.'});
 if(!Number.isFinite(confidence)||(confidence<85||confidence>100)||text.length>500) return fail();
 const lines=text.trim().split(/\r?\n/).map(l=>l.trim()).filter(Boolean);
 if(!lines.length) return fail();
 // Every line must belong to one display grammar; dates/history/extra candidates are rejected.
 if(lines.length===1){
  const m=/^(\d{1,3}(?:[.,]\d{1,2})?)\s*(mg\/dL|mmol\/L)$/i.exec(lines[0]);
  if(!m)return fail();
  const value=Number(m[1].replace(',','.')); const unit=m[2].toLowerCase()==='mg/dl'?'mg/dL':'mmol/L';
  if(unit==='mg/dL'&&(!Number.isInteger(value)||value<20||value>600))return fail();
  if(unit==='mmol/L'&&(value<1.1||value>33.3))return fail();
  return {ok:true,reading:{kind:'glucose',value,unit}};
 }
 const values:Record<string,number>={};let unit=false;
 for(const line of lines){
  if(/^mmHg$/i.test(line)){if(unit)return fail();unit=true;continue;}
  const m=/^(SYS|DIA|PUL|PULSE)\s*[: ]\s*(\d{2,3})(?:\s*(mmHg|bpm|\/min))?$/i.exec(line);
  if(!m)return fail();
  const key=m[1].toUpperCase().replace('PULSE','PUL');if(key in values)return fail();
  if(m[3]){if(key==='PUL'&&m[3].toLowerCase()==='mmhg')return fail();if(key!=='PUL'&&m[3].toLowerCase()!=='mmhg')return fail();if(key!=='PUL')unit=true;}
  values[key]=Number(m[2]);
 }
 const {SYS:systolic,DIA:diastolic,PUL:pulse}=values;
 if(!unit||!(systolic>=50&&systolic<=260&&diastolic>=30&&diastolic<=160&&systolic>diastolic)||pulse!==undefined&&!(pulse>=30&&pulse<=220))return fail();
 return {ok:true,reading:{kind:'pressure',systolic,diastolic,...(pulse===undefined?{}:{pulse}),unit:'mmHg'}};
}

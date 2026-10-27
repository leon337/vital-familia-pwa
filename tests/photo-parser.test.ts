import {describe,it,expect} from 'vitest';
import {parseDisplay} from '../lib/photo-parser';
import {imageSignature,validatePhoto,MAX_PHOTO_BYTES} from '../lib/photo-file';
import {measurementSchema,csv} from '../lib/domain';
describe('visores exclusivamente sintéticos',()=>{
 it.each([['103 mg/dL',103,'mg/dL'],['5,6 mmol/L',5.6,'mmol/L']])('lê glicemia e unidade explícitas %s',(text,value,unit)=>{expect(parseDisplay(String(text),96)).toEqual({ok:true,reading:{kind:'glucose',value,unit}});});
 it('extrai pressão e pulso rotulados',()=>{expect(parseDisplay('SYS 121 mmHg\nDIA 81 mmHg\nPUL 72 bpm',96)).toEqual({ok:true,reading:{kind:'pressure',systolic:121,diastolic:81,pulse:72,unit:'mmHg'}});});
 it('não inventa pulso ausente',()=>{expect(parseDisplay('SYS 121\nDIA 81\nmmHg',96)).toEqual({ok:true,reading:{kind:'pressure',systolic:121,diastolic:81,unit:'mmHg'}});});
 it.each(['','103','I03 mg/dL','1O3 mg/dL','103 mg','HI mg/dL','LO mg/dL','ERR','103 mg/dL\n105 mg/dL','103 mg/dL\n12:30','-103 mg/dL','103.5 mg/dL','601 mg/dL','0.5 mmol/L','34 mmol/L','120/80 mmHg','SYS 80\nDIA 120\nmmHg','SYS 120\nDIA 80','SYS 120\nDIA 80\nPUL 999\nmmHg','SYS 120\nSYS 125\nDIA 80\nmmHg','SYS 120\nDIA 80\nPUL 72 mmHg','SYS 120 mmHg\nDIA 80\n103 mg/dL','Ɩ0Ɛ ʅp/ƃɯ','S?S 1?0\nDIA ?? mmHg'])('recusa visor ambíguo, invertido, reflexo ou ilegível %s',text=>{expect(parseDisplay(text,96).ok).toBe(false);});
 it.each([0,84,101,NaN,Infinity])('recusa confiança insuficiente %s',confidence=>{expect(parseDisplay('103 mg/dL',confidence).ok).toBe(false);});
 it('valida unidade e pulso antes de registrar',()=>{const base={context:'outro',measuredAt:'2026-10-01T00:00:00Z'};expect(measurementSchema.safeParse({...base,kind:'glucose',value:5.6,unit:'mmol/L'}).success).toBe(true);expect(measurementSchema.safeParse({...base,kind:'glucose',value:5.6,unit:'mg/dL'}).success).toBe(false);expect(measurementSchema.safeParse({...base,kind:'pressure',systolic:120,diastolic:80,pulse:999}).success).toBe(false);});
 it('recusa arquivo vazio, excessivo ou MIME falso',async()=>{await expect(validatePhoto(new File([], 'synthetic.png',{type:'image/png'}))).rejects.toThrow();await expect(validatePhoto(new File([new Uint8Array(MAX_PHOTO_BYTES+1)],'synthetic.png',{type:'image/png'}))).rejects.toThrow();await expect(validatePhoto(new File([new Uint8Array([255,216,255])],'synthetic.png',{type:'image/png'}))).rejects.toThrow();});
 it('CSV preserva unidade sem conversão',()=>{expect(csv([{id:'synthetic',kind:'glucose',value:5.6,unit:'mmol/L',context:'outro',measuredAt:'2026-10-01T00:00:00Z'}])).toContain('"mmol/L"');});
 it('verifica assinatura real e recusa formatos ativos',()=>{expect(imageSignature(new Uint8Array([255,216,255]))).toBe('image/jpeg');expect(imageSignature(new TextEncoder().encode('<svg></svg>'))).toBeUndefined();});
});

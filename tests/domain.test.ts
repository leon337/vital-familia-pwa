import {describe,it,expect} from 'vitest';
import {csv,measurementSchema,syntheticRecords} from '../lib/domain';
describe('contrato de medições',()=>{
 it('gera exclusivamente fixtures sintéticas válidas',()=>{const data=syntheticRecords();expect(data).toHaveLength(14);for(const {id,...r} of data){expect(id).toMatch(/^demo-/);expect(measurementSchema.safeParse(r).success).toBe(true);}});
 it('recusa pressão invertida, valores impossíveis e dados extras',()=>{const base={kind:'pressure',systolic:80,diastolic:120,context:'repouso',measuredAt:'2026-10-01T10:00:00Z'};expect(measurementSchema.safeParse(base).success).toBe(false);expect(measurementSchema.safeParse({...base,systolic:120,diastolic:80,patient:'outra-pessoa'}).success).toBe(false);expect(measurementSchema.safeParse({kind:'glucose',value:0,context:'jejum',measuredAt:base.measuredAt}).success).toBe(false);});
 it('recusa datas futuras e campos ausentes',()=>{expect(measurementSchema.safeParse({kind:'glucose',value:100,context:'jejum',measuredAt:'2099-01-01T00:00:00Z'}).success).toBe(false);expect(measurementSchema.safeParse({kind:'glucose'}).success).toBe(false);});
 it('exporta unidades e neutraliza fórmula em identificador',()=>{const data=syntheticRecords();const text=csv([{...data[0],id:'=HYPERLINK("x")'}]);expect(text).toContain('glicemia_mg_dL');expect(text).toContain("'=HYPERLINK");expect(text.split('\r\n')).toHaveLength(2);});
 it('mantém colunas legadas e unidade/valor original sem converter mmol/L',()=>{
  const base={id:'synthetic',measuredAt:'2026-10-01T00:00:00Z',context:'repouso' as const};
  const text=csv([{...base,kind:'glucose',value:5.6,unit:'mmol/L'},{...base,kind:'pressure',systolic:120,diastolic:80,pulse:null}]);
  const [header,glucose,pressure]=text.replace('\uFEFF','').split('\r\n');
  expect(header.split(',').slice(0,7)).toEqual(['id','data','tipo','glicemia_mg_dL','sistolica_mmHg','diastolica_mmHg','contexto']);
  const cells=(row:string)=>row.slice(1,-1).split('","');
  expect(cells(glucose)[3]).toBe('');expect(cells(glucose).slice(7)).toEqual(['mmol/L','','5.6','5.6']);
  expect(cells(pressure)[8]).toBe('');expect(pressure).not.toContain('null');
 });
});

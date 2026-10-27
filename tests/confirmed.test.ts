import {describe,it,expect} from 'vitest';
import {confirmedMeasurementSchema as schema,csv} from '../lib/domain';
const base={measuredAt:'2026-10-01T00:00:00Z',context:'repouso',confirmed:true};
const glucose={...base,kind:'glucose',value:100,unit:'mg/dL'};
const pressure={...base,kind:'pressure',systolic:120,diastolic:80,pulse:70};
describe('persistência de leitura revisada',()=>{
 it.each([glucose,pressure,{...glucose,value:5.5,unit:'mmol/L'}])('aceita somente valores completos: %j',reading=>expect(schema.safeParse(reading).success).toBe(true));
 it.each([
 {...glucose,confirmed:false},{...glucose,confirmed:undefined},{...glucose,unit:undefined},
 {...glucose,value:5,unit:'mg/dL'},{...glucose,value:100,unit:'mmol/L'},
 {...pressure,pulse:undefined},{...pressure,pulse:0},{...pressure,pulse:70.5},
 {...pressure,systolic:80},{...pressure,photo:'data:image/png;base64,synthetic'},
 {...glucose,patient_id:'victim'},{...glucose,actor_id:'victim'},
 ])('recusa leitura inválida: %j',reading=>expect(schema.safeParse(reading).success).toBe(false));
 it('preserva unidade mmol/L e pulso no CSV',()=>{
  expect(csv([{id:'synthetic',kind:'glucose',value:5.5,unit:'mmol/L',measuredAt:base.measuredAt,context:'repouso'}])).toContain('"","5.5"');
  expect(csv([{id:'synthetic',kind:'pressure',systolic:120,diastolic:80,pulse:70,measuredAt:base.measuredAt,context:'repouso'}])).toContain('"70"');
 });
});

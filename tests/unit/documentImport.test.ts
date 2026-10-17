import {test} from 'node:test';
import assert from 'node:assert/strict';
import type {IncomingMessage,ServerResponse} from 'node:http';
import {PDFDocument} from 'pdf-lib';
import {extractDocument} from '../../server/documentImport';
const request=(body:unknown,authorized=true)=>Object.assign({method:'POST',headers:authorized?{authorization:'Bearer user-test'}:{},body}) as IncomingMessage&{body:unknown};
function response(){const data={status:200,text:''};const res={setHeader(){},end(value:string){data.text=value;},get statusCode(){return data.status;},set statusCode(value:number){data.status=value;}} as unknown as ServerResponse;return {data,res};}

test('extração exige sessão e não aceita arquivos disfarçados nem PDFs excessivos',async()=>{
  const original=globalThis.fetch,before={...process.env};let quota=0;
  Object.assign(process.env,{SUPABASE_URL:'https://supabase.test',SUPABASE_SERVICE_ROLE_KEY:'server-test',AI_GATEWAY_API_KEY:'gateway-test'});
  globalThis.fetch=async(input)=>{const path=new URL(String(input)).pathname;if(path==='/auth/v1/user')return Response.json({id:'11111111-1111-4111-8111-111111111111'});quota+=1;throw Error('Unexpected provider/quota call');};
  try{
    const unauthorized=response();await extractDocument(request({},false),unauthorized.res);assert.equal(unauthorized.data.status,401);
    const forged=response();await extractDocument(request({referenceDate:'2026-11-01',file:{name:'receipt.pdf',type:'application/pdf',data:Buffer.from('not a pdf').toString('base64')}}),forged.res);assert.equal(forged.data.status,400);
    const pdf=await PDFDocument.create();for(let n=0;n<11;n++)pdf.addPage();
    const excessive=response();await extractDocument(request({referenceDate:'2026-11-01',file:{name:'receipt.pdf',type:'application/pdf',data:Buffer.from(await pdf.save()).toString('base64')}}),excessive.res);assert.equal(JSON.parse(excessive.data.text).code,'too_many_pages');assert.equal(quota,0);
  }finally{globalThis.fetch=original;for(const name of ['SUPABASE_URL','SUPABASE_SERVICE_ROLE_KEY','AI_GATEWAY_API_KEY']){if(before[name]===undefined)delete process.env[name];else process.env[name]=before[name];}}
});

test('bloqueio de cobrança da IA é explícito e extração não grava lançamentos',async()=>{
  const original=globalThis.fetch,before={...process.env};let financialWrites=0;
  Object.assign(process.env,{SUPABASE_URL:'https://supabase.test',SUPABASE_SERVICE_ROLE_KEY:'server-test',AI_GATEWAY_API_KEY:'gateway-test'});
  globalThis.fetch=async(input)=>{const url=new URL(String(input));if(url.pathname==='/auth/v1/user')return Response.json({id:'11111111-1111-4111-8111-111111111111'});if(url.pathname.endsWith('/reserve_document_import'))return Response.json(1);if(url.hostname==='ai-gateway.vercel.sh')return Response.json({error:{type:'customer_verification_required'}},{status:403});financialWrites+=1;throw Error('Unexpected write');};
  try{const result=response();await extractDocument(request({referenceDate:'2026-11-01',text:'Paguei R$ 100 de conta de luz.'}),result.res);assert.equal(result.data.status,503);assert.equal(JSON.parse(result.data.text).code,'ai_billing_required');assert.equal(financialWrites,0);}
  finally{globalThis.fetch=original;for(const name of ['SUPABASE_URL','SUPABASE_SERVICE_ROLE_KEY','AI_GATEWAY_API_KEY']){if(before[name]===undefined)delete process.env[name];else process.env[name]=before[name];}}
});

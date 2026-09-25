import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { randomUUID } from 'node:crypto';

const db=new PGlite();
const service='10000000-0000-4000-8000-000000000001', employee='20000000-0000-4000-8000-000000000001', item='30000000-0000-4000-8000-000000000001';
const booking=()=>({date:'2099-01-10',start_time:'10:00',type:'barberia',client_name:'QA Fixture',client_phone:'999999999',services:[{service_id:service,employee_id:employee}],total_price_cents:1,advance_amount_cents:90000});
async function rpc(name:string,args:unknown[]) { const result=await db.query<{value:any}>(`SELECT public.${name}(${args.map((_,i)=>'$'+(i+1)).join(',')}) AS value`,args);return result.rows[0].value; }
before(async()=>{
  await db.exec(await readFile('tests/fixtures/schema.sql','utf8'));
  await db.exec(await readFile('src/migrations/migration_dress_rentals_workflow.sql','utf8').then(s=>s.slice(0,s.indexOf('-- 4. RLS'))));
  await db.exec(await readFile('src/migrations/migration_sync_booking_total.sql','utf8'));
  const sql=await readFile('src/migrations/migration_qa_booking_payment_consistency.sql','utf8');
  await db.exec(sql); await db.exec(sql); // migration is repeatable
});
after(()=>db.close());
beforeEach(async()=>{
  await db.exec(`RESET ROLE; SELECT set_config('qa.test_role','',false); TRUNCATE qa_internal.requests,qa_internal.voucher_uploads,public.payment_logs,public.booking_services,public.bookings,public.dress_rentals,public.employee_blocks,public.employee_skills,public.services,public.employees,public.wardrobe_items,public.business_config,storage.objects CASCADE;
  INSERT INTO public.services VALUES('${service}','Corte','barberia',4000,60,true,true);
  INSERT INTO public.employees VALUES('${employee}','QA','Employee','barberia',true);
  INSERT INTO public.wardrobe_items VALUES('${item}','QA','Prenda','M','Negro',10000,5000,true,'disponible');
  INSERT INTO public.business_config(id,advance_percentage) VALUES(1,0);`);
});
test('atomic booking uses server prices, real code, zero advance and idempotency',async()=>{
  const id=randomUUID(),input=booking();
  const created=await rpc('qa_create_booking',[id,input]);
  assert.equal(created.total_price_cents,4000);assert.equal(created.advance_amount_cents,0);assert.equal(created.advance_percentage,0);
  assert.match(created.booking_code,/^AC-[A-F0-9]{32}$/);assert.equal(created.booking_services.length,1);
  assert.deepEqual(await rpc('qa_create_booking',[id,input]),created);
  await assert.rejects(rpc('qa_create_booking',[id,{...input,client_name:'Changed'}]),/reutilizada/);
});
test('failed service detail leaves no booking and racing submissions get one slot',async()=>{
  await assert.rejects(rpc('qa_create_booking',[randomUUID(),{...booking(),services:[...booking().services,{service_id:randomUUID(),employee_id:employee}]}]));
  assert.equal((await db.query<{n:number}>('SELECT count(*)::integer n FROM bookings')).rows[0].n,0);
  const results=await Promise.allSettled([rpc('qa_create_booking',[randomUUID(),booking()]),rpc('qa_create_booking',[randomUUID(),booking()])]);
  assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
});
test('cancelled booking releases slot and public availability exposes no client data',async()=>{
  const created=await rpc('qa_create_booking',[randomUUID(),booking()]);
  const available=await rpc('qa_availability',['2099-01-10']);
  assert.equal(JSON.stringify(available).includes('999999999'),false);
  await db.query('UPDATE bookings SET cancelled_at=now() WHERE id=$1',[created.id]);
  assert.ok(await rpc('qa_create_booking',[randomUUID(),booking()]));
});
test('guest lookup needs both code and phone and redacts sensitive fields',async()=>{
  const created=await rpc('qa_create_booking',[randomUUID(),booking()]);
  assert.deepEqual(await rpc('qa_lookup_booking',[created.booking_code,'988888888']),[]);
  const rows=await rpc('qa_lookup_booking',[created.booking_code,'999999999']);
  assert.equal(rows.length,1);assert.equal(rows[0].client_dni,undefined);assert.equal(rows[0].user_id,undefined);
});
test('voucher must exist in private Storage, stays pending, retries do not duplicate',async()=>{
  const created=await rpc('qa_create_booking',[randomUUID(),booking()]);
  const path=await rpc('qa_prepare_voucher',['booking',created.id,created.booking_code,'999999999','png']);
  const args=[created.id,created.booking_code,'999999999',path,1000];
  await assert.rejects(rpc('qa_submit_booking_voucher',args),/Storage/);
  await db.query("INSERT INTO storage.objects(bucket_id,name) VALUES('payment-vouchers',$1)",[path]);
  const payment=await rpc('qa_submit_booking_voucher',args);
  assert.equal(payment.status,'pending');assert.equal((await rpc('qa_submit_booking_voucher',args)).id,payment.id);
  assert.equal((await db.query<{advance_amount_cents:number}>('SELECT advance_amount_cents FROM bookings')).rows[0].advance_amount_cents,0);
  await assert.rejects(rpc('qa_review_payment',[payment.id,true]),/No autorizado/);
  await db.exec("SELECT set_config('qa.test_role','recepcionista',false)");
  await rpc('qa_review_payment',[payment.id,true]);await rpc('qa_review_payment',[payment.id,true]);
  assert.equal((await db.query<{advance_amount_cents:number}>('SELECT advance_amount_cents FROM bookings')).rows[0].advance_amount_cents,1000);
});
test('wardrobe rejects maintenance, overlap and unpersisted voucher; lifecycle collects once',async()=>{
  const id=randomUUID(); const path=await rpc('qa_prepare_voucher',['dress',id,'','','jpg']);
  const rental={origin:'web',wardrobe_item_id:item,client_first_name:'QA',client_last_name:'Fixture',client_phone:'999999999',client_dni:'00000000',event_name:'Prueba',destination:'Local',event_date:'2099-01-10',return_date:'2099-01-12',advance_cents:5000,voucher_url:path};
  await assert.rejects(rpc('qa_create_dress_rental',[id,rental]),/comprobante/);
  await db.query("INSERT INTO storage.objects(bucket_id,name) VALUES('payment-vouchers',$1)",[path]);
  await db.exec("UPDATE wardrobe_items SET availability_status='en_mantenimiento'");
  await assert.rejects(rpc('qa_create_dress_rental',[id,rental]),/disponible/);
  await db.exec("UPDATE wardrobe_items SET availability_status='disponible'");
  const created=await rpc('qa_create_dress_rental',[id,rental]);assert.equal(created.status,'por_validar');assert.equal(created.advance_cents,0);
  assert.equal((await rpc('qa_create_dress_rental',[id,rental])).id,created.id);
  await assert.rejects(rpc('qa_create_dress_rental',[randomUUID(),rental]),/reservada/);
  await db.exec("SELECT set_config('qa.test_role','VESTUARIO_ADMIN',false)");
  await rpc('qa_transition_dress',[created.id,'approve',0,0,'']);
  const delivered=await rpc('qa_transition_dress',[created.id,'deliver',5000,5000,'']);assert.equal(delivered.advance_cents,10000);
  await assert.rejects(rpc('qa_transition_dress',[created.id,'deliver',5000,5000,'']),/estado/);
  await assert.rejects(rpc('qa_transition_dress',[created.id,'return',0,6000,'']),/inválida/);
  assert.equal((await rpc('qa_transition_dress',[created.id,'return',0,4000,'Daño'])).penalty_cents,1000);
});
test('public table insert and private voucher enumeration are denied',async()=>{
  await db.exec('SET ROLE anon');
  await assert.rejects(db.exec("INSERT INTO bookings(booking_code) VALUES('FAKE')"),/permission denied/);
  assert.equal((await db.query('SELECT * FROM storage.objects')).rows.length,0);
  await assert.rejects(db.exec("INSERT INTO storage.objects(bucket_id,name) VALUES('payment-vouchers','guessed.png')"),/row-level security/);
});

test('POS aggregates repeated lines, rejects negative quantity and decrements only once',async()=>{
  await db.exec("SELECT set_config('qa.test_role','recepcionista',false)");
  const productId=randomUUID();await db.query('INSERT INTO products VALUES($1,1)',[productId]);
  const lines=[{product_id:productId,quantity:1}];
  await assert.rejects(rpc('qa_process_pos_sale',[randomUUID(),{},[...lines,...lines]]),/Stock/);
  await assert.rejects(rpc('qa_process_pos_sale',[randomUUID(),{},[{product_id:productId,quantity:-1}]]),/Cantidad/);
  const id=randomUUID(), sale={ticket_number:'QA-TEST'};
  const result=await rpc('qa_process_pos_sale',[id,sale,lines]);
  assert.deepEqual(await rpc('qa_process_pos_sale',[id,sale,lines]),result);
  assert.equal((await db.query<{stock:number}>('SELECT stock FROM products WHERE id=$1',[productId])).rows[0].stock,0);
  await assert.rejects(rpc('qa_process_pos_sale',[randomUUID(),sale,lines]),/Stock/);
});

test('service release is persisted and prices update the stored booking total',async()=>{
  const created=await rpc('qa_create_booking',[randomUUID(),booking()]);
  await db.exec("SELECT set_config('qa.test_role','admin',false)");
  const changed=await rpc('qa_update_booking_service',[created.booking_services[0].id,'price','3000']);
  assert.equal(changed.total_price_cents,3000);assert.equal(changed.balance_cents,3000);
  const released=await rpc('qa_update_booking_service',[created.booking_services[0].id,'release','']);
  assert.ok(released.booking_services[0].liberado_at);
  assert.ok(await rpc('qa_create_booking',[randomUUID(),{...booking(),advance_amount_cents:0}]));
});

test('rescheduling shifts service intervals atomically and rejects an occupied slot',async()=>{
  const created=await rpc('qa_create_booking',[randomUUID(),booking()]);
  const other=await rpc('qa_create_booking',[randomUUID(),{...booking(),start_time:'12:00'}]);
  await db.exec("SELECT set_config('qa.test_role','admin',false)");
  await assert.rejects(rpc('qa_edit_booking',[created.id,{start_time:'12:00'}]),/ocupado/);
  const moved=await rpc('qa_edit_booking',[created.id,{start_time:'14:00'}]);
  assert.equal(moved.start_time,'14:00:00');assert.equal(moved.booking_services[0].hora_inicio,'14:00:00');
  await assert.rejects(rpc('qa_edit_booking',[other.id,{advance_amount_cents:200}]),/caja/);
});

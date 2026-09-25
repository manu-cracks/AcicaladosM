import { test, expect, Page } from '@playwright/test';
const service='10000000-0000-4000-8000-000000000001', employee='20000000-0000-4000-8000-000000000001';
const product={id:'40000000-0000-4000-8000-000000000001',name:'Pomada QA',slug:'pomada',category:'ceras_pomadas',price_cents:1500,stock:1,is_active:true,use_type:'venta',images:['/LogoAcicalados.svg'],description:'Producto de prueba'};
const booking={id:'50000000-0000-4000-8000-000000000001',booking_code:'AC-0123456789ABCDEF0123456789ABCDEF',client_first_name:'QA Fixture',client_phone:'999999999',booking_date:'2099-01-10',start_time:'10:00',end_time:'11:00',service_type:'barberia',total_price_cents:4000,advance_amount_cents:0,balance_cents:4000,payment_status:'sin_pago',created_at:'2026-09-25',booking_services:[]};
async function mock(page:Page, options:{failBooking?:boolean;failUpload?:boolean;failLink?:boolean;stock?:number;auth?:boolean}={}) {
  let submitted=false;let createCalls=0;let lookup:any;let ownFilter='';
  const user={id:'60000000-0000-4000-8000-000000000001',email:'qa@example.invalid',role:'authenticated',aud:'authenticated',user_metadata:{full_name:'QA Cliente'}};
  if(options.auth) await page.addInitScript(user => { localStorage.setItem('sb-127-auth-token',JSON.stringify({access_token:'qa-fixture-token',refresh_token:'qa-fixture-refresh',expires_at:4070908800,token_type:'bearer',user})); },user);
  await page.route('http://127.0.0.1:54399/**', async route=>{
    const url=new URL(route.request().url()), name=url.pathname.split('/').pop();
    let data:any=[];
    if (url.pathname.includes('/storage/')) {
      if(options.failUpload) return route.fulfill({status:500,json:{message:'Storage offline'}});
      return route.fulfill({json:{Key:'payment-vouchers/booking/path.png',Id:'qa'}});
    }
    if(url.pathname.includes('/auth/')) return route.fulfill({json:{user:options.auth?user:null}});
    if(url.pathname.includes('/rpc/')) {
      if(name==='qa_public_config') data={advance_percentage:30,whatsapp_url:'https://wa.me/51997766828',yape_phone:'999999999',yape_holder:'QA',yape_qr_url:'/LogoAcicalados.svg'};
      if(name==='qa_availability') data={employees:[{id:employee,full_name:'QA Employee',type:'barberia',active:true,skills:[service]}],blocks:[],bookings:[]};
      if(name==='qa_create_booking') {createCalls++; if(options.failBooking) return route.fulfill({status:500,json:{message:'No se pudo registrar la reserva de prueba'}}); data=booking;}
      if(name==='qa_lookup_booking') {lookup=route.request().postDataJSON();data=lookup.p_code===booking.booking_code && lookup.p_phone==='999999999'?[booking]:[];}
      if(name==='qa_prepare_voucher') data='booking/'+booking.id+'/00000000-0000-4000-8000-000000000001.png';
      if(name==='qa_submit_booking_voucher') {if(options.failLink) return route.fulfill({status:500,json:{message:'No se pudo vincular el comprobante'}});submitted=true;data={id:'payment-qa',status:'pending'};}
      if(name==='qa_booking_voucher_status') data=submitted?{status:'pending'}:{};
    } else if(name==='services') data=[{id:service,name:'Corte QA',type:'barberia',price_cents:4000,duration_minutes:60,capacity:1,is_active:true,is_public:true,images:['/LogoAcicalados.svg']}];
    else if(name==='products') data=[{...product,stock:options.stock??1}];
    else if(name==='wardrobe_items') data=[{id:'30000000-0000-4000-8000-000000000001',code:'QA',name:'Prenda QA',price_cents:10000,deposit_cents:5000,availability_status:'en_mantenimiento',is_active:true,images:['/LogoAcicalados.svg']}];
    else if(name==='profiles') data={id:user.id,role:'cliente',first_name:'QA',last_name:'Cliente',phone:'999999999'};
    else if(name==='bookings' && options.auth) {ownFilter=url.searchParams.get('user_id')||'';data=[booking];}
    else if(name==='attendance_settings') data={shift_entry_time:'09:00',shift_exit_time:'21:00'};
    return route.fulfill({json:data});
  });
  return {calls:()=>createCalls,lookup:()=>lookup,ownFilter:()=>ownFilter};
}
async function form(page:Page) {
  await page.goto('/reservar');
  await page.getByRole('button',{name:'Continuar a Selección de Servicios'}).click();
  await page.getByText('Corte QA',{exact:true}).click();
  await page.getByRole('button',{name:'Continuar a Fecha y Horario'}).click();
  await page.locator('input[type=date]').fill('2099-01-10');
  await page.getByRole('button',{name:'Continuar a Datos Personales'}).click();
  await page.getByPlaceholder('Ej: Sebastián Alarcón Peña').fill('QA Fixture');
  await page.getByPlaceholder('Ej. 987654321').fill('999999999');
}
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=','base64');
test('booking failure retains the form and never displays a real code',async({page})=>{
  await mock(page,{failBooking:true});await form(page);
  await page.getByRole('button',{name:'Confirmar y Ver Instrucciones de Pago'}).click();
  await expect(page.getByText('No se pudo registrar la reserva de prueba')).toBeVisible();
  await expect(page.getByPlaceholder('Ej: Sebastián Alarcón Peña')).toHaveValue('QA Fixture');
  await expect(page.getByRole('heading',{name:`Código de Cita: #${booking.booking_code}`})).toHaveCount(0);
});
test('booking success uses the persisted code; linked voucher survives a page reload',async({page})=>{
  const api=await mock(page);await form(page);
  await page.getByRole('button',{name:'Confirmar y Ver Instrucciones de Pago'}).click();
  await expect(page.getByRole('heading',{name:`Código de Cita: #${booking.booking_code}`})).toBeVisible();expect(api.calls()).toBe(1);
  await page.locator('input[type=file]').setInputFiles({name:'voucher.png',mimeType:'image/png',buffer:png});
  await expect(page.getByText('Comprobante Guardado',{exact:true})).toBeVisible();
  await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
  await page.screenshot({path:'test-results/booking-success.png',fullPage:true});
  await page.goto('/mi-cuenta');
  await page.getByLabel('Código de reserva').fill(booking.booking_code);
  await page.getByPlaceholder('Ej. 987654321').last().fill('999999999');
  await page.getByRole('button',{name:/Buscar|Consultar/}).last().click();
  await page.getByRole('button',{name:'Liquidar Saldo con QR'}).click();
  await expect(page.getByText('Comprobante recibido; pendiente de validación por recepción.')).toBeVisible();
  expect(api.lookup()).toEqual({p_code:booking.booking_code,p_phone:'999999999'});
});
for(const failure of ['failUpload','failLink'] as const) test(`${failure}: no voucher success`,async({page})=>{
  await mock(page,{[failure]:true});await form(page);await page.getByRole('button',{name:'Confirmar y Ver Instrucciones de Pago'}).click();
  await page.locator('input[type=file]').setInputFiles({name:'voucher.png',mimeType:'image/png',buffer:png});
  await expect(page.getByText(/No se pudo (cargar|vincular) el comprobante/)).toBeVisible();
  await expect(page.getByText('Comprobante Guardado',{exact:true})).toHaveCount(0);
});
test('stock 1 stops increment; cart restores after reload',async({page})=>{
  await mock(page);await page.goto('/tienda');await page.getByRole('button',{name:'Añadir',exact:true}).click();
  await expect(page.getByRole('button',{name:'Aumentar Pomada QA'})).toBeDisabled();
  await page.reload();
  await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem('acicalados_cart')||'[]')[0]?.quantity)).toBe(1);
});
test('zero stock and maintenance cannot be booked',async({page})=>{
  await mock(page,{stock:0});await page.goto('/tienda');await expect(page.getByRole('button',{name:'Sin stock'})).toBeDisabled();
  await page.goto('/vestuario');await expect(page.getByRole('button',{name:/No disponible|Reservar Prenda/})).toBeDisabled();
});
for(const [width,height] of [[360,800],[375,812],[390,844],[412,915],[430,932]]) test(`responsive ${width}x${height} public views and navigation`,async({page})=>{
  await page.setViewportSize({width,height});await mock(page);
  for(const path of ['/','/servicios','/reservar','/tienda','/vestuario','/ubicacion','/mi-cuenta']) {
    await page.goto(path);await expect(page.locator('main')).toBeVisible();
    await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
  }
  await page.goto('/');await page.evaluate(()=>window.scrollTo(0,document.body.scrollHeight));
  await page.getByRole('button',{name:/Reservar Mi Cita Online/i}).first().click();
  await expect.poll(()=>page.evaluate(()=>window.scrollY)).toBe(0);
  await page.goBack();await expect.poll(()=>page.evaluate(()=>window.scrollY)).toBe(0);
  await page.goForward();await expect(page.getByText('Agendar Cita en Acicalados')).toBeVisible();
  await page.screenshot({path:`test-results/mobile-${width}.png`,fullPage:true});
});

test('authenticated history queries the session user only',async({page})=>{
  const api=await mock(page,{auth:true});await page.goto('/mi-cuenta');
  await expect(page.getByText('#'+booking.booking_code,{exact:true})).toBeVisible();
  expect(api.ownFilter()).toBe('eq.60000000-0000-4000-8000-000000000001');
  await expect(page.getByLabel('Código de reserva')).toHaveCount(0);
});
test('stock changes are rechecked before WhatsApp and give visible feedback',async({page})=>{
  const options={stock:1};await mock(page,options);await page.goto('/tienda');
  await page.getByRole('button',{name:'Añadir',exact:true}).click();options.stock=0;
  await page.getByRole('button',{name:'Consultar Pedido por WhatsApp'}).click();
  await expect(page.getByText('Actualizamos cantidades o precios según el catálogo. Revisa tu carrito y vuelve a continuar.')).toBeVisible();
  await expect(page.getByText('Tu carrito está vacío')).toBeVisible();
});
test('footer uses the business-config WhatsApp and manual payment copy',async({page})=>{
  await mock(page);await page.goto('/');
  await expect(page.getByRole('link',{name:'WhatsApp Oficial de Acicalados'})).toHaveAttribute('href','https://wa.me/51997766828');
  await expect(page.getByText('Pagos vía Yape sujetos a validación del comprobante por recepción.')).toBeVisible();
});

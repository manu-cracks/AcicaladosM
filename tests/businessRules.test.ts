import test from 'node:test';
import assert from 'node:assert/strict';
import { advancePercentage, reconcileCart, validateVoucher, whatsappPhone, isWardrobeReservable } from '../src/lib/businessRules';
import { isBookingInactive, isEmployeeBooked, checkEmployeeAvailability, computeSlotsAvailability } from '../src/lib/bookingAvailability';
import type { Booking, Product, Employee, Service, WardrobeItem } from '../src/types';

const product = { id:'p1',price_cents:1200,stock:1,active:true,use_type:'venta' } as Product;
test('cart clamps duplicates, rejects negative/fractional input and refreshes price', () => {
  assert.deepEqual(reconcileCart([{productId:'p1',quantity:9},{productId:'p1',quantity:2},{productId:'deleted',quantity:1}], [product]), [{product,quantity:1}]);
  assert.deepEqual(reconcileCart([{productId:'p1',quantity:-1},{productId:'p1',quantity:0.5}], [product]), []);
  assert.deepEqual(reconcileCart('invalid', [product]), []);
});
test('cart removes zero stock, inactive and internal products', () => {
  for (const changed of [{stock:0},{active:false},{use_type:'consumo_interno'}]) assert.deepEqual(reconcileCart([{product,quantity:1}], [{...product,...changed} as Product]), []);
});
test('advance handles zero, boundaries and invalid configuration', () => {
  assert.deepEqual([0,100,120,-4,null,undefined,NaN].map(advancePercentage), [0,100,100,0,25,25,25]);
});
test('contact normalizes country code once and ignores URL query digits', () => {
  assert.equal(whatsappPhone('https://wa.me/51997766828?text=123'), '51997766828');
  assert.equal(whatsappPhone('+51 997 766 828'), '51997766828');
  assert.equal(whatsappPhone('997766828'), '51997766828');
  assert.equal(whatsappPhone('https://evil.example/997766828'), '');
});
test('vouchers reject SVG, PDF, zero and oversized files; accept supported images', () => {
  for (const type of ['image/jpeg','image/png','image/webp']) assert.equal(validateVoucher({type,size:100}),null);
  for (const file of [{type:'image/svg+xml',size:12},{type:'application/pdf',size:20},{type:'image/png',size:0},{type:'image/png',size:5242881}]) assert.ok(validateVoucher(file));
});
test('wardrobe requires active and explicitly available', () => {
  for (const status of ['mantenimiento','en_mantenimiento','en_uso','reservado','']) assert.equal(isWardrobeReservable({active:true,status} as WardrobeItem),false);
  assert.equal(isWardrobeReservable({active:false,status:'disponible'} as WardrobeItem),false);
  assert.equal(isWardrobeReservable({active:true,status:'disponible'} as WardrobeItem),true);
});
const employee = {id:'e1',active:true,type:'barberia',skills:[]} as Employee;
const booking = {date:'2099-01-10',start_time:'10:00',end_time:'11:00',services:[{employee_id:'e1',hora_inicio:'10:00',duration_minutes:60}]} as Booking;
test('all availability entry points ignore cancellation and completion timestamps', () => {
  for (const state of [{status:'cancelada'},{status:'cancelled'},{status:'expirada'},{status:'completada'},{cancelled_at:'now'},{expired_at:'now'}]) {
    const b={...booking,...state};
    assert.ok(isBookingInactive(b));
    assert.equal(isEmployeeBooked('e1',b.date,600,630,[b]),false);
    assert.equal(checkEmployeeAvailability({employee,date:b.date,startTime:'10:00',durationMinutes:30,bookings:[b],employeeBlocks:[]}).isAvailable,true);
  }
  assert.equal(isEmployeeBooked('e1',booking.date,600,630,[booking]),true);
});
test('released services and adjacent slots do not conflict', () => {
  assert.equal(isEmployeeBooked('e1',booking.date,660,690,[booking]),false);
  assert.equal(isEmployeeBooked('e1',booking.date,600,630,[{...booking,services:booking.services.map(s=>({...s,liberado_at:'10:01'}))}]),false);
});
test('appointments cannot finish past closing time or employee shift', () => {
  const slots=computeSlotsAvailability({bookingDate:'2099-01-10',selectedServices:[{id:'s1',category:'barberia',duration_minutes:60} as Service],employees:[employee],employeeBlocks:[],bookings:[],openTime:'20:00',closeTime:'21:00'});
  assert.equal(slots.find(s=>s.time==='20:30')?.isSelectable,false);
  assert.equal(slots.find(s=>s.time==='20:00')?.isSelectable,true);
});

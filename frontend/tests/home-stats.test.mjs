import test from 'node:test';
import assert from 'node:assert/strict';
import { mexicoDate, periodFor, shiftPeriod, statsFor, shippingAlerts, matchesDeadlineFilter, deadlineBucket } from '../src/home/stats.js';

const NOW = Date.parse('2026-11-13T18:00:00Z');
const order = (id, date, amount, status='COMPLETED') => ({ tiktok_order_id:id,shop_id:'shop',tiktok_create_time:Date.parse(date)/1000,total_amount:amount,status,currency:'MXN' });
test('Mexico calendar boundaries and leap-month navigation',()=>{
 assert.equal(mexicoDate(Date.parse('2026-11-13T05:59:59Z')),'2026-11-12');
 assert.equal(mexicoDate(Date.parse('2026-11-13T06:00:00Z')),'2026-11-13');
 assert.deepEqual(periodFor('2026-11-15','week'),{start:'2026-11-09',end:'2026-11-15'});
 assert.deepEqual(periodFor('2024-02-29','month'),{start:'2024-02-01',end:'2024-02-29'});
 assert.equal(shiftPeriod('2026-01-31','month',1),'2026-02-01');
 assert.equal(shiftPeriod('2026-01-01','month',-1),'2025-12-01');
});
test('GMV excludes unpaid/cancelled and uses Mexico creation day',()=>{
 const rows=[order('1','2026-11-13T06:00:00Z',100),order('2','2026-11-13T07:30:00Z',50),order('3','2026-11-13T08:00:00Z',999,'UNPAID'),order('4','2026-11-13T08:00:00Z',999,'CANCELLED'),order('5','2026-11-13T05:59:59Z',200)];
 const result=statsFor(rows,'2026-11-13','day',NOW);
 assert.equal(result.gmv,150);assert.equal(result.orders,2);assert.equal(result.average,75);
 assert.equal(result.previousGmv,0);assert.equal(result.changes.gmv,null);
 assert.equal(result.buckets.length,24);assert.equal(result.buckets[0].gmv,100);assert.equal(result.buckets[1].gmv,50);
 assert.equal(result.buckets.reduce((n,b)=>n+b.gmv,0),150);
});
test('week/month buckets, future zeroes, zero comparison and mixed currencies',()=>{
 for(const [grain,length] of [['week',7],['month',30]]){
  const r=statsFor([order('1','2026-11-13T16:00:00Z',125),order('2','2026-11-14T16:00:00Z',900)],'2026-11-13',grain,NOW);
  assert.equal(r.buckets.length,length);assert.equal(r.gmv,125);assert.equal(r.buckets.reduce((n,b)=>n+b.orders,0),1);
  assert.ok(r.buckets.filter(b=>b.future).every(b=>b.gmv===0&&b.orders===0));
 }
 const r=statsFor([],'2026-11-13','day',NOW);assert.equal(r.average,0);assert.equal(r.changes.gmv,null);
 const a=order('1','2026-11-13T16:00:00Z',1),b={...a,tiktok_order_id:'2',currency:'USD'};
 assert.equal(statsFor([a,b],'2026-11-13','day',NOW).currencies.length,2);
});
test('shipping keeps platform deadlines and previous 24-hour/cancellation rules',()=>{
 const now=NOW/1000;
 const item=(id,seconds,extra={})=>({shop_id:'shop',order_id:id,stage:'collection',deadline:seconds==null?null:now+seconds,product_name:'Actual product',...extra});
 const monitor={items:[item('1',-60),item('2',0),item('3',21600),item('4',86400),item('5',86401),item('6',null),item('7',100000,{cancel_deadline:now+10})]};
 const rows=shippingAlerts(monitor,[],now);
 assert.equal(rows.length,5);assert.equal(rows[0].order_id,'1');
 assert.equal(rows.find(x=>x.order_id==='7').risk,'cancellation');
 assert.equal(rows.find(x=>x.order_id==='4').deadline,now+86400);
 assert.equal(deadlineBucket(-1),'overdue');assert.equal(deadlineBucket(0),'under6');assert.equal(deadlineBucket(21600),'six24');
 assert.equal(['overdue','under6','six24'].reduce((sum,key)=>sum+rows.filter(r=>r.bucket===key).length,0),rows.length);
});

test("24/48 hour tabs are cumulative and exclude overdue", () => {
 assert.equal(matchesDeadlineFilter(-1,"under24"),false);
 assert.equal(matchesDeadlineFilter(86399,"under24"),true);
 assert.equal(matchesDeadlineFilter(86400,"under24"),false);
 assert.equal(matchesDeadlineFilter(86400,"under48"),true);
 assert.equal(matchesDeadlineFilter(172800,"under48"),false);
 const monitor={items:[{shop_id:"shop",order_id:"future",deadline:NOW/1000+100000}]};
 assert.equal(shippingAlerts(monitor,[],NOW/1000).length,0);
 assert.equal(shippingAlerts(monitor,[],NOW/1000,172800).length,1);
});

test('current periods compare equal progress, historical periods compare in full',()=>{
 const rows=[order('a','2026-11-12T17:59:00Z',100),order('b','2026-11-12T18:01:00Z',200),order('c','2026-11-13T17:00:00Z',150)];
 const day=statsFor(rows,'2026-11-13','day',NOW);
 assert.equal(day.previousGmv,100);assert.equal(day.changes.gmv,50);
 assert.equal(day.buckets.reduce((n,b)=>n+b.previousGmv,0),100);
 const past=statsFor(rows,'2026-11-12','day',NOW);assert.equal(past.gmv,300);
 const week=statsFor([order('d','2026-11-06T17:00:00Z',20),order('e','2026-11-06T19:00:00Z',30),order('f','2026-11-07T07:00:00Z',40)],'2026-11-13','week',NOW);
 assert.equal(week.previousGmv,20);
 const month=statsFor([order('g','2026-10-13T17:00:00Z',60),order('h','2026-10-13T19:00:00Z',70)],'2026-11-13','month',NOW);
 assert.equal(month.previousGmv,60);
});

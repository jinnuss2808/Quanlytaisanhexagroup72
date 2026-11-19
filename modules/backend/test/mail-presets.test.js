import test from 'node:test';
import assert from 'node:assert/strict';
import {MAIL_LINK_PRESETS,MAIL_PRESET_MAP,listMailLinks,MAIL_CATEGORIES} from '../src/mail-presets.js';

test('Built-in directory appears without writing any Firebase data',()=>{
 const items=listMailLinks({});
 assert.equal(items.length,20);
 assert.equal(MAIL_PRESET_MAP.size,items.length);
 assert.equal(new Set(items.map(r=>r.id)).size,items.length);
 assert.ok(items.some(r=>r.title==='Mail HEXA — Zimbra Admin'));
 assert.ok(items.some(r=>r.title==='Tạo mail HEXA'));
 assert.ok(items.some(r=>r.title==='Mail Cow — Domain Admin'));
 assert.equal(MAIL_CATEGORIES.length,4);
 assert.ok(items.every(r=>r.username===''&&r.hasPassword===false));
 assert.ok(items.every(r=>!('password' in r)&&!('sealed' in r)));
});
test('Saved account overrides a preset while never returning ciphertext in list',()=>{
 const r=MAIL_LINK_PRESETS[0];
 const saved={[r.id]:{title:r.title,url:r.url,category:r.category,note:r.note,username:'admin',sealed:{iv:'secret'},updatedAt:20}};
 const item=listMailLinks(saved).find(x=>x.id===r.id);
 assert.equal(item.username,'admin');assert.equal(item.hasPassword,true);
 assert.equal(item.sealed,undefined);
 assert.equal(item.isPreset,true);
});
test('Deleting preset persists a tombstone; other records remain untouched',()=>{
 const r=MAIL_LINK_PRESETS[1];
 const list=listMailLinks({[r.id]:{deleted:true},custom_1:{title:'Other',url:'https://example.com',username:'',updatedAt:20}});
 assert.equal(list.some(x=>x.id===r.id),false);
 assert.ok(list.some(x=>x.id==='custom_1'));
});
test('Built-in screenshot directory never contains credentials',()=>{
 const raw=JSON.stringify(MAIL_LINK_PRESETS).toLowerCase();
 assert.equal(raw.includes('hexagom@123'),false);
 assert.equal(raw.includes('scan hexagon@123'),false);
 assert.ok(MAIL_LINK_PRESETS.filter(r=>!r.url).length===3);
 assert.ok(MAIL_LINK_PRESETS.every(r=>!r.url || r.url.startsWith('https://')));
});

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {webcrypto} from 'node:crypto';
const built=new URL('../public/app.js',import.meta.url);
const source=fs.readFileSync(fs.existsSync(built)?built:new URL('../app.js',import.meta.url),'utf8');
function harness(saved=new Map(),now=new Date(2026,9,23,12).getTime()){
  const clock={value:now};
  class ClockDate extends Date { constructor(...args){super(...(args.length?args:[clock.value]));} static now(){return clock.value;} }
  const nodes=new Map(),calls=[],events=new Map(),downloads=[];
  class LocalURL extends URL { static createObjectURL(blob){downloads.push({blob});return 'blob:test-'+downloads.length;} static revokeObjectURL(){} }
  const timer=(fn,ms)=>{const handle=setTimeout(fn,ms);handle.unref?.();return handle;};
  class Node{
    constructor(tag='div'){this.tagName=tag;this.children=[];this.events=new Map();this.value='';this.hidden=false;}
    set id(value){this._id=value;nodes.set(value,this);}get id(){return this._id;}
    get childElementCount(){return this.children.length;}
    append(...items){this.children.push(...items);}replaceChildren(...items){this.children=items;}
    setAttribute(name,value){this[name]=value;}addEventListener(name,fn){this.events.set(name,fn);}
    focus(){}scrollIntoView(){}close(){this.open=false;}showModal(){this.open=true;}remove(){}click(){if(this.tagName==='a')downloads.at(-1).filename=this.download;else return this.fire('click');}
    fire(name){return this.events.get(name)?.({target:this,currentTarget:this,preventDefault(){}});}
  }
  for(const id of ['notice','names-container','slot-count','add-player','search','expand-search','results','app-version','offline-status','open-data','close-data','data-dialog','open-history','close-history','history-dialog','history-filter','clear-history','export','import','import-file','persist','storage-status','update','update-status','install-banner','history-days','history-day-dialog','history-day-title','history-day-list','close-history-day']){const node=new Node();node.id=id;}
  const storage={getItem:key=>saved.get(key)??null,setItem:(key,value)=>saved.set(key,value),removeItem:key=>saved.delete(key)};
  const document={body:new Node('body'),baseURI:'https://masaotokumoto12-ux.github.io/PlayerSearch-DBD/',getElementById:id=>nodes.get(id),createElement:tag=>new Node(tag),querySelector:()=>({content:'https://dbd-player-search.m-aa-k-one-for-all-a.chatgpt.site/api/'})};
  const fetch=(url,options)=>new Promise(resolve=>calls.push({url:String(url),options,resolve:(data,status=200,retryAfter=null)=>resolve({ok:status>=200&&status<300,status,headers:{get:()=>retryAfter},json:async()=>data})}));
  vm.runInNewContext(source,{document,window:{localStorage:storage,isSecureContext:false},navigator:{onLine:true,userAgent:'test',maxTouchPoints:0},matchMedia:()=>({matches:false}),addEventListener(name,fn){events.set(name,fn);},confirm:()=>true,URL:LocalURL,Blob,Date:ClockDate,crypto:webcrypto,AbortController,setTimeout:timer,clearTimeout,fetch,console});
  return {nodes,calls,saved,clock,events,downloads};
}
async function ready(app){await new Promise(setImmediate);return app;}
const names=['MaKun_inkya','ヅオパン','日本語の名前','name-with.dot'];
function fixture(){return {version:'3.5.1',settings:{game:'dbd',customGame:'',mode:'smart'},results:names.map(name=>({name,routes:[['steam','https://steamcommunity.com/search/users/?text=sample'],['x','https://x.com/search?q=sample'],['youtube','https://www.youtube.com/results?search_query=sample'],['twitch','https://www.twitch.tv/search?term=sample'],['tiktok','https://www.tiktok.com/search/user?q=sample'],['5ch','https://www.google.com/search?q=sample%20site%3A5ch.net']].map(([id,url])=>({id,url:id==='youtube'?url+'%20DBD':url,broad:url,scope:id==='youtube'||id==='5ch'?'dbd':'name'}))}))};}
test('GitHub画面から4名を送信し、受信した24リンクを表示する',async()=>{
  const app=await ready(harness());assert.equal(app.calls.length,0);
  for(let i=1;i<4;i++)app.nodes.get('add-player').fire('click');
  for(let i=0;i<4;i++){const input=app.nodes.get(`name-${i}`);input.value=names[i];input.fire('input');}
  const first=app.nodes.get('search').fire('click');
  assert.equal(app.calls.length,1);
  assert.equal(app.calls[0].url,'https://dbd-player-search.m-aa-k-one-for-all-a.chatgpt.site/api/routes');
  assert.deepEqual(JSON.parse(app.calls[0].options.body).names,names);
  app.calls[0].resolve(fixture());await first;
  const blocks=app.nodes.get('results').children;assert.equal(blocks.length,4);
  assert.deepEqual(Array.from(blocks,block=>block.children[0].textContent),names);
  for(const block of blocks)assert.equal(block.children[1].children.length,6);
  await app.nodes.get('search').fire('click');
  assert.equal(app.calls.length,1,'同じ検索はキャッシュを再利用する');
  await app.nodes.get('expand-search').fire('click');
  assert.equal(app.calls.length,1,'検索を広げてもAPI通信しない');
  assert.equal(app.nodes.get('results').children[0].children[1].children[0].href,'https://steamcommunity.com/search/users/?text=sample');
  const restored=await ready(harness(app.saved));assert.equal(restored.calls.length,0,'復帰で検索しない');
  assert.equal(restored.nodes.get('results').children.length,4);
  for(const block of restored.nodes.get('results').children)assert.equal(block.children[1].children.length,6);
});

test('処理中の連打と、戻る・再読込では検索を再送しない',async()=>{
  const app=await ready(harness());const input=app.nodes.get('name-0');input.value=names[0];input.fire('input');
  const first=app.nodes.get('search').fire('click');
  await app.nodes.get('search').fire('click');assert.equal(app.calls.length,1);
  app.calls[0].resolve({...fixture(),results:fixture().results.slice(0,1)});await first;
  const restored=await ready(harness(app.saved));assert.equal(restored.calls.length,0);
  await restored.nodes.get('search').fire('click');assert.equal(restored.calls.length,0,'保存済み検索も再送しない');
});
test('429後は再読込しても再送しない。新しい入力も待機する',async()=>{
  const app=await ready(harness());const input=app.nodes.get('name-0');input.value='blocked';input.fire('input');
  const first=app.nodes.get('search').fire('click');app.calls[0].resolve({error:'Too many requests'},429,'60');await first;
  const restored=await ready(harness(app.saved));restored.nodes.get('name-0').value='different';restored.nodes.get('name-0').fire('input');
  await restored.nodes.get('search').fire('click');assert.equal(restored.calls.length,0);
});
test('重複名は1回だけ送信し、キャッシュ済みの名前は送信しない',async()=>{
  const app=await ready(harness());app.nodes.get('add-player').fire('click');
  for(let i=0;i<2;i++){app.nodes.get(`name-${i}`).value=names[0];app.nodes.get(`name-${i}`).fire('input');}
  const first=app.nodes.get('search').fire('click');assert.deepEqual(JSON.parse(app.calls[0].options.body).names,[names[0]]);
  app.calls[0].resolve({...fixture(),results:fixture().results.slice(0,1)});await first;
  app.clock.value+=2000;app.nodes.get('name-1').value=names[1];app.nodes.get('name-1').fire('input');
  const second=app.nodes.get('search').fire('click');assert.deepEqual(JSON.parse(app.calls[1].options.body).names,[names[1]]);
  app.calls[1].resolve({...fixture(),results:fixture().results.slice(1,2)});await second;
});
test('10分後の手動検索でだけ検索先を更新し、期限切れだけでは通信しない',async()=>{
  const app=await ready(harness());app.nodes.get('name-0').value=names[0];app.nodes.get('name-0').fire('input');
  const first=app.nodes.get('search').fire('click');app.calls[0].resolve({...fixture(),results:fixture().results.slice(0,1)});await first;
  app.clock.value+=600_000;assert.equal(app.calls.length,1);
  const refresh=app.nodes.get('search').fire('click');assert.equal(app.calls.length,2);
  app.calls[1].resolve({...fixture(),results:fixture().results.slice(0,1)});await refresh;
});
test('日付だけを表示し、選択した当日・過去日の履歴を開く。ファイル名は出さない',async()=>{
  const saved=new Map([['psd-core-v4',JSON.stringify({schemaVersion:4,inputs:[''],history:[
    {id:'today',name:'当日プレイヤー',date:'2026-10-23',count:2},
    {id:'old',name:'<img src=x onerror=alert(1)>',date:'2026-10-22',count:3}
  ]})]]);
  const app=await ready(harness(saved));app.clock.value=new Date(2026,9,23,23,59).getTime();
  app.nodes.get('open-history').fire('click');
  const days=app.nodes.get('history-days').children;
  assert.equal(days.length,2);
  assert.equal(days[0].children[0].textContent,'2026年10月23日');
  assert.equal(days[1].children[0].textContent,'2026年10月22日');
  days[0].fire('click');
  assert.equal(app.nodes.get('history-day-title').textContent,'2026年10月23日の検索履歴');
  let rows=app.nodes.get('history-day-list').children;
  assert.equal(rows.length,1);assert.equal(rows[0].children[0].children[0].textContent,'当日プレイヤー');
  assert.equal(rows[0].children[0].children[1].textContent,'2回目の検索');
  app.nodes.get('close-history-day').fire('click');days[1].fire('click');
  rows=app.nodes.get('history-day-list').children;
  assert.equal(rows[0].children[0].children[0].textContent,'<img src=x onerror=alert(1)>');
  assert.equal(rows[0].children[0].children[1].textContent,'3回目の検索');
  assert.equal(app.nodes.get('name-0').value,'');assert.equal(app.calls.length,0);
  app.clock.value+=120000;app.events.get('focus')();
  assert.equal(app.nodes.get('history-days').children.length,2);
  assert.equal(app.nodes.get('history-days').children[0].children[0].textContent,'2026年10月23日');
  assert.ok(saved.has('psd-history-files-v1'),'日別JSONを内部に自動保存する');
  assert.equal(app.calls.length,0,'閲覧と日付変更で通信しない');
});
test('日別ファイルを含む全削除の後は、非同期の保存で履歴を復活させない',async()=>{
  const app=harness(new Map([['psd-core-v4',JSON.stringify({schemaVersion:4,inputs:[''],history:[{id:'old',name:'old',date:'2026-10-22'}]})]]));
  app.nodes.get('clear-history').fire('click');
  await new Promise(setImmediate);
  assert.equal(JSON.parse(app.saved.get('psd-core-v4')).history.length,0);
  assert.equal(JSON.parse(app.saved.get('psd-history-files-v1')).files.length,0);
});
test('全体バックアップは内部の日別履歴と回数を含み、再起動後も日付から開ける',async()=>{
  const app=await ready(harness(new Map([['psd-core-v4',JSON.stringify({schemaVersion:4,inputs:[''],history:[{id:'old',name:'archive-player',date:'2026-10-22',count:4}]})]])));
  assert.equal(JSON.parse(app.saved.get('psd-core-v4')).history.length,0,'過去日は通常状態から退避する');
  app.nodes.get('export').fire('click');
  const backup=JSON.parse(await app.downloads[0].blob.text());
  assert.equal(backup.state.history[0].name,'archive-player');assert.equal(backup.state.history[0].count,4);
  const restored=await ready(harness(app.saved));
  restored.nodes.get('open-history').fire('click');
  assert.equal(restored.nodes.get('history-days').children[0].children[0].textContent,'2026年10月22日');
  restored.nodes.get('history-days').children[0].fire('click');
  assert.equal(restored.nodes.get('history-day-list').children[0].children[0].children[1].textContent,'4回目の検索');
  assert.equal(restored.calls.length,0);
});
test('キャッシュを使う再検索は2回目に更新し、翌日は1回に戻る。閲覧では増えない',async()=>{
  const app=await ready(harness(new Map(),new Date(2026,9,23,23,59,30).getTime()));
  app.nodes.get('add-player').fire('click');
  for(let i=0;i<2;i++){app.nodes.get(`name-${i}`).value=names[0];app.nodes.get(`name-${i}`).fire('input');}
  const first=app.nodes.get('search').fire('click');
  app.calls[0].resolve({...fixture(),results:fixture().results.slice(0,1)});await first;await ready(app);
  assert.equal(JSON.parse(app.saved.get('psd-core-v4')).history[0].count,1,'同一操作の重複入力は1回');
  await app.nodes.get('search').fire('click');await ready(app);
  assert.equal(app.calls.length,1,'キャッシュ済みの再検索で外部送信を増やさない');
  app.nodes.get('open-history').fire('click');app.nodes.get('history-days').children[0].fire('click');
  assert.equal(app.nodes.get('history-day-list').children.length,1);
  assert.equal(app.nodes.get('history-day-list').children[0].children[0].children[1].textContent,'2回目の検索');
  app.events.get('focus')();app.events.get('focus')();
  assert.equal(JSON.parse(app.saved.get('psd-core-v4')).history[0].count,2);
  app.clock.value+=60000;
  await app.nodes.get('search').fire('click');await ready(app);
  assert.equal(app.calls.length,1);
  assert.equal(JSON.parse(app.saved.get('psd-core-v4')).history[0].count,1);
  const restored=await ready(harness(app.saved,app.clock.value));
  restored.nodes.get('open-history').fire('click');
  const days=restored.nodes.get('history-days').children;assert.equal(days.length,2);
  days[0].fire('click');
  assert.equal(restored.nodes.get('history-day-list').children[0].children[0].children.length,1,'初回は回数表示なし');
  restored.nodes.get('close-history-day').fire('click');days[1].fire('click');
  assert.equal(restored.nodes.get('history-day-list').children[0].children[0].children[1].textContent,'2回目の検索');
  assert.equal(restored.calls.length,0);
});
test('日別履歴の読込中に検索しても、既存の4回から5回目へ正しく加算する',async()=>{
  const row={id:'saved',name:names[0],date:'2026-10-23',count:4};
  const files=[{key:row.date,filename:'PSD-history-2026-10-23.json',text:JSON.stringify({app:'P.S.D',format:'psd-history-day-v1',date:row.date,entries:[row]})}];
  const app=harness(new Map([
    ['psd-core-v4',JSON.stringify({schemaVersion:4,inputs:[names[0]],history:[]})],
    ['psd-history-files-v1',JSON.stringify({files})]
  ]));
  const search=app.nodes.get('search').fire('click');assert.equal(app.calls.length,0);
  await ready(app);assert.equal(app.calls.length,1);
  app.calls[0].resolve({...fixture(),results:fixture().results.slice(0,1)});await search;await ready(app);
  assert.equal(JSON.parse(app.saved.get('psd-core-v4')).history[0].count,5);
});

test('2MB超の自アプリのバックアップを別環境へ復元し、再出力内容を保つ',async()=>{
  const history=Array.from({length:3500},(_,i)=>({id:'large-'+i,name:`${i}-`+'あ'.repeat(220),date:'2026-10-22',count:i%7+1}));
  const original=await ready(harness(new Map([['psd-core-v4',JSON.stringify({schemaVersion:4,inputs:['One','Two'],history})]])));
  original.nodes.get('export').fire('click');
  const blob=original.downloads[0].blob;
  assert.ok(blob.size>2_000_000);
  const restored=await ready(harness());
  restored.nodes.get('import-file').files=[blob];
  await restored.nodes.get('import-file').fire('change');await ready(restored);
  restored.nodes.get('export').fire('click');
  const before=JSON.parse(await blob.text()),after=JSON.parse(await restored.downloads[0].blob.text());
  assert.deepEqual(after.state.inputs,before.state.inputs);
  assert.deepEqual(after.state.history,before.state.history);
  assert.equal(restored.calls.length,0);
});
test('player-check-v3のnameSlotsを移行し、原本と現行入力を維持する',async()=>{
  const raw=JSON.stringify({nameSlots:['One','Two','Three','Four','Five'],history:[{name:'old',date:'2026-10-22',count:3}]});
  const app=await ready(harness(new Map([['player-check-v3',raw]])));
  assert.equal(app.saved.get('player-check-v3'),raw);
  assert.deepEqual(JSON.parse(app.saved.get('psd-core-v4')).inputs,['One','Two','Three','Four']);
  app.nodes.get('name-0').value='Current';app.nodes.get('name-0').fire('input');
  const reloaded=await ready(harness(app.saved));
  assert.equal(reloaded.nodes.get('name-0').value,'Current');
  assert.equal(reloaded.calls.length,0);
});
test('不正なバックアップは現在の入力と保存データを置き換えない',async()=>{
  const app=await ready(harness());app.nodes.get('name-0').value='Keep';app.nodes.get('name-0').fire('input');
  const before=app.saved.get('psd-core-v4');
  for(const text of ['{invalid','{"state":{"inputs":[],"history":[],"schemaVersion":99}}']){
    app.nodes.get('import-file').files=[new Blob([text])];await app.nodes.get('import-file').fire('change');
    assert.equal(app.saved.get('psd-core-v4'),before);assert.equal(app.nodes.get('name-0').value,'Keep');
  }
});

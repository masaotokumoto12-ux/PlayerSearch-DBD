import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {webcrypto} from 'node:crypto';
const built=new URL('../public/app.js',import.meta.url);
const source=fs.readFileSync(fs.existsSync(built)?built:new URL('../app.js',import.meta.url),'utf8');
function harness(saved=new Map()){
  const clock={value:Date.now()};
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
  for(const id of ['notice','names-container','slot-count','add-player','search','expand-search','results','app-version','offline-status','open-data','close-data','data-dialog','open-history','close-history','history-dialog','history-filter','history-list','clear-history','export','import','import-file','persist','storage-status','update','update-status','install-banner','history-files','save-today-history','history-file-dialog','history-file-title','history-file-content','history-file-status','save-history-file','close-history-file']){const node=new Node();node.id=id;}
  const storage={getItem:key=>saved.get(key)??null,setItem:(key,value)=>saved.set(key,value),removeItem:key=>saved.delete(key)};
  const document={body:new Node('body'),baseURI:'https://masaotokumoto12-ux.github.io/PlayerSearch-DBD/',getElementById:id=>nodes.get(id),createElement:tag=>new Node(tag),querySelector:()=>({content:'https://dbd-player-search.m-aa-k-one-for-all-a.chatgpt.site/api/'})};
  const fetch=(url,options)=>new Promise(resolve=>calls.push({url:String(url),options,resolve:(data,status=200,retryAfter=null)=>resolve({ok:status>=200&&status<300,status,headers:{get:()=>retryAfter},json:async()=>data})}));
  vm.runInNewContext(source,{document,window:{localStorage:storage,isSecureContext:false},navigator:{onLine:true,userAgent:'test',maxTouchPoints:0},matchMedia:()=>({matches:false}),addEventListener(name,fn){events.set(name,fn);},confirm:()=>true,URL:LocalURL,Blob,Date:ClockDate,crypto:webcrypto,AbortController,setTimeout:timer,clearTimeout,fetch,console});
  return {nodes,calls,saved,clock,events,downloads};
}
const names=['MaKun_inkya','ヅオパン','日本語の名前','name-with.dot'];
function fixture(){return {version:'3.5.0',settings:{game:'dbd',customGame:'',mode:'smart'},results:names.map(name=>({name,routes:[['steam','https://steamcommunity.com/search/users/?text=sample'],['x','https://x.com/search?q=sample'],['youtube','https://www.youtube.com/results?search_query=sample'],['twitch','https://www.twitch.tv/search?term=sample'],['tiktok','https://www.tiktok.com/search/user?q=sample'],['5ch','https://www.google.com/search?q=sample%20site%3A5ch.net']].map(([id,url])=>({id,url:id==='youtube'?url+'%20DBD':url,broad:url,scope:id==='youtube'||id==='5ch'?'dbd':'name'}))}))};}
test('GitHub画面から4名を送信し、受信した24リンクを表示する',async()=>{
  const app=harness();assert.equal(app.calls.length,0);
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
  const restored=harness(app.saved);assert.equal(restored.calls.length,0,'復帰で検索しない');
  assert.equal(restored.nodes.get('results').children.length,4);
  for(const block of restored.nodes.get('results').children)assert.equal(block.children[1].children.length,6);
});

test('処理中の連打と、戻る・再読込では検索を再送しない',async()=>{
  const app=harness();const input=app.nodes.get('name-0');input.value=names[0];input.fire('input');
  const first=app.nodes.get('search').fire('click');
  await app.nodes.get('search').fire('click');assert.equal(app.calls.length,1);
  app.calls[0].resolve({...fixture(),results:fixture().results.slice(0,1)});await first;
  const restored=harness(app.saved);assert.equal(restored.calls.length,0);
  await restored.nodes.get('search').fire('click');assert.equal(restored.calls.length,0,'保存済み検索も再送しない');
});
test('429後は再読込しても再送しない。新しい入力も待機する',async()=>{
  const app=harness();const input=app.nodes.get('name-0');input.value='blocked';input.fire('input');
  const first=app.nodes.get('search').fire('click');app.calls[0].resolve({error:'Too many requests'},429,'60');await first;
  const restored=harness(app.saved);restored.nodes.get('name-0').value='different';restored.nodes.get('name-0').fire('input');
  await restored.nodes.get('search').fire('click');assert.equal(restored.calls.length,0);
});
test('重複名は1回だけ送信し、キャッシュ済みの名前は送信しない',async()=>{
  const app=harness();app.nodes.get('add-player').fire('click');
  for(let i=0;i<2;i++){app.nodes.get(`name-${i}`).value=names[0];app.nodes.get(`name-${i}`).fire('input');}
  const first=app.nodes.get('search').fire('click');assert.deepEqual(JSON.parse(app.calls[0].options.body).names,[names[0]]);
  app.calls[0].resolve({...fixture(),results:fixture().results.slice(0,1)});await first;
  app.clock.value+=2000;app.nodes.get('name-1').value=names[1];app.nodes.get('name-1').fire('input');
  const second=app.nodes.get('search').fire('click');assert.deepEqual(JSON.parse(app.calls[1].options.body).names,[names[1]]);
  app.calls[1].resolve({...fixture(),results:fixture().results.slice(1,2)});await second;
});
test('10分後の手動検索でだけ検索先を更新し、期限切れだけでは通信しない',async()=>{
  const app=harness();app.nodes.get('name-0').value=names[0];app.nodes.get('name-0').fire('input');
  const first=app.nodes.get('search').fire('click');app.calls[0].resolve({...fixture(),results:fixture().results.slice(0,1)});await first;
  app.clock.value+=600_000;assert.equal(app.calls.length,1);
  const refresh=app.nodes.get('search').fire('click');assert.equal(app.calls.length,2);
  app.calls[1].resolve({...fixture(),results:fixture().results.slice(0,1)});await refresh;
});
test('当日だけを名前表示し、前日以前は読み取り専用の日別ファイルにする',async()=>{
  const saved=new Map([['psd-core-v4',JSON.stringify({schemaVersion:4,inputs:[''],history:[
    {id:'today',name:'当日プレイヤー',date:'2026-10-23'},
    {id:'old',name:'<img src=x onerror=alert(1)>',date:'2026-10-22'}
  ]})]]);
  const app=harness(saved);app.clock.value=new Date(2026,9,23,23,59).getTime();
  app.nodes.get('open-history').fire('click');
  const today=app.nodes.get('history-list').children;
  assert.equal(today.length,1);assert.equal(today[0].children[0].children[0].textContent,'当日プレイヤー');
  const archive=app.nodes.get('history-files').children[0];
  assert.equal(archive.children[0].textContent,'PSD-history-2026-10-22.json');
  archive.fire('click');
  assert.ok(app.nodes.get('history-file-content').textContent.includes('<img src=x onerror=alert(1)>'));
  assert.equal(app.nodes.get('name-0').value,'');assert.equal(app.calls.length,0);
  app.clock.value+=120000;app.events.get('focus')();
  assert.equal(app.nodes.get('history-list').children[0].textContent,'当日の履歴はありません。');
  assert.equal(app.nodes.get('history-files').children.length,2);
  await new Promise(setImmediate);
  assert.ok(saved.has('psd-history-files-v1'),'日別JSONを端末内へ自動保存する');
  assert.equal(app.calls.length,0,'ファイル表示と日付変更で通信しない');
});
test('日別ファイルを含む全削除の後は、非同期の保存で履歴を復活させない',async()=>{
  const app=harness(new Map([['psd-core-v4',JSON.stringify({schemaVersion:4,inputs:[''],history:[{id:'old',name:'old',date:'2026-10-22'}]})]]));
  app.nodes.get('clear-history').fire('click');
  await new Promise(setImmediate);
  assert.equal(JSON.parse(app.saved.get('psd-core-v4')).history.length,0);
  assert.equal(JSON.parse(app.saved.get('psd-history-files-v1')).files.length,0);
});
test('日別JSONの書き出しと全体バックアップは過去日の履歴を含む',async()=>{
  const app=harness(new Map([['psd-core-v4',JSON.stringify({schemaVersion:4,inputs:[''],history:[{id:'old',name:'archive-player',date:'2026-10-22'}]})]]));
  app.clock.value=new Date(2026,9,23,12).getTime();
  await new Promise(setImmediate);
  assert.equal(JSON.parse(app.saved.get('psd-core-v4')).history.length,0,'保存成功後は過去日を通常状態から退避する');
  app.nodes.get('open-history').fire('click');
  app.nodes.get('history-files').children[0].fire('click');
  app.nodes.get('save-history-file').fire('click');
  assert.equal(app.downloads[0].filename,'PSD-history-2026-10-22.json');
  assert.equal(JSON.parse(await app.downloads[0].blob.text()).entries[0].name,'archive-player');
  app.nodes.get('export').fire('click');
  assert.equal(JSON.parse(await app.downloads[1].blob.text()).state.history[0].name,'archive-player');
  const restored=harness(app.saved);await new Promise(setImmediate);
  restored.nodes.get('open-history').fire('click');
  assert.equal(restored.nodes.get('history-files').children[0].children[0].textContent,'PSD-history-2026-10-22.json');
  assert.equal(restored.calls.length,0);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {webcrypto} from 'node:crypto';
const built=new URL('../public/app.js',import.meta.url);
const source=fs.readFileSync(fs.existsSync(built)?built:new URL('../app.js',import.meta.url),'utf8');
function harness(saved=new Map()){
  const clock={value:Date.now()};
  class ClockDate extends Date { static now(){return clock.value;} }
  const nodes=new Map(),calls=[];
  class Node{
    constructor(tag='div'){this.tagName=tag;this.children=[];this.events=new Map();this.value='';this.hidden=false;}
    set id(value){this._id=value;nodes.set(value,this);}get id(){return this._id;}
    get childElementCount(){return this.children.length;}
    append(...items){this.children.push(...items);}replaceChildren(...items){this.children=items;}
    setAttribute(name,value){this[name]=value;}addEventListener(name,fn){this.events.set(name,fn);}
    focus(){}scrollIntoView(){}close(){}showModal(){}
    fire(name){return this.events.get(name)?.({target:this,currentTarget:this,preventDefault(){}});}
  }
  for(const id of ['notice','names-container','slot-count','add-player','search','expand-search','results','app-version','offline-status','open-data','close-data','data-dialog','open-history','close-history','history-dialog','history-filter','history-list','clear-history','export','import','import-file','persist','storage-status','update','update-status','install-banner']){const node=new Node();node.id=id;}
  const storage={getItem:key=>saved.get(key)??null,setItem:(key,value)=>saved.set(key,value),removeItem:key=>saved.delete(key)};
  const document={baseURI:'https://masaotokumoto12-ux.github.io/PlayerSearch-DBD/',getElementById:id=>nodes.get(id),createElement:tag=>new Node(tag),querySelector:()=>({content:'https://dbd-player-search.m-aa-k-one-for-all-a.chatgpt.site/api/'})};
  const fetch=(url,options)=>new Promise(resolve=>calls.push({url:String(url),options,resolve:(data,status=200,retryAfter=null)=>resolve({ok:status>=200&&status<300,status,headers:{get:()=>retryAfter},json:async()=>data})}));
  vm.runInNewContext(source,{document,window:{localStorage:storage,isSecureContext:false},navigator:{onLine:true,userAgent:'test',maxTouchPoints:0},matchMedia:()=>({matches:false}),addEventListener(){},URL,Blob,Date:ClockDate,crypto:webcrypto,AbortController,setTimeout,clearTimeout,fetch,console});
  return {nodes,calls,saved,clock};
}
const names=['MaKun_inkya','ヅオパン','日本語の名前','name-with.dot'];
function fixture(){return {version:'3.4.6',settings:{game:'dbd',customGame:'',mode:'smart'},results:names.map(name=>({name,routes:[['steam','https://steamcommunity.com/search/users/?text=sample'],['x','https://x.com/search?q=sample'],['youtube','https://www.youtube.com/results?search_query=sample'],['twitch','https://www.twitch.tv/search?term=sample'],['tiktok','https://www.tiktok.com/search/user?q=sample'],['5ch','https://www.google.com/search?q=sample%20site%3A5ch.net']].map(([id,url])=>({id,url:'https://www.google.com/search?q=sample%20DBD',broad:url,scope:'dbd'}))}))};}
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

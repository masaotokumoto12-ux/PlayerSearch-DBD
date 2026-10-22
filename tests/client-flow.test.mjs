import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {webcrypto} from 'node:crypto';
const built=new URL('../public/app.js',import.meta.url);
const source=fs.readFileSync(fs.existsSync(built)?built:new URL('../app.js',import.meta.url),'utf8');
function harness(saved=new Map()){
  const nodes=new Map(),calls=[];
  class Node{
    constructor(tag='div'){this.tagName=tag;this.children=[];this.events=new Map();this.value='';this.hidden=false;}
    set id(value){this._id=value;nodes.set(value,this);}get id(){return this._id;}
    get childElementCount(){return this.children.length;}
    append(...items){this.children.push(...items);}replaceChildren(...items){this.children=items;}
    setAttribute(name,value){this[name]=value;}addEventListener(name,fn){this.events.set(name,fn);}
    focus(){}scrollIntoView(){}close(){}showModal(){}
    fire(name){return this.events.get(name)?.({target:this,currentTarget:this});}
  }
  for(const id of ['notice','names-container','slot-count','add-player','search','results','app-version','offline-status','open-data','close-data','data-dialog','open-history','close-history','history-dialog','history-filter','history-list','clear-history','export','import','import-file','persist','storage-status','update','update-status','install-banner']){const node=new Node();node.id=id;}
  const storage={getItem:key=>saved.get(key)??null,setItem:(key,value)=>saved.set(key,value),removeItem:key=>saved.delete(key)};
  const document={baseURI:'https://masaotokumoto12-ux.github.io/PlayerSearch-DBD/',getElementById:id=>nodes.get(id),createElement:tag=>new Node(tag),querySelector:()=>({content:'https://dbd-player-search.m-aa-k-one-for-all-a.chatgpt.site/api/'})};
  const fetch=(url,options)=>new Promise(resolve=>calls.push({url:String(url),options,resolve:data=>resolve({ok:true,json:async()=>data})}));
  vm.runInNewContext(source,{document,window:{localStorage:storage,isSecureContext:false},navigator:{onLine:true,userAgent:'test',maxTouchPoints:0},matchMedia:()=>({matches:false}),addEventListener(){},URL,Blob,Date,crypto:webcrypto,AbortController,setTimeout,clearTimeout,fetch,console});
  return {nodes,calls,saved};
}
const names=['MaKun_inkya','ヅオパン','日本語の名前','name-with.dot'];
function fixture(){return {settings:{game:'dbd',customGame:'',mode:'smart'},results:names.map(name=>({name,routes:[['steam','https://steamcommunity.com/search/users/?text=sample'],['x','https://x.com/search?q=sample'],['youtube','https://www.youtube.com/results?search_query=sample'],['twitch','https://www.twitch.tv/search?term=sample'],['tiktok','https://www.tiktok.com/search/user?q=sample'],['5ch','https://www.google.com/search?q=sample%20site%3A5ch.net']].map(([id,url])=>({id,url}))}))};}
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
  const second=app.nodes.get('search').fire('click');
  for(const block of app.nodes.get('results').children)assert.equal(block.children[1].children.length,0,'取得中は古いリンクを押せない');
  app.calls[1].resolve(fixture());await second;
  const restored=harness(app.saved);assert.equal(restored.calls.length,0,'復帰で検索しない');
  assert.equal(restored.nodes.get('results').children.length,4);
  for(const block of restored.nodes.get('results').children)assert.equal(block.children[1].children.length,6);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeCandidates,MEDIA} from '../lib/candidate-evidence.mjs';
const name='MaKun_inkya';
const result=(media,url)=>({results:[{name,sources:{[media]:{status:'found',candidates:[{url,discovered:true,evidence:[{url,verified:true,kind:'profile'}]}]}}}]});
test('every name gets all six media with honest not-fetched state',()=>{
  const out=normalizeCandidates({},[name,'ヅオパン',name]);
  assert.equal(out.length,2);
  assert.deepEqual(out[0].sources.map(x=>x.media),MEDIA);
  assert.ok(out.every(x=>x.sources.every(s=>s.status==='not_fetched')));
});
test('valid evidence retains a candidate without claiming identity',()=>{
  const x=normalizeCandidates(result('x','https://x.com/MaKun_inkya'),[name])[0].sources[1];
  assert.equal(x.status,'found');assert.equal(x.candidates.length,1);
  assert.equal(x.candidates[0].identityConfirmed,false);
});
test('rejects search links and invented profiles without evidence',()=>{
  for(const url of ['https://x.com/search?q=abc','http://x.com/abc','https://x.com:444/abc','https://x.com@evil.example/abc']){
    assert.equal(normalizeCandidates(result('x',url),[name])[0].sources[1].candidates.length,0,url);
  }
  const out=normalizeCandidates({results:[{name,sources:{x:{status:'found',candidates:[{url:'https://x.com/foo',discovered:true}]}}}]},[name])[0].sources[1];
  assert.equal(out.status,'not_fetched');
});
test('partial success deduplicates verified candidates',()=>{
  const url='https://www.youtube.com/@foo';
  const c={url,discovered:true,evidence:[{url,verified:true,kind:'profile'}]};
  const out=normalizeCandidates({results:[{name,sources:{youtube:{status:'restricted',candidates:[c,c]}}}]},[name])[0].sources[2];
  assert.equal(out.status,'partial');assert.equal(out.candidates.length,1);
});
test('5ch requires actual thread URL and does not accept Google search',()=>{
  const good='https://itest.5ch.net/test/read.cgi/gamef/1760000000/';
  assert.equal(normalizeCandidates(result('5ch',good),[name])[0].sources[5].candidates.length,1);
  assert.equal(normalizeCandidates(result('5ch','https://www.google.com/search?q=5ch'),[name])[0].sources[5].candidates.length,0);
});
test('unrecognized source status never becomes not_found',()=>{
  const out=normalizeCandidates({results:[{name,sources:{twitch:{status:'captcha'}}}]},[name])[0].sources[3];
  assert.equal(out.status,'not_fetched');
});

test('video and post evidence retain content URLs while candidates remain profiles',()=>{
  const rows=[
    ['youtube','https://www.youtube.com/@example','https://www.youtube.com/watch?v=abc123','video'],
    ['youtube','https://www.youtube.com/@example','https://www.youtube.com/shorts/abc123','video'],
    ['x','https://x.com/example','https://x.com/example/status/1234567890','post'],
    ['tiktok','https://www.tiktok.com/@example','https://www.tiktok.com/@example/video/1234567890','video']
  ];
  for(const [media,url,evidenceUrl,kind] of rows){
    const response={results:[{name,sources:{[media]:{status:'found',candidates:[{
      url,discovered:true,evidence:[{url:evidenceUrl,kind,verified:true}]
    }]}}}]};
    const out=normalizeCandidates(response,[name])[0].sources.find(x=>x.media===media);
    assert.equal(out.candidates.length,1,media+' candidate');
    assert.equal(out.candidates[0].evidence[0].url,evidenceUrl,media+' evidence URL');
    assert.equal(out.candidates[0].evidence[0].kind,kind);
  }
});
test('search paths cannot masquerade as a discovered profile',()=>{
  for(const [media,url] of [
    ['youtube','https://www.youtube.com/results?search_query=dbd'],
    ['tiktok','https://www.tiktok.com/search/user?q=dbd'],
    ['twitch','https://www.twitch.tv/search?term=dbd'],
    ['x','https://x.com/intent/tweet'],
    ['x','https://x.com/example/status/12345']
  ])assert.equal(normalizeCandidates(result(media,url),[name])[0].sources.find(x=>x.media===media).candidates.length,0,url);
});

test('multiple response rows and repeated profiles retain distinct verified posts',()=>{
  const profile='https://x.com/example';
  const post1='https://x.com/example/status/111';
  const post2='https://x.com/example/status/222';
  const row=(url,dbdRelated=false)=>({name,sources:{x:{status:'found',candidates:[{
    url:profile,discovered:true,dbdRelated,evidence:[{url,verified:true,kind:'post'}]
  }]}}});
  const out=normalizeCandidates({results:[row(post1),row(post2,true)]},[name])[0].sources[1];
  assert.equal(out.status,'found');
  assert.equal(out.candidates.length,1);
  assert.deepEqual(out.candidates[0].evidence.map(e=>e.url),[post1,post2]);
  assert.equal(out.candidates[0].dbdRelated,true);
  assert.equal(out.candidates[0].identityConfirmed,false);
});
test('a restricted duplicate row retains valid evidence but remains partial',()=>{
  const profile='https://www.youtube.com/@example';
  const response={results:[
    {name,sources:{youtube:{status:'found',candidates:[{url:profile,discovered:true,evidence:[{url:'https://www.youtube.com/watch?v=one',verified:true,kind:'video'}]}]}}},
    {name,sources:{youtube:{status:'restricted',candidates:[{url:profile,discovered:true,evidence:[{url:'https://www.youtube.com/watch?v=two',verified:true,kind:'video'}]}]}}}
  ]};
  const out=normalizeCandidates(response,[name])[0].sources[2];
  assert.equal(out.status,'partial');
  assert.equal(out.candidates.length,1);
  assert.equal(out.candidates[0].evidence.length,2);
});

test('rejects verified evidence from a different X, TikTok or Twitch account',()=>{
  for(const [media,profile,other] of [
    ['x','https://x.com/actual','https://x.com/unrelated/status/123'],
    ['tiktok','https://www.tiktok.com/@actual','https://www.tiktok.com/@unrelated/video/123'],
    ['twitch','https://www.twitch.tv/actual','https://www.twitch.tv/unrelated/clip/abc']
  ]){
    const out=normalizeCandidates({results:[{name,sources:{[media]:{status:'found',candidates:[{
      url:profile,discovered:true,evidence:[{url:other,verified:true,kind:'post'}]
    }]}}}]},[name])[0].sources.find(s=>s.media===media);
    assert.equal(out.candidates.length,0,media);
    assert.equal(out.status,'not_fetched',media);
  }
});
test('accepts same-account evidence while rejecting unrelated evidence',()=>{
  const profile='https://x.com/actual';
  const good='https://x.com/actual/status/123';
  const bad='https://x.com/unrelated/status/456';
  const out=normalizeCandidates({results:[{name,sources:{x:{status:'found',candidates:[{
    url:profile,discovered:true,evidence:[
      {url:bad,verified:true,kind:'post'},
      {url:good,verified:true,kind:'post'}
    ]
  }]}}}]},[name])[0].sources.find(s=>s.media==='x');
  assert.equal(out.candidates.length,1);
  assert.deepEqual(out.candidates[0].evidence.map(e=>e.url),[good]);
});

test('5ch evidence is explicitly a thread rather than a social profile',()=>{
  const thread='https://itest.5ch.net/test/read.cgi/gamef/1760000000/';
  const out=normalizeCandidates(result('5ch',thread),[name])[0].sources.find(s=>s.media==='5ch');
  assert.equal(out.candidates.length,1);
  assert.equal(out.candidates[0].evidence[0].kind,'thread');
  assert.equal(out.candidates[0].identityConfirmed,false);
});

test('5ch long excerpts retain a bounded readable passage without affecting SNS excerpt cap',()=>{
  const long='長'.repeat(6000);
  for(const [media,url,limit] of [
    ['5ch','https://itest.5ch.net/test/read.cgi/gamef/1760000000/',2048],
    ['x','https://x.com/example',280]
  ]){
    const response={results:[{name,sources:{[media]:{status:'found',candidates:[{
      url,discovered:true,evidence:[{url,verified:true,excerpt:long}]
    }]}}}]};
    const out=normalizeCandidates(response,[name])[0].sources.find(s=>s.media===media);
    assert.equal(out.candidates.length,1);
    assert.equal(out.candidates[0].evidence[0].excerpt.length,limit);
    assert.equal(out.candidates[0].evidence[0].excerpt,long.slice(0,limit));
  }
});

test('5ch evidence from a different thread cannot validate a candidate',()=>{
  const candidate='https://itest.5ch.net/test/read.cgi/gamef/1760000000/';
  const unrelated='https://itest.5ch.net/test/read.cgi/gamef/1760000001/';
  const response={results:[{name,sources:{'5ch':{status:'found',candidates:[{
    url:candidate,discovered:true,evidence:[{url:unrelated,verified:true,kind:'thread'}]
  }]}}}]};
  const out=normalizeCandidates(response,[name])[0].sources.find(s=>s.media==='5ch');
  assert.equal(out.candidates.length,0);
  assert.equal(out.status,'not_fetched');
  response.results[0].sources['5ch'].candidates[0].evidence.push({url:candidate,verified:true,kind:'thread'});
  const valid=normalizeCandidates(response,[name])[0].sources.find(s=>s.media==='5ch');
  assert.equal(valid.candidates.length,1);
  assert.deepEqual(valid.candidates[0].evidence.map(e=>e.url),[candidate]);
});

test('5ch evidence on a different host cannot verify a thread even with identical board and ID',()=>{
  const candidate='https://itest.5ch.net/test/read.cgi/gamef/1760000000/';
  const mirror='https://www.2ch.sc/test/read.cgi/gamef/1760000000/';
  const response={results:[{name,sources:{'5ch':{status:'found',candidates:[{
    url:candidate,discovered:true,evidence:[{url:mirror,verified:true,kind:'thread'}]
  }]}}}]};
  const source=normalizeCandidates(response,[name])[0].sources.find(s=>s.media==='5ch');
  assert.equal(source.candidates.length,0);
  assert.equal(source.status,'not_fetched');
});

test('repeated response rows cannot bypass the twelve-evidence cap',()=>{
  const profile='https://x.com/example';
  const rows=Array.from({length:4},(_,row)=>({
    name,sources:{x:{status:'found',candidates:[{
      url:profile,discovered:true,evidence:Array.from({length:8},(_,i)=>({
        url:'https://x.com/example/status/'+String(100+row*8+i),
        verified:true,kind:'post'
      }))
    }]}}
  }));
  const out=normalizeCandidates({results:rows},[name])[0].sources.find(s=>s.media==='x');
  assert.equal(out.status,'found');
  assert.equal(out.candidates.length,1);
  assert.equal(out.candidates[0].evidence.length,12);
  assert.deepEqual(out.candidates[0].evidence.map(e=>e.url),
    Array.from({length:12},(_,i)=>'https://x.com/example/status/'+String(100+i)));
});


test('a found candidate plus an unfinished response is partial, not fully found',()=>{
  const url='https://x.com/example';
  const out=normalizeCandidates({results:[
    {name,sources:{x:{status:'found',candidates:[{url,discovered:true,evidence:[{url,verified:true}]}]}}},
    {name,sources:{x:{status:'not_fetched'}}}
  ]},[name])[0].sources.find(s=>s.media==='x');
  assert.equal(out.status,'partial');
  assert.equal(out.candidates.length,1);
  assert.equal(out.candidates[0].url,url);
});

test('all confirmed successful rows still report found',()=>{
  const url='https://x.com/example';
  const row={name,sources:{x:{status:'found',candidates:[{url,discovered:true,evidence:[{url,verified:true}]}]}}};
  const out=normalizeCandidates({results:[row,row]},[name])[0].sources.find(s=>s.media==='x');
  assert.equal(out.status,'found');
  assert.equal(out.candidates.length,1);
});

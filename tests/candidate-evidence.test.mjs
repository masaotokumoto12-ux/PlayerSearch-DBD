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


test('unverified duplicate row cannot promote DBD relevance',()=>{
  const profile='https://x.com/actual';
  const out=normalizeCandidates({results:[
    {name,sources:{x:{status:'found',candidates:[{url:profile,discovered:true,dbdRelated:false,evidence:[{url:'https://x.com/actual/status/111',verified:true}]}]}}},
    {name,sources:{x:{status:'found',candidates:[{url:profile,discovered:true,dbdRelated:true,evidence:[{url:'https://x.com/other/status/222',verified:true}]}]}}}
  ]},[name])[0].sources.find(s=>s.media==='x');
  assert.equal(out.candidates.length,1);
  assert.equal(out.candidates[0].dbdRelated,false);
  assert.deepEqual(out.candidates[0].evidence.map(e=>e.url),['https://x.com/actual/status/111']);
});

test('duplicate verified same-account evidence may promote DBD relevance',()=>{
  const profile='https://x.com/actual';
  const post='https://x.com/actual/status/111';
  const row=dbdRelated=>({name,sources:{x:{status:'found',candidates:[{
    url:profile,discovered:true,dbdRelated,evidence:[{url:post,verified:true}]
  }]}}});
  const out=normalizeCandidates({results:[row(false),row(true)]},[name])[0].sources.find(s=>s.media==='x');
  assert.equal(out.candidates.length,1);
  assert.equal(out.candidates[0].dbdRelated,true);
  assert.equal(out.candidates[0].evidence.length,1);
});

test('verified duplicate row can promote DBD relevance after evidence cap',()=>{
  const profile='https://x.com/actual';
  const posts=Array.from({length:12},(_,i)=>({url:'https://x.com/actual/status/'+(100+i),verified:true,kind:'post'}));
  const response={results:[
    {name,sources:{x:{status:'found',candidates:[{url:profile,discovered:true,dbdRelated:false,evidence:posts}]}}},
    {name,sources:{x:{status:'found',candidates:[{url:profile,discovered:true,dbdRelated:true,evidence:[{url:'https://x.com/actual/status/999',verified:true,kind:'post'}]}]}}}
  ]};
  const out=normalizeCandidates(response,[name])[0].sources.find(s=>s.media==='x');
  assert.equal(out.candidates.length,1);
  assert.equal(out.candidates[0].evidence.length,12);
  assert.equal(out.candidates[0].dbdRelated,true);
});

test('unrelated row cannot promote DBD relevance after evidence cap',()=>{
  const profile='https://x.com/actual';
  const posts=Array.from({length:12},(_,i)=>({url:'https://x.com/actual/status/'+(100+i),verified:true,kind:'post'}));
  const response={results:[
    {name,sources:{x:{status:'found',candidates:[{url:profile,discovered:true,dbdRelated:false,evidence:posts}]}}},
    {name,sources:{x:{status:'found',candidates:[{url:profile,discovered:true,dbdRelated:true,evidence:[{url:'https://x.com/other/status/999',verified:true,kind:'post'}]}]}}}
  ]};
  const out=normalizeCandidates(response,[name])[0].sources.find(s=>s.media==='x');
  assert.equal(out.candidates[0].evidence.length,12);
  assert.equal(out.candidates[0].dbdRelated,false);
});


test('conflicting found and not_found rows preserve evidence and report partial',()=>{
  const url='https://x.com/example';
  const response={results:[
    {name,sources:{x:{status:'found',candidates:[{url,discovered:true,evidence:[{url,verified:true}]}]}}},
    {name,sources:{x:{status:'not_found'}}}
  ]};
  const out=normalizeCandidates(response,[name])[0].sources.find(s=>s.media==='x');
  assert.equal(out.status,'partial');
  assert.deepEqual(out.candidates.map(c=>c.url),[url]);
  assert.equal(out.candidates[0].identityConfirmed,false);
});

test('5ch board-prefixed route cannot borrow evidence from another board',()=>{
  const candidate='https://itest.5ch.net/gamef/test/read.cgi/gamef/1760000000/';
  const wrong='https://itest.5ch.net/other/test/read.cgi/gamef/1760000000/';
  const response={results:[{name,sources:{'5ch':{status:'found',candidates:[{
    url:candidate,discovered:true,evidence:[{url:wrong,verified:true,kind:'thread'}]
  }]}}}]};
  const out=normalizeCandidates(response,[name])[0].sources[5];
  assert.equal(out.candidates.length,0);
  assert.equal(out.status,'not_fetched');
  response.results[0].sources['5ch'].candidates[0].evidence.push({url:candidate,verified:true});
  assert.equal(normalizeCandidates(response,[name])[0].sources[5].candidates.length,1);
});

test('5ch thread route and board route cannot validate one another by numeric ID',()=>{
  const candidate='https://itest.5ch.net/thread/1760000000';
  const wrong='https://itest.5ch.net/test/read.cgi/gamef/1760000000/';
  const response={results:[{name,sources:{'5ch':{status:'found',candidates:[{
    url:candidate,discovered:true,evidence:[{url:wrong,verified:true}]
  }]}}}]};
  assert.equal(normalizeCandidates(response,[name])[0].sources[5].candidates.length,0);
});

test('YouTube video evidence with a different declared channel owner is rejected',()=>{
  const profile='https://www.youtube.com/@actual';
  const video='https://www.youtube.com/watch?v=video123';
  const response={results:[{name,sources:{youtube:{status:'found',candidates:[{
    url:profile,discovered:true,dbdRelated:true,evidence:[{
      url:video,verified:true,kind:'video',channelUrl:'https://www.youtube.com/@unrelated'
    }]
  }]}}}]};
  const out=normalizeCandidates(response,[name])[0].sources[2];
  assert.equal(out.candidates.length,0);
  assert.equal(out.status,'not_fetched');
  response.results[0].sources.youtube.candidates[0].evidence[0].channelUrl=profile;
  const valid=normalizeCandidates(response,[name])[0].sources[2];
  assert.equal(valid.candidates.length,1);
  assert.equal(valid.candidates[0].dbdRelated,true);
});
test('YouTube owner conflict cannot promote a duplicate profile to DBD-related',()=>{
  const profile='https://www.youtube.com/@actual';
  const row=(dbdRelated,evidence)=>({name,sources:{youtube:{status:'found',candidates:[{
    url:profile,discovered:true,dbdRelated,evidence
  }]}}});
  const out=normalizeCandidates({results:[
    row(false,[{url:profile,verified:true}]),
    row(true,[{url:'https://www.youtube.com/watch?v=video123',verified:true,
      channelUrl:'https://www.youtube.com/@unrelated'}])
  ]},[name])[0].sources[2];
  assert.equal(out.candidates.length,1);
  assert.equal(out.candidates[0].dbdRelated,false);
  assert.deepEqual(out.candidates[0].evidence.map(e=>e.url),[profile]);
});


test('candidate evidence cannot turn an unfinished source into full success',()=>{
  const url='https://x.com/example';
  for(const status of ['not_fetched','not_found']){
    const out=normalizeCandidates({results:[{name,sources:{x:{status,candidates:[{
      url,discovered:true,evidence:[{url,verified:true}]
    }]}}}]},[name])[0].sources.find(s=>s.media==='x');
    assert.equal(out.status,'partial',status);
    assert.equal(out.candidates.length,1);
    assert.equal(out.candidates[0].identityConfirmed,false);
  }
});

test('evidence validation continues after storage reaches twelve without storing extra URLs',()=>{
  const profile='https://x.com/actual';
  let inspected=false;
  const evidence=Array.from({length:12},(_,i)=>({
    url:'https://x.com/actual/status/'+(100+i),verified:true,kind:'post'
  }));
  const later={verified:true,kind:'post'};
  Object.defineProperty(later,'url',{get(){inspected=true;return 'https://x.com/actual/status/999';}});
  evidence.push(later);
  const response={results:[{name,sources:{x:{status:'found',candidates:[{
    url:profile,discovered:true,dbdRelated:true,evidence
  }]}}}]};
  const source=normalizeCandidates(response,[name])[0].sources[1];
  assert.equal(inspected,true,'bounded verification scan must inspect later evidence');
  assert.equal(source.candidates.length,1);
  assert.equal(source.candidates[0].evidence.length,12);
  assert.equal(source.candidates[0].dbdRelated,true);
});

test('5ch thread URLs reject arbitrary trailing path components',()=>{
  const base='https://itest.5ch.net/test/read.cgi/gamef/1760000000/';
  for(const suffix of ['random','123/garbage','foo/bar']){
    assert.equal(normalizeCandidates(result('5ch',base+suffix),[name])[0].sources[5].candidates.length,0);
  }
  for(const suffix of ['','100','100-200','l50']){
    assert.equal(normalizeCandidates(result('5ch',base+suffix),[name])[0].sources[5].candidates.length,1);
  }
});

test('YouTube evidence rejects ambiguous repeated video IDs and retains one valid ID',()=>{
  const profile='https://www.youtube.com/@example';
  const check=link=>normalizeCandidates({results:[{name,sources:{youtube:{status:'found',candidates:[{
    url:profile,discovered:true,evidence:[{url:link,verified:true,kind:'video'}]
  }]}}}]},[name])[0].sources[2];
  assert.equal(check('https://www.youtube.com/watch?v=one&v=two').candidates.length,0);
  assert.equal(check('https://www.youtube.com/watch?v=').candidates.length,0);
  assert.equal(check('https://www.youtube.com/watch?v='+ 'x'.repeat(65)).candidates.length,0);
  assert.equal(check('https://www.youtube.com/watch?v=one').candidates.length,1);
});


test('truncated candidate inputs never claim complete success',()=>{
  const profile=i=>'https://x.com/player'+i;
  const candidate=i=>({url:profile(i),discovered:true,evidence:[{url:profile(i),verified:true}]});
  const out=normalizeCandidates({results:[{name,sources:{x:{status:'found',candidates:Array.from({length:101},(_,i)=>candidate(i))}}}]},[name])[0].sources.find(s=>s.media==='x');
  assert.equal(out.candidates.length,100);
  assert.equal(out.status,'partial');
  const empty=normalizeCandidates({results:[{name,sources:{x:{status:'found',candidates:Array.from({length:101},()=>({discovered:false}))}}}]},[name])[0].sources.find(s=>s.media==='x');
  assert.equal(empty.status,'partial');
  assert.equal(empty.candidates.length,0);
});

test('Twitch candidate must be a single valid channel path; clips only as evidence',()=>{
  for(const url of ['https://www.twitch.tv/example/videos','https://www.twitch.tv/example/clip/abc','https://www.twitch.tv/example/other','https://www.twitch.tv/bad.name']){
    const source=normalizeCandidates(result('twitch',url),[name])[0].sources[3];
    assert.equal(source.candidates.length,0,url);
  }
  const url='https://www.twitch.tv/example';
  const out=normalizeCandidates({results:[{name,sources:{twitch:{status:'found',candidates:[{url,discovered:true,evidence:[{url:'https://www.twitch.tv/example/clip/abc-123',verified:true,kind:'video'}]}]}}}]},[name])[0].sources[3];
  assert.equal(out.candidates.length,1);
  assert.equal(out.candidates[0].evidence[0].url,'https://www.twitch.tv/example/clip/abc-123');
});

test('more than 100 evidence entries yields partial, even when first 100 validate',()=>{
  const profile='https://x.com/example';
  const make=(valid)=>({url:valid?'https://x.com/example/status/123':'https://x.com/unrelated/status/123',verified:true,kind:'post'});
  const check=evidence=>normalizeCandidates({results:[{name,sources:{x:{status:'found',candidates:[{
    url:profile,discovered:true,evidence
  }]}}}]},[name])[0].sources[1];
  const full=check(Array.from({length:100},()=>make(true)));
  assert.equal(full.status,'found');
  const cut=check([...Array.from({length:100},()=>make(true)),make(true)]);
  assert.equal(cut.status,'partial');
  assert.equal(cut.candidates.length,1);
  assert.equal(cut.candidates[0].evidence.length,1);
  const noMatch=check([...Array.from({length:100},()=>make(false)),make(true)]);
  assert.equal(noMatch.status,'partial');
  assert.equal(noMatch.candidates.length,0);
});

test('Steam profile evidence must match the candidate account',()=>{
  const profile='https://steamcommunity.com/id/actual';
  const other='https://steamcommunity.com/id/unrelated';
  const make=evidenceUrl=>normalizeCandidates({results:[{name,sources:{steam:{
    status:'found',candidates:[{url:profile,discovered:true,evidence:[{url:evidenceUrl,verified:true}]}]
  }}}]},[name])[0].sources[0];
  assert.equal(make(other).candidates.length,0);
  assert.equal(make(other).status,'not_fetched');
  assert.equal(make(profile).candidates.length,1);
});

test('YouTube profile evidence cannot validate a different channel',()=>{
  const profile='https://www.youtube.com/@actual';
  const other='https://www.youtube.com/@unrelated';
  const response={results:[{name,sources:{youtube:{status:'found',candidates:[{
    url:profile,discovered:true,evidence:[{url:other,verified:true,kind:'profile'}]
  }]}}}]};
  const out=normalizeCandidates(response,[name])[0].sources.find(s=>s.media==='youtube');
  assert.equal(out.candidates.length,0);
  assert.equal(out.status,'not_fetched');
  response.results[0].sources.youtube.candidates[0].evidence.push({url:profile,verified:true,kind:'profile'});
  const valid=normalizeCandidates(response,[name])[0].sources.find(s=>s.media==='youtube');
  assert.equal(valid.candidates.length,1);
  assert.deepEqual(valid.candidates[0].evidence.map(e=>e.url),[profile]);
});

test('YouTube evidence rejects malformed shorts/live/watch video identifiers',()=>{
  const profile='https://www.youtube.com/@example';
  const check=link=>normalizeCandidates({results:[{name,sources:{youtube:{status:'found',candidates:[{
    url:profile,discovered:true,evidence:[{url:link,verified:true,kind:'video'}]
  }]}}}]},[name])[0].sources[2];
  for(const link of [
    'https://www.youtube.com/shorts/%2F',
    'https://www.youtube.com/live/%20',
    'https://www.youtube.com/shorts/'+ 'x'.repeat(65),
    'https://www.youtube.com/watch?v=%2F'
  ])assert.equal(check(link).candidates.length,0,link);
  for(const link of [
    'https://www.youtube.com/shorts/abc_123-xyz',
    'https://www.youtube.com/live/abc_123-xyz',
    'https://www.youtube.com/watch?v=abc_123-xyz'
  ])assert.equal(check(link).candidates.length,1,link);
});


test('TikTok handle syntax rejects encoded separators, spaces and oversized names',()=>{
  const check=url=>normalizeCandidates({results:[{name,sources:{tiktok:{status:'found',candidates:[{
    url,discovered:true,evidence:[{url,verified:true,kind:'profile'}]
  }]}}}]},[name])[0].sources[4];
  for(const url of [
    'https://www.tiktok.com/@bad%2Fname',
    'https://www.tiktok.com/@bad%20name',
    'https://www.tiktok.com/@'+'a'.repeat(25),
    'https://www.tiktok.com/@bad!name'
  ])assert.equal(check(url).candidates.length,0,url);
  for(const url of ['https://www.tiktok.com/@valid.name_12','https://www.tiktok.com/@valid_12'])
    assert.equal(check(url).candidates.length,1,url);
});


test('YouTube profile paths reject encoded separators and invalid channel IDs',()=>{
  const check=url=>normalizeCandidates(result('youtube',url),[name])[0].sources[2];
  for(const url of [
    'https://www.youtube.com/@bad%2Fname',
    'https://www.youtube.com/@bad%20name',
    'https://www.youtube.com/@'+'a'.repeat(31),
    'https://www.youtube.com/channel/not-a-channel-id',
    'https://www.youtube.com/user/bad%2Fname'
  ])assert.equal(check(url).candidates.length,0,url);
  for(const url of [
    'https://www.youtube.com/@valid.name_12',
    'https://www.youtube.com/channel/UC'+'a'.repeat(22),
    'https://www.youtube.com/user/valid_name'
  ])assert.equal(check(url).candidates.length,1,url);
});

test('Steam vanity paths reject encoded separators and malformed IDs',()=>{
  const check=url=>normalizeCandidates(result('steam',url),[name])[0].sources[0];
  for(const url of [
    'https://steamcommunity.com/id/bad%2Fname',
    'https://steamcommunity.com/id/bad%20name',
    'https://steamcommunity.com/id/bad!name',
    'https://steamcommunity.com/id/'+'a'.repeat(101),
    'https://steamcommunity.com/profiles/123'
  ])assert.equal(check(url).candidates.length,0,url);
  for(const url of [
    'https://steamcommunity.com/id/valid.name_12',
    'https://steamcommunity.com/profiles/76561198000000000'
  ])assert.equal(check(url).candidates.length,1,url);
});

test('5ch board URLs reject encoded separators and control characters',()=>{
  const check=url=>normalizeCandidates(result('5ch',url),[name])[0].sources[5];
  for(const url of [
    'https://itest.5ch.net/test/read.cgi/board%2Fother/1234567890',
    'https://itest.5ch.net/test/read.cgi/board%5Cother/1234567890',
    'https://itest.5ch.net/test/read.cgi/board%00other/1234567890',
    'https://itest.5ch.net/board%2Fother/test/read.cgi/board%2Fother/1234567890'
  ])assert.equal(check(url).candidates.length,0,url);
  assert.equal(check('https://itest.5ch.net/test/read.cgi/board/1234567890').candidates.length,1);
});

test('5ch board names reject percent escapes, Unicode and path punctuation',()=>{
  const check=url=>normalizeCandidates(result('5ch',url),[name])[0].sources[5];
  for(const board of ['game%252Fother','game%2Eother','game%25','game.name','日本語','game%3Fother']){
    const url='https://itest.5ch.net/test/read.cgi/'+board+'/1760000000/';
    assert.equal(check(url).candidates.length,0,url);
  }
  for(const board of ['gamef','game_123']){
    const url='https://itest.5ch.net/test/read.cgi/'+board+'/1760000000/';
    assert.equal(check(url).candidates.length,1,url);
  }
});

test('Twitch rejects ambiguous doubled separators and keeps canonical profile/clip paths',()=>{
  const profile='https://www.twitch.tv/example';
  for(const bad of ['https://www.twitch.tv/example//','https://www.twitch.tv/example//clip/abc','https://www.twitch.tv/example/clip//abc','https://www.twitch.tv/example/clip/abc//']){
    const response=result('twitch',bad);
    assert.equal(normalizeCandidates(response,[name])[0].sources[3].candidates.length,0,bad);
  }
  for(const good of [profile,'https://www.twitch.tv/example/']){
    assert.equal(normalizeCandidates(result('twitch',good),[name])[0].sources[3].candidates.length,1,good);
  }
  const response={results:[{name,sources:{twitch:{status:'found',candidates:[{
    url:profile,discovered:true,evidence:[{url:'https://www.twitch.tv/example/clip/abc',verified:true,kind:'post'}]
  }]}}}]};
  assert.equal(normalizeCandidates(response,[name])[0].sources[3].candidates.length,1);
});

test('X and TikTok reject doubled path separators in profiles and posts',()=>{
  for(const [media,profile,post] of [
    ['x','https://x.com/example','https://x.com/example/status/12345'],
    ['tiktok','https://www.tiktok.com/@example','https://www.tiktok.com/@example/video/12345']
  ]){
    const index=media==='x'?1:4;
    const check=url=>normalizeCandidates(result(media,url),[name])[0].sources[index];
    for(const bad of [profile+'//',profile+'//extra',post.replace(media==='x'?'/status/':'/video/',media==='x'?'//status/':'//video/'),post+'//']){
      assert.equal(check(bad).candidates.length,0,bad);
    }
    assert.equal(check(profile).candidates.length,1,profile);
    assert.equal(check(profile+'/').candidates.length,1,profile);
    const evidence={results:[{name,sources:{[media]:{status:'found',candidates:[{
      url:profile,discovered:true,evidence:[{url:post,verified:true,kind:'post'}]
    }]}}}]};
    assert.equal(normalizeCandidates(evidence,[name])[0].sources[index].candidates.length,1,post);
    evidence.results[0].sources[media].candidates[0].evidence[0].url=post+'//';
    assert.equal(normalizeCandidates(evidence,[name])[0].sources[index].candidates.length,0,post+'//');
  }
});


test('Twitch clip slug length is bounded without rejecting valid clips',()=>{
  const profile='https://www.twitch.tv/example';
  const check=slug=>normalizeCandidates({results:[{name,sources:{twitch:{status:'found',candidates:[{
    url:profile,discovered:true,evidence:[{url:profile+'/clip/'+slug,verified:true,kind:'video'}]
  }]}}}]},[name])[0].sources.find(s=>s.media==='twitch');
  assert.equal(check('a'.repeat(100)).candidates.length,1);
  assert.equal(check('a'.repeat(101)).candidates.length,0);
  assert.equal(check('a'.repeat(101)).status,'not_fetched');
});


test('X service routes are never accepted as discovered player profiles',()=>{
  for(const route of ['login','signup','compose','account','privacy','tos','help']){
    const url='https://x.com/'+route;
    const source=normalizeCandidates(result('x',url),[name])[0].sources.find(s=>s.media==='x');
    assert.equal(source.candidates.length,0,url);
    assert.equal(source.status,'not_fetched',url);
  }
  const normal=normalizeCandidates(result('x','https://x.com/real_player'),[name])[0].sources.find(s=>s.media==='x');
  assert.equal(normal.candidates.length,1);
});

test('YouTube allowed host aliases identify the same profile, but not another channel',()=>{
  const profile='https://www.youtube.com/@actual';
  const check=(evidenceUrl,channelUrl)=>normalizeCandidates({results:[{name,sources:{youtube:{status:'found',candidates:[{
    url:profile,discovered:true,evidence:[{url:evidenceUrl,verified:true,channelUrl}]
  }]}}}]},[name])[0].sources[2];
  assert.equal(check('https://m.youtube.com/@actual').candidates.length,1);
  assert.equal(check('https://m.youtube.com/watch?v=abc123','https://youtube.com/@actual').candidates.length,1);
  assert.equal(check('https://m.youtube.com/@other').candidates.length,0);
  assert.equal(check('https://m.youtube.com/watch?v=abc123','https://youtube.com/@other').candidates.length,0);
});


test('5ch board-prefixed thread URLs require matching board identifiers',()=>{
  const good='https://itest.5ch.net/gamef/test/read.cgi/gamef/1760000000/';
  const bad='https://itest.5ch.net/gamef/test/read.cgi/other/1760000000/';
  const source=url=>normalizeCandidates(result('5ch',url),[name])[0].sources[5];
  assert.equal(source(good).candidates.length,1);
  assert.equal(source(bad).candidates.length,0);
  assert.equal(source(bad).status,'not_fetched');
});

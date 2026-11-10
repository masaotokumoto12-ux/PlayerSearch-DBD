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

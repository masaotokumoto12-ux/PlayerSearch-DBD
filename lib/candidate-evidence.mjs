// Fail-closed adapter: accepts only evidence-bearing discoveries from a trusted upstream.
// This module does not fetch, scrape, assert existence, or infer identity.
export const MEDIA = Object.freeze(['steam','x','youtube','twitch','tiktok','5ch']);
export const STATES = Object.freeze(['found','not_found','not_fetched','restricted','partial','error']);
const hosts = {
  steam:['steamcommunity.com'],x:['x.com','twitter.com'],
  youtube:['youtube.com','www.youtube.com','m.youtube.com'],
  twitch:['twitch.tv','www.twitch.tv'],tiktok:['tiktok.com','www.tiktok.com'],
  '5ch':['5ch.net','www.5ch.net','itest.5ch.net','2ch.sc','www.2ch.sc']
};
function validUrl(raw, media, evidence=false) {
  try {
    const u=new URL(raw);
    if(u.protocol!=='https:'||u.username||u.password||u.port||!hosts[media]?.includes(u.hostname.toLowerCase()))return null;
    const p=u.pathname;
    const parts=p.split('/').filter(Boolean);
    const first=(parts[0]||'').toLowerCase();
    if(media==='steam'&&!/^\\/(?:id\\/[^/]+|profiles\\/\\d{17})\\/?$/i.test(p))return null;
    if(media==='x'){
      if(parts.length<1||parts.length>2||!/^\\w{1,15}$/.test(parts[0])||
        ['search','explore','home','notifications','messages','settings','i','intent','share','hashtag'].includes(first))return null;
      if(parts.length>1&&!(evidence&&parts.length===3&&parts[1].toLowerCase()==='status'&&/^\d+$/.test(parts[2])))return null;
    }
    if(media==='youtube'){
      const profile=/^\\/(?:@[^/]+|channel\\/[^/]+|c\\/[^/]+|user\\/[^/]+)\\/?$/i.test(p);
      const video=evidence&&(/^\\/(?:watch|shorts\\/[^/]+|live\\/[^/]+)\\/?$/i.test(p));
      if(!profile&&!video)return null;
      if(first==='watch'&&!u.searchParams.get('v'))return null;
    }
    if(media==='twitch'){
      if(!parts.length||['search','directory','downloads','settings','login','signup','videos'].includes(first))return null;
      if(parts.length>1&&!(evidence&&parts.length===3&&parts[1]==='clip'))return null;
    }
    if(media==='tiktok'){
      if(!/^@[^/]+$/.test(parts[0]||''))return null;
      if(parts.length>1&&!(evidence&&parts.length===3&&parts[1]==='video'&&/^\\d+$/.test(parts[2])))return null;
    }
    if(media==='5ch'&&!/^\\/(?:test\\/read\\.cgi\\/[^/]+\\/\\d+|[^/]+\\/test\\/read\\.cgi\\/[^/]+\\/\\d+|thread\\/\\d+)(?:\\/.*)?$/i.test(p))return null;
    if(media==='youtube'&&evidence&&first==='watch'){
      const videoId=u.searchParams.get('v');u.search='';u.searchParams.set('v',videoId);
    } else u.search='';
    u.hash='';return u.href;
  }catch{return null;}
}
export function normalizeCandidates(response, requestedNames) {
  const names=[...new Set((Array.isArray(requestedNames)?requestedNames:[]).filter(x=>typeof x==='string'&&x.trim()).map(x=>x.trim()))];
  const rows=Array.isArray(response?.results)?response.results:[];
  return names.map(name=>{
    const row=rows.find(x=>x?.name===name);
    return {name,sources:MEDIA.map(media=>{
      const source=row?.sources?.[media], rawStatus=source?.status;
      const state=STATES.includes(rawStatus)?rawStatus:'not_fetched';
      const candidates=[];
      for(const c of (Array.isArray(source?.candidates)?source.candidates:[]).slice(0,100)){
        if(c?.discovered!==true||!Array.isArray(c.evidence))continue;
        const url=validUrl(c.url,media);
        if(!url||candidates.some(x=>x.url===url))continue;
        const evidence=[],seen=new Set();
        for(const e of c.evidence.slice(0,100)){
          if(e?.verified!==true)continue;
          const link=validUrl(e.url,media,true);
          if(!link||seen.has(link))continue;
          seen.add(link);
          evidence.push({url:link,kind:e.kind==='post'?'post':e.kind==='video'?'video':'profile',excerpt:typeof e.excerpt==='string'?e.excerpt.slice(0,280):''});
          if(evidence.length===12)break;
        }
        if(!evidence.length)continue;
        candidates.push({url,evidence,dbdRelated:c.dbdRelated===true,identityConfirmed:false});
      }
      return {media,status:candidates.length?(state==='partial'||state==='restricted'||state==='error'?'partial':'found'):(state==='found'?'not_fetched':state),candidates};
    })};
  });
}

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
    if(media==='steam'&&!/^\/(?:id\/[a-zA-Z0-9._-]{2,100}|profiles\/\d{17})\/?$/i.test(p))return null;
    if(media==='x'){
      if(parts.length<1||parts.length>3||!/^\w{1,15}$/.test(parts[0])||
        ['search','explore','home','notifications','messages','settings','i','intent','share','hashtag'].includes(first))return null;
      if(parts.length>1&&!(evidence&&parts.length===3&&parts[1].toLowerCase()==='status'&&/^\d+$/.test(parts[2])))return null;
    }
    if(media==='youtube'){
      const profile=/^\/(?:@[a-zA-Z0-9._-]{1,30}|channel\/UC[a-zA-Z0-9_-]{22}|c\/[a-zA-Z0-9._-]{1,100}|user\/[a-zA-Z0-9._-]{1,100})\/?$/i.test(p);
      const video=evidence&&(/^\/(?:watch|shorts\/[^/]+|live\/[^/]+)\/?$/i.test(p));
      if(!profile&&!video)return null;
      if(first==='watch'&&(u.searchParams.getAll('v').length!==1||!/^[a-zA-Z0-9_-]{1,64}$/.test(u.searchParams.get('v')||'')))return null;
      if((first==='shorts'||first==='live')&&(!/^\/(?:shorts|live)\/[a-zA-Z0-9_-]{1,64}\/?$/i.test(p)))return null;
    }
    if(media==='twitch'){
      if(!parts.length||['search','directory','downloads','settings','login','signup','videos'].includes(first))return null;
      if(!/^[a-z0-9_]{1,25}$/i.test(parts[0])||
        (parts.length!==1&&!(evidence&&parts.length===3&&parts[1]==='clip'&&/^[a-z0-9_-]+$/i.test(parts[2]))))return null;
    }
    if(media==='tiktok'){
      if(!/^@[a-zA-Z0-9._]{1,24}$/.test(parts[0]||''))return null;
      if(parts.length>1&&!(evidence&&parts.length===3&&parts[1]==='video'&&/^\d+$/.test(parts[2])))return null;
    }
    if(media==='5ch'&&!/^\/(?:test\/read\.cgi\/[^/]+\/\d+|[^/]+\/test\/read\.cgi\/[^/]+\/\d+|thread\/\d+)(?:\/(?:\d+(?:-\d+)?|l\d+))?\/?$/i.test(p))return null;
    if(media==='youtube'&&evidence&&first==='watch'){
      const videoId=u.searchParams.get('v');u.search='';u.searchParams.set('v',videoId);
    } else u.search='';
    u.hash='';return u.href;
  }catch{return null;}
}
// Profile-scoped evidence must belong to the same account. A verified post
// from an unrelated account is not evidence for the candidate profile.
function belongsToCandidate(candidateUrl, evidenceUrl, media) {
  if(media==='5ch'){
    // Thread evidence must refer to the very same thread, not another topic.
    const threadKey=url=>{
      const parts=new URL(url).pathname.split('/').filter(Boolean);
      const idx=parts.indexOf('read.cgi');
      if(idx>=1&&parts[idx-1]==='test') {
        const board=parts[idx+1], id=parts[idx+2];
        // /board/test/read.cgi/board/id must agree on the board name.
        if(!board||!/^\d+$/.test(id||'')||
          (idx===2&&parts[0]!==board)||idx>2)return null;
        return 'board:'+board+'/'+id;
      }
      return parts[0]==='thread'&&/^\d+$/.test(parts[1]||'') ? 'thread:'+parts[1] : null;
    };
    const candidate=threadKey(candidateUrl), evidence=threadKey(evidenceUrl);
    return candidate!==null&&candidate===evidence&&new URL(candidateUrl).hostname.toLowerCase()===new URL(evidenceUrl).hostname.toLowerCase();
  }
  if(media==='youtube'){
    // A channel/profile evidence URL must identify this candidate, not another channel.
    // Video ownership still requires independent upstream verification.
    const path=new URL(evidenceUrl).pathname;
    if(!/^\/(?:watch|shorts\/|live\/)/i.test(path))return candidateUrl===evidenceUrl;
    return true;
  }
  if(!['steam','x','tiktok','twitch'].includes(media))return true;
  const a=new URL(candidateUrl).pathname.split('/').filter(Boolean);
  const b=new URL(evidenceUrl).pathname.split('/').filter(Boolean);
  return media==='steam' ? a.length===2&&b.length===2&&a[0]?.toLowerCase()===b[0]?.toLowerCase()&&a[1]===b[1] : a[0]?.toLowerCase()===b[0]?.toLowerCase();
}
export function normalizeCandidates(response, requestedNames) {
  const names=[...new Set((Array.isArray(requestedNames)?requestedNames:[]).filter(x=>typeof x==='string'&&x.trim()).map(x=>x.trim()))];
  const rows=Array.isArray(response?.results)?response.results:[];
  return names.map(name=>{
    const matchingRows=rows.filter(x=>x?.name===name);
    return {name,sources:MEDIA.map(media=>{
      const sources=matchingRows.map(row=>row?.sources?.[media]).filter(Boolean);
      const statuses=sources.map(source=>STATES.includes(source?.status)?source.status:'not_fetched');
      // Never let a later incomplete response erase a known restriction or failure.
      const state=statuses.includes('restricted')?'restricted':statuses.includes('error')?'error':
        statuses.includes('partial')?'partial':statuses.includes('found')?'found':
        statuses.includes('not_fetched')?'not_fetched':statuses.includes('not_found')?'not_found':'not_fetched';
      const candidates=[];
      let evidenceTruncated=false;
      const candidateGroups=sources.map(source=>Array.isArray(source.candidates)?source.candidates:[]);
      const truncated=candidateGroups.some(group=>group.length>100)||candidateGroups.reduce((n,group)=>n+Math.min(group.length,100),0)>200;
      const rawCandidates=candidateGroups.flatMap(group=>group.slice(0,100)).slice(0,200);
      for(const c of rawCandidates){
        if(c?.discovered!==true||!Array.isArray(c.evidence))continue;
        if(c.evidence.length>100)evidenceTruncated=true;
        const url=validUrl(c.url,media);
        if(!url)continue;
        const existing=candidates.find(x=>x.url===url);
        const evidence=existing?.evidence||[],seen=new Set(evidence.map(e=>e.url));
        let verifiedForThisRow=false;
        for(const e of c.evidence.slice(0,100)){
          if(e?.verified!==true)continue;
          const link=validUrl(e.url,media,true);
          if(!link||!belongsToCandidate(url,link,media))continue;
          // If upstream supplies a video owner's profile, never accept a
          // contradictory owner as proof for this YouTube channel.
          if(media==='youtube'&&typeof e.channelUrl==='string'&&
            validUrl(e.channelUrl,'youtube')!==url)continue;
          // Even at the storage cap, a later verified row may supply DBD
          // relevance. Never store a thirteenth evidence item.
          verifiedForThisRow=true;
          // Keep validating later evidence for this row even when storage is full.
          // Only the stored evidence list is capped, not the bounded verification scan.
          if(evidence.length>=12||seen.has(link))continue;
          seen.add(link);
          evidence.push({url:link,kind:media==='5ch'?'thread':e.kind==='post'?'post':e.kind==='video'?'video':'profile',excerpt:typeof e.excerpt==='string'?e.excerpt.slice(0,media==='5ch'?2048:280):''});
        }
        if(!evidence.length)continue;
        if(existing){existing.dbdRelated ||= verifiedForThisRow&&c.dbdRelated===true;continue;}
        candidates.push({url,evidence,dbdRelated:c.dbdRelated===true,identityConfirmed:false});
      }
      return {media,status:candidates.length?(state==='partial'||state==='restricted'||state==='error'||(truncated||evidenceTruncated||statuses.includes('not_fetched')||statuses.includes('not_found')||!statuses.includes('found'))?'partial':'found'):((truncated||evidenceTruncated)?'partial':state==='found'?'not_fetched':state),candidates};
    })};
  });
}

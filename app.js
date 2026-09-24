"use strict";
// ════════════════════════════════════════════════════════════
// Season War Room — waivers and trades.
// Every recommendation is scored against YOUR roster: an add is only worth what
// it improves over the player you would cut, and a trade only shows if it
// lifts your starting lineup without gutting theirs.
// ════════════════════════════════════════════════════════════
var D=null,LG=null,MYID=null,THEME='dark',TSCALE=1,WEEK=1;
var POSN=['QB','RB','WR','TE'],FLEXOK=['RB','WR','TE'];
var ESPNPOS={1:'QB',2:'RB',3:'WR',4:'TE',5:'K',16:'DST'};
var COLSETS={dark:{QB:'#c06a7d',RB:'#5b91c4',WR:'#4aa691',TE:'#c08a4d',K:'#888',DST:'#9179b8'},
  slate:{QB:'#f5788d',RB:'#6aa9ff',WR:'#3fd6ad',TE:'#ff9f45',K:'#888',DST:'#b18cff'},
  ember:{QB:'#f07a86',RB:'#69a5d8',WR:'#4fc9a4',TE:'#ffab52',K:'#888',DST:'#b394e6'},
  paper:{QB:'#9e3247',RB:'#1f5688',WR:'#146353',TE:'#8a4d0b',K:'#777',DST:'#573f80'}};
var COL=COLSETS.dark;
var THEMEMETA=[['dark','Dark',['#0c0c0c','#242424','#e0a832','#f0f0f0']],
  ['slate','Slate',['#0a0a0c','#22222a','#ffb638','#f6f6f9']],
  ['ember','Ember',['#0d0a08','#28211c','#ff9d3d','#f7f1ea']],
  ['paper','Paper',['#e8e6e0','#f4f2ec','#a35c07','#17171a']]];
var INFO={
 needs:"<p>Your starting strength at each position against the league-average starter. Negative is where you're losing points to the rest of the league &mdash; and where a waiver add or trade does the most good.</p>",
 adds:"<p>Every free agent is tested against <b>your</b> roster: add him, drop whoever costs you least, and measure how much your best starting lineup improves over the next four weeks.</p><p>That's the only honest waiver metric. A good player who wouldn't crack your lineup is worth far less to you than a lesser one who fills a hole.</p><p>Kickers and defences are never suggested as drops.</p>",
 rising:"<p>Players whose <b>role</b> is growing faster than their points: target share up, touches up, beating their projection. By the time the box score catches up, someone else has claimed him.</p><p>Ranked on movement, not level, so a quarterback who simply plays every snap doesn't clog the list.</p>",
 trades:"<p>Every 1-for-1, 2-for-1 and 1-for-2 swap with every team, scored by how each side's best starting lineup changes over the next four weeks.</p><p>A deal only appears if it helps you <b>and</b> doesn't clearly hurt them &mdash; the ones they might actually accept. Teams with losing records are flagged as motivated.</p><p>It doesn't know about injuries you expect to heal or players someone won't part with. It tells you who to call.</p>",
 standings:"<p>Record and points scored, straight from ESPN. A team with a losing record and a hole at a position you're deep at is your best trade partner.</p>",
 moves:"<p>Adds and trades from ESPN's acquisition records, plus drops worked out by comparing each load against the last one you saw.</p><p>Watch for a team adding at a position repeatedly &mdash; they're telling you what they need.</p>",
 heat:"<p>Each team's starting strength by position against the league average. Green is surplus, red is a hole. A column of red means the whole league is short there, which raises the price of anyone who can play it.</p>",
 pva:"<p>Season points against the projection recorded <b>before</b> each week. Projections are never rewritten afterwards, so this is a genuine score, not hindsight.</p><p>A rostered player well above projection may be a sell-high; one well below on steady usage may be a buy-low.</p>",
 paste:"<p>ESPN's league data sits at a URL that only works when you're logged in. Your browser is, so it opens for you &mdash; while an automated server often gets refused.</p><p>Pasting it in keeps everything on your device. Nothing is sent anywhere.</p>"};

function esc(s){return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;');}
var ALIAS={'hollywood brown':'marquise brown','tank dell':'nathaniel dell','cam ward':'cameron ward','chig okonkwo':'chigoziem okonkwo'};
function pkey(n){n=(n||'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'');
  n=n.toLowerCase().replace(/\./g,'').replace(/'/g,'').replace(/-/g,' ');
  n=n.replace(/\b(jr|sr|ii|iii|iv|v)\b/g,'').replace(/\s+/g,' ').trim();return ALIAS[n]||n;}
function isInactive(p){return p&&(p.st==='CUT'||p.st==='RET'||p.st==='RES');}
function projFor(k,wk){var w=String(wk);
  if(D.hist&&D.hist[w]&&D.hist[w][k]!==undefined)return D.hist[w][k];
  if(D.proj&&D.proj[w]&&D.proj[w][k]!==undefined)return D.proj[w][k];return null;}
function actualFor(k,wk){var w=String(wk);return (D.actual&&D.actual[w]&&D.actual[w][k]!==undefined)?D.actual[w][k]:null;}

// Value over the next four weeks. A bye counts as zero because it scores zero.
var VCACHE={};
function val(k){
  if(VCACHE[k]!==undefined)return VCACHE[k];
  var sum=0,seen=0,n=0;
  for(var w=WEEK;w<WEEK+4;w++){
    if(!D.proj||!D.proj[String(w)])continue;
    n++;
    var v=projFor(k,w);
    if(v!==null){sum+=v;seen++;}
  }
  var out=(!n||!seen)?null:sum/n;
  VCACHE[k]=out;return out;
}
// Best starting lineup from a set of player keys: QB, 2 RB, 2 WR, TE, 2 FLEX.
function lineupValue(keys){
  var by={QB:[],RB:[],WR:[],TE:[]};
  for(var i=0;i<keys.length;i++){var p=D.players[keys[i]];if(!p||!by[p.pos])continue;
    var v=val(keys[i]);if(v!==null)by[p.pos].push(v);}
  for(var q in by)by[q].sort(function(a,b){return b-a;});
  var t=(by.QB[0]||0)+(by.RB[0]||0)+(by.RB[1]||0)+(by.WR[0]||0)+(by.WR[1]||0)+(by.TE[0]||0);
  var fl=by.RB.slice(2).concat(by.WR.slice(2),by.TE.slice(1)).sort(function(a,b){return b-a;});
  return t+(fl[0]||0)+(fl[1]||0);
}

// ── league: one parser for ESPN's shape, whether it came from the pipeline or a paste ──
function parseESPN(raw){
  if(!raw||!raw.teams||!raw.teams.length)return null;
  var teams=raw.teams.map(function(t){
    var nm=t.name||((t.location||'')+' '+(t.nickname||'')).trim()||t.abbrev||('Team '+t.id);
    var rec=(t.record&&t.record.overall)||{};
    var roster=((t.roster&&t.roster.entries)||[]).map(function(e){
      var pl=(e.playerPoolEntry&&e.playerPoolEntry.player)||{};
      var own=pl.ownership||{};
      return {name:pl.fullName||'',k:pkey(pl.fullName||''),pos:ESPNPOS[pl.defaultPositionId]||'?',
        acq:e.acquisitionType||'',acqDate:e.acquisitionDate||0,slot:e.lineupSlotId,
        inj:pl.injuryStatus&&pl.injuryStatus!=='ACTIVE'?pl.injuryStatus:'',
        own:own.percentOwned,ownChg:own.percentChange};
    }).filter(function(r){return r.name;});
    return {id:t.id,name:nm,wins:rec.wins||0,losses:rec.losses||0,ties:rec.ties||0,
            pf:rec.pointsFor||0,hasRecord:rec.wins!==undefined,roster:roster,owners:t.owners||[]};
  });
  return {teams:teams,myTeamId:raw.myTeamId!=null?raw.myTeamId:null,fetched:raw.fetched||null};
}
function parseCSV(txt){
  var lines=txt.trim().split(/\r?\n/);if(lines.length<2)return null;
  var head=lines[0].toLowerCase();if(head.indexOf('player')<0||head.indexOf('team')<0)return null;
  var cols=head.split(','),iT=cols.indexOf('team'),iP=cols.indexOf('player'),iS=cols.indexOf('pos'),by={};
  for(var i=1;i<lines.length;i++){var f=lines[i].match(/("([^"]*)"|[^,]*)/g);if(!f)continue;
    f=f.filter(function(x,ix){return ix%2===0;}).map(function(x){return x.replace(/^"|"$/g,'').trim();});
    if(!f[iT]||!f[iP])continue;
    (by[f[iT]]=by[f[iT]]||[]).push({name:f[iP],k:pkey(f[iP]),pos:f[iS]||'?',acq:'DRAFT'});}
  var names=Object.keys(by);if(!names.length)return null;
  return {teams:names.map(function(n,i){return {id:i+1,name:n,roster:by[n],hasRecord:false,wins:0,losses:0,pf:0};}),
          myTeamId:null,fetched:null};
}
function teamById(id){if(!LG)return null;for(var i=0;i<LG.teams.length;i++)if(LG.teams[i].id===id)return LG.teams[i];return null;}
function myTeam(){return teamById(MYID);}
function keysOf(t){return t?t.roster.map(function(r){return r.k;}).filter(function(k){return D.players[k];}):[];}
function rosteredSet(){var s={};if(LG)LG.teams.forEach(function(t){t.roster.forEach(function(r){s[r.k]=t;});});return s;}

// ── needs ──────────────────────────────────────────────────
function starterByPos(keys){
  var by={QB:[],RB:[],WR:[],TE:[]};
  keys.forEach(function(k){var p=D.players[k];if(!p||!by[p.pos])return;var v=val(k);if(v!==null)by[p.pos].push(v);});
  var need={QB:1,RB:2,WR:2,TE:1},out={};
  POSN.forEach(function(pos){by[pos].sort(function(a,b){return b-a;});
    var s=0;for(var i=0;i<need[pos];i++)s+=by[pos][i]||0;out[pos]=s;});
  return out;
}
function leagueAvg(){
  var a={QB:0,RB:0,WR:0,TE:0},n=0;
  if(!LG)return a;
  LG.teams.forEach(function(t){var s=starterByPos(keysOf(t));n++;POSN.forEach(function(p){a[p]+=s[p];});});
  if(n)POSN.forEach(function(p){a[p]/=n;});
  return a;
}
function drawNeeds(){
  var host=document.getElementById('needs'),t=myTeam();
  if(!t){host.innerHTML='<div class="empty">Load your league and pick your team in Setup.</div>';return;}
  var mine=starterByPos(keysOf(t)),avg=leagueAvg();
  host.innerHTML=POSN.map(function(p){
    var d=mine[p]-avg[p],bad=d<-1.5,good=d>1.5;
    return '<div class="need" style="border-top-color:'+(bad?'var(--urg)':good?'var(--ok)':'var(--ln2)')+'">'+
      '<div class="nl" style="color:'+COL[p]+'">'+p+'</div>'+
      '<div class="nv" style="color:'+(bad?'var(--urg)':good?'var(--ok)':'var(--tx)')+'">'+(d>=0?'+':'')+d.toFixed(1)+'</div>'+
      '<div class="ns">'+(bad?'short':good?'surplus':'on par')+'</div></div>';
  }).join('');
}

// ── waivers: every add scored as a swap against YOUR roster ─
function drawAdds(){
  var host=document.getElementById('adds'),cx=document.getElementById('addsCx'),t=myTeam();
  if(!t){host.innerHTML='<div class="empty">Load your league in Setup to see moves for your roster.</div>';cx.textContent='';return;}
  var mine=keysOf(t),base=lineupValue(mine),taken=rosteredSet();
  // never suggest cutting a kicker, defence, or someone the data can't see
  var droppable=t.roster.filter(function(r){return D.players[r.k]&&r.pos!=='K'&&r.pos!=='DST';}).map(function(r){return r.k;});
  var rows=[];
  Object.keys(D.players).forEach(function(k){
    if(taken[k])return;
    var p=D.players[k];if(isInactive(p)||POSN.indexOf(p.pos)<0)return;
    var v=val(k);if(v===null||v<2)return;
    // A second QB or TE never scores in a one-QB, one-TE lineup with no
    // superflex, so depth there is worth nothing. RB and WR depth can reach
    // the lineup through the flex or an injury, so it counts - at a discount.
    var depthW=(p.pos==='RB'||p.pos==='WR')?0.35:0;
    var injW=p.inj?({Out:.3,Doubtful:.5,Questionable:.85}[p.inj[0]]||1):1;
    var best=null;
    droppable.forEach(function(d){
      var set=mine.filter(function(x){return x!==d;});set.push(k);
      var lg=(lineupValue(set)-base)*injW;
      var dv=val(d)||0;
      var score=lg+depthW*(v-dv);
      if(!best||score>best.score)best={d:d,lg:lg,score:score,dv:dv};
    });
    if(best&&best.score>0.4)rows.push({k:k,p:p,v:v,best:best});
  });
  rows.sort(function(a,b){return b.best.score-a.best.score;});
  cx.textContent=rows.length?rows.length+' worth a look':'';
  if(!rows.length){host.innerHTML='<div class="empty">Nobody on waivers improves your roster right now. That\'s a good sign.</div>';return;}
  var top=rows.slice(0,12);
  // Usually one player is your obvious cut. Say that once instead of on every row.
  var freq={};top.forEach(function(r){freq[r.best.d]=(freq[r.best.d]||0)+1;});
  var common=Object.keys(freq).sort(function(a,b){return freq[b]-freq[a];})[0];
  var commonP=D.players[common],shared=freq[common]>=Math.ceil(top.length*.6);
  var head=shared?'<div class="stat" style="background:var(--s2)"><span class="dot" style="background:var(--urg)"></span><div>'+
    'Your weakest spot is <b>'+esc(commonP?commonP.name:common)+'</b> ('+(val(common)||0).toFixed(1)+' a week). '+
    'Most of these replace him.</div></div>':'';
  host.innerHTML=head+top.map(function(r){
    var dp=D.players[r.best.d],cur=r.p.r||r.p.s,why=[];
    if(r.best.lg>0.3)why.push('lifts your starting lineup <b>+'+r.best.lg.toFixed(1)+'</b> a week');
    else why.push('bench depth that can reach your flex');
    if(r.p.d===1)why.push('<b>'+r.p.pos+'1</b> on his depth chart');
    if(cur&&cur[5]>=18)why.push('<b>'+cur[5].toFixed(0)+'%</b> target share');
    else if(cur&&cur[3]>=12)why.push('<b>'+cur[3].toFixed(1)+'</b> touches a game');
    if(r.p.inj)why.push('<span style="color:var(--ac)">'+esc(r.p.inj[0])+' &mdash; discounted</span>');
    var showDrop=!shared||r.best.d!==common;
    return '<div class="swap" style="border-left-color:'+COL[r.p.pos]+'">'+
      '<div class="swapm"><div class="swapin">+ '+esc(r.p.name)+' <span style="font-size:10px;color:var(--dimr);font-weight:400">'+r.p.pos+' '+r.p.team+'</span></div>'+
      (showDrop?'<div class="swapout">&minus; '+esc(dp?dp.name:r.best.d)+' <span style="font-family:var(--fm)">('+r.best.dv.toFixed(1)+')</span></div>':'')+
      '<div class="swapwhy">'+why.slice(0,3).join(' &middot; ')+'</div></div>'+
      '<span class="gain">'+(r.best.lg>=0.05?'+'+r.best.lg.toFixed(1):'depth')+'<span class="gainu">'+(r.best.lg>=0.05?'lineup/wk':'')+'</span></span></div>';
  }).join('');
}

// Rising role: rank on movement that LEADS scoring, not on level.
function risingScore(k){
  var p=D.players[k],cur=p.r||p.s,base=p.b;if(!cur)return null;
  var dTgt=base?((cur[5]||0)-(base[5]||0)):0,dTch=base?((cur[3]||0)-(base[3]||0)):0;
  var pv=pvaFor(k),beat=pv?Math.max(-8,Math.min(12,pv.diff)):0;
  if(!(Math.abs(dTgt)>=2||Math.abs(dTch)>=1||(pv&&Math.abs(pv.diff)>=3)))return null;
  var lead=dTgt*2.2+dTch*2.6+beat;if(lead<=0)return null;
  return {score:lead*(p.d===1?1.15:(p.d===2?1:0.85)),dTgt:dTgt,dTch:dTch,beat:pv?pv.diff:null};
}
function drawRising(){
  var host=document.getElementById('rising'),taken=rosteredSet(),rows=[];
  Object.keys(D.players).forEach(function(k){
    if(LG&&taken[k])return;
    var p=D.players[k];if(isInactive(p)||POSN.indexOf(p.pos)<0)return;
    var v=val(k);if(v===null||v<3)return;          // a growing role that still projects to nothing isn't a claim
    var r=risingScore(k);if(r)rows.push({k:k,p:p,r:r});});
  if(!rows.length){host.innerHTML='<div class="empty">No growing roles among free agents this week.</div>';return;}
  rows.sort(function(a,b){return b.r.score-a.r.score;});
  host.innerHTML=rows.slice(0,10).map(function(x){
    var s=[];
    if(x.r.dTgt>=2)s.push('target share <b>+'+x.r.dTgt.toFixed(0)+'</b>');
    if(x.r.dTch>=1)s.push('touches <b>+'+x.r.dTch.toFixed(1)+'</b>');
    if(x.r.beat!==null&&x.r.beat>2)s.push('<b>+'+x.r.beat.toFixed(1)+'</b> over projection');
    var v=val(x.k);
    return '<div class="swap" style="border-left-color:'+COL[x.p.pos]+'"><div class="swapm">'+
      '<div class="swapin">'+esc(x.p.name)+' <span style="font-size:10px;color:var(--dimr);font-weight:400">'+
      x.p.pos+(x.p.d||'')+' '+x.p.team+'</span></div>'+
      '<div class="swapwhy">'+s.join(' &middot; ')+'</div></div>'+
      '<span class="gain" style="color:var(--tx)">'+(v===null?'—':v.toFixed(1))+'<span class="gainu">proj/wk</span></span></div>';
  }).join('');
}

// ── trades: every 1-for-1, 2-for-1 and 1-for-2, scored for both sides ─
var TRADECACHE={key:null,deals:null};
function topAssets(keys,n){
  return keys.filter(function(k){return (val(k)||0)>=2.5;})
    .sort(function(a,b){return (val(b)||0)-(val(a)||0);}).slice(0,n);
}
function sumVal(ks){var s=0;ks.forEach(function(k){s+=val(k)||0;});return s;}
function drawTrades(){
  var host=document.getElementById('deals'),cx=document.getElementById('tradeCx'),t=myTeam();
  if(!t||!LG||LG.teams.length<2){host.innerHTML='<div class="empty">Load your league in Setup.</div>';cx.textContent='';return;}
  // The search is the most expensive thing in the app; do it once per league load.
  var ck=[LG.fetched,LG.source,MYID,WEEK].join('|');
  if(TRADECACHE.key===ck){renderDeals(TRADECACHE.deals);return;}
  var mineAll=keysOf(t),myBase=lineupValue(mineAll);
  var myAssets=topAssets(mineAll,11);
  var deals=[];
  LG.teams.forEach(function(o){
    if(o.id===t.id)return;
    var theirs=keysOf(o),thBase=lineupValue(theirs);
    var thAssets=topAssets(theirs,11);
    function test(give,get){
      // People judge a trade by what changes hands, not by lineup maths. Two
      // starters for a backup can lift both lineups on paper and still never
      // be accepted, so cap how much more raw value you can take than you give.
      var gv=sumVal(give),rv=sumVal(get);
      if(gv<=0||rv>gv*1.3)return;
      var m=mineAll.filter(function(k){return give.indexOf(k)<0;}).concat(get);
      var h=theirs.filter(function(k){return get.indexOf(k)<0;}).concat(give);
      var mg=lineupValue(m)-myBase,tg=lineupValue(h)-thBase;
      if(mg>=0.8&&tg>=-0.3)deals.push({o:o,give:give,get:get,mg:mg,tg:tg,score:mg+0.6*Math.min(tg,3)});
    }
    var i,j,a;
    for(i=0;i<myAssets.length;i++)for(j=0;j<thAssets.length;j++)test([myAssets[i]],[thAssets[j]]);
    for(i=0;i<myAssets.length;i++)for(a=i+1;a<myAssets.length;a++)
      for(j=0;j<thAssets.length;j++)test([myAssets[i],myAssets[a]],[thAssets[j]]);
    for(j=0;j<thAssets.length;j++)for(a=j+1;a<thAssets.length;a++)
      for(i=0;i<myAssets.length;i++)test([myAssets[i]],[thAssets[j],thAssets[a]]);
  });
  deals.sort(function(a,b){return b.score-a.score;});
  TRADECACHE={key:ck,deals:deals};
  renderDeals(deals);
}
function renderDeals(deals){
  var host=document.getElementById('deals'),cx=document.getElementById('tradeCx');
  // variety: at most two deals per partner
  var per={},shown=[];
  deals.forEach(function(d){per[d.o.id]=(per[d.o.id]||0)+1;if(per[d.o.id]<=2&&shown.length<12)shown.push(d);});
  cx.textContent=deals.length?deals.length+' found':'';
  if(!shown.length){host.innerHTML='<div class="empty">No swap improves your lineup without costing the other side. '+
    'Check back after waivers &mdash; needs shift every week.</div>';return;}
  function names(ks){return ks.map(function(k){var p=D.players[k];
    return esc(p.name)+' <span style="font-size:9.5px;color:'+COL[p.pos]+'">'+p.pos+'</span>';}).join('<br>');}
  host.innerHTML=shown.map(function(d){
    var motivated=d.o.hasRecord&&d.o.losses>d.o.wins;
    return '<div class="deal"><div class="dealh"><span class="dealt">with '+esc(d.o.name)+'</span>'+
      '<span class="dealrec">'+(d.o.hasRecord?d.o.wins+'-'+d.o.losses:'')+(motivated?' &middot; motivated':'')+'</span></div>'+
      '<div class="dealsides"><div class="side"><div class="sl">You give</div><div class="sp">'+names(d.give)+'</div></div>'+
      '<span class="arrow">&harr;</span>'+
      '<div class="side"><div class="sl">You get</div><div class="sp">'+names(d.get)+'</div></div></div>'+
      '<div class="dealnums"><span>you <b class="up">+'+d.mg.toFixed(1)+'</b>/wk</span>'+
      '<span>them <b class="'+(d.tg>=0?'up':'dn')+'">'+(d.tg>=0?'+':'')+d.tg.toFixed(1)+'</b>/wk</span></div></div>';
  }).join('');
}

// ── league ─────────────────────────────────────────────────
function drawStandings(){
  var host=document.getElementById('standings'),card=document.getElementById('standCard');
  if(!LG||!LG.teams.some(function(t){return t.hasRecord;})){card.hidden=true;return;}
  card.hidden=false;
  var ts=LG.teams.slice().sort(function(a,b){return (b.wins-a.wins)||(b.pf-a.pf);});
  host.innerHTML=ts.map(function(t,i){
    return '<div class="std'+(t.id===MYID?' mine':'')+'"><span class="stdr">'+(i+1)+'</span>'+
      '<span class="stdn">'+esc(t.name)+'</span><span class="stdw">'+t.wins+'-'+t.losses+(t.ties?'-'+t.ties:'')+'</span>'+
      '<span class="stdp">'+t.pf.toFixed(1)+'</span></div>';}).join('');
}
function drawMoves(){
  var host=document.getElementById('moves');
  if(!LG){host.innerHTML='<div class="empty">Load your league in Setup.</div>';return;}
  var mv=[];
  LG.teams.forEach(function(t){t.roster.forEach(function(r){
    if(r.acq&&r.acq!=='DRAFT'&&r.acqDate)mv.push({type:r.acq==='TRADE'?'TRADE':'ADD',name:r.name,pos:r.pos,team:t.name,when:r.acqDate});});});
  (LG.drops||[]).forEach(function(d){mv.push({type:'DROP',name:d.name,pos:d.pos,team:d.team,when:d.when});});
  if(!mv.length){host.innerHTML='<div class="empty">No moves since the draft'+
    (LG.fetched||LG.teams.some(function(t){return t.hasRecord;})?'.':' &mdash; the draft CSV has no move history. Load from ESPN to see them.')+'</div>';return;}
  mv.sort(function(a,b){return b.when-a.when;});
  var col={ADD:'var(--ok)',TRADE:'var(--ac)',DROP:'var(--urg)'};
  host.innerHTML=mv.slice(0,25).map(function(m){
    var d=new Date(m.when);
    return '<div class="mv"><span class="mvt" style="color:'+col[m.type]+'">'+m.type+'</span>'+
      '<span class="mvn">'+esc(m.name)+' <span style="font-size:9.5px;color:'+(COL[m.pos]||'var(--dimr)')+'">'+m.pos+'</span></span>'+
      '<span class="mvm">'+esc(m.team)+' &middot; '+(isNaN(d)?'':(d.getMonth()+1)+'/'+d.getDate())+'</span></div>';}).join('');
}
function drawHeat(){
  var host=document.getElementById('heat');
  if(!LG){host.innerHTML='<div class="empty">Load your league in Setup.</div>';return;}
  var avg=leagueAvg(),cells=LG.teams.map(function(t){var s=starterByPos(keysOf(t));
    return {t:t,v:POSN.map(function(p){return s[p]-avg[p];})};}),mx=1;
  cells.forEach(function(c){c.v.forEach(function(x){mx=Math.max(mx,Math.abs(x));});});
  host.innerHTML='<div class="hrow hhead"><span class="hlab"></span>'+
    POSN.map(function(p){return '<span class="hc" style="color:'+COL[p]+'">'+p+'</span>';}).join('')+'</div>'+
    cells.map(function(c){return '<div class="hrow'+(c.t.id===MYID?' mine':'')+'"><span class="hlab">'+esc(c.t.name)+'</span>'+
      c.v.map(function(x){var a=Math.min(.8,Math.abs(x)/mx*.8);
        return '<span class="hc" style="background:'+(x>=0?'rgba(90,168,122,':'rgba(217,83,79,')+a+')">'+(x>=0?'+':'')+x.toFixed(1)+'</span>';
      }).join('')+'</div>';}).join('');
}
function pvaFor(k){var pr=0,ac=0,n=0;
  (D.meta.played||[]).forEach(function(w){var a=actualFor(k,w);if(a===null)return;var p=projFor(k,w);if(p===null)return;pr+=p;ac+=a;n++;});
  return n?{proj:pr,act:ac,n:n,diff:ac-pr}:null;}
function drawPvA(){
  var host=document.getElementById('pva'),taken=rosteredSet(),rows=[];
  if(!LG){host.innerHTML='<div class="empty">Load your league in Setup.</div>';return;}
  Object.keys(taken).forEach(function(k){var p=D.players[k];if(!p)return;var pv=pvaFor(k);if(pv)rows.push({p:p,pv:pv,t:taken[k]});});
  if(!rows.length){host.innerHTML='<div class="empty">No completed weeks with a stored projection yet.</div>';return;}
  rows.sort(function(a,b){return b.pv.diff-a.pv.diff;});
  function blk(list,title,good){return '<div class="bwh">'+title+'</div>'+list.map(function(r){
    return '<div class="mv"><span class="mvt" style="color:'+(good?'var(--ok)':'var(--urg)')+';width:48px;font-family:var(--fm);font-size:11px">'+
      (r.pv.diff>=0?'+':'')+r.pv.diff.toFixed(1)+'</span><span class="mvn">'+esc(r.p.name)+
      ' <span style="font-size:9.5px;color:'+COL[r.p.pos]+'">'+r.p.pos+'</span></span>'+
      '<span class="mvm">'+esc(r.t.name)+'</span></div>';}).join('');}
  host.innerHTML=blk(rows.slice(0,8),'Beating projection — sell-high candidates',true)+
    blk(rows.slice(-6).reverse(),'Below projection — buy-low if the role holds',false);
}

// ── loading: freshest ESPN source wins, draft CSV is the last resort ──
function ls(k,v){try{if(v===undefined)return localStorage.getItem(k);if(v===null)localStorage.removeItem(k);else localStorage.setItem(k,v);}catch(e){return null;}}
function chooseLeague(){
  var pasted=null,pipe=null,csv=null;
  try{var p=JSON.parse(ls('swrespn')||'null');if(p&&p.raw){pasted=parseESPN(p.raw);if(pasted){pasted.fetched=p.at;pasted.source='pasted';}}}catch(e){}
  if(D.league&&D.league.teams){pipe=parseESPN(D.league);if(pipe)pipe.source='auto';}
  try{var c=ls('swrcsv');if(c){csv=parseCSV(c);if(csv)csv.source='csv';}}catch(e){}
  var pick=null;
  if(pasted&&pipe)pick=(new Date(pasted.fetched)>=new Date(pipe.fetched))?pasted:pipe;
  else pick=pasted||pipe||csv;
  return pick;
}
// Drops can't be seen in a single snapshot, so compare against the last one
// this device loaded. Anyone who vanished from every roster was dropped.
function trackDrops(lg){
  if(!lg||lg.source==='csv')return;
  var now={},onAny={};
  lg.teams.forEach(function(t){now[t.id]={name:t.name,r:{}};t.roster.forEach(function(r){now[t.id].r[r.k]={name:r.name,pos:r.pos};onAny[r.k]=1;});});
  var prev=null;try{prev=JSON.parse(ls('swrsnap')||'null');}catch(e){}
  var drops=[];try{drops=JSON.parse(ls('swrdrops')||'[]');}catch(e){}
  var stamp=lg.fetched?new Date(lg.fetched).getTime():Date.now();
  if(prev&&prev.at!==stamp&&prev.teams){
    Object.keys(prev.teams).forEach(function(id){var pt=prev.teams[id];
      Object.keys(pt.r).forEach(function(k){
        if(!onAny[k]&&!drops.some(function(d){return d.k===k&&d.team===pt.name;}))
          drops.push({k:k,name:pt.r[k].name,pos:pt.r[k].pos,team:pt.name,when:stamp});});});
  }
  drops=drops.slice(-40);
  ls('swrdrops',JSON.stringify(drops));
  ls('swrsnap',JSON.stringify({at:stamp,teams:now}));
  lg.drops=drops;
}
function resolveMine(){
  if(!LG)return null;
  var saved=ls('swrmine:'+LG.teams.map(function(t){return t.id;}).join(','));
  if(saved&&teamById(isNaN(+saved)?saved:+saved))return isNaN(+saved)?saved:+saved;
  if(LG.myTeamId!=null&&teamById(LG.myTeamId))return LG.myTeamId;
  var guess=LG.teams.filter(function(t){return /my team/i.test(t.name);})[0];
  return (guess||LG.teams[0]).id;
}
function repoActionsUrl(){
  var h=location.hostname,parts=location.pathname.split('/').filter(Boolean);
  if(!/github\.io$/.test(h)||!parts.length)return null;
  return 'https://github.com/'+h.split('.')[0]+'/'+parts[0]+'/actions';
}

// ── chrome ─────────────────────────────────────────────────
// Kept deliberately short: only things you need to act on get a banner.
function drawBanners(){
  var h='',age=(Date.now()-new Date(D.meta.built).getTime())/86400000,act=repoActionsUrl();
  if(age>4)h+='<div class="banner bad"><b>Stats are '+Math.round(age)+' days old.</b> The scheduled refresh hasn\'t run. '+
    (act?'<a href="'+act+'" target="_blank" rel="noopener">Open Actions</a> and run <i>Refresh season data</i>.':'Run the action by hand.')+'</div>';
  if(!LG)h+='<div class="banner warn">No league loaded yet. <a href="#" data-go="setup">Load it in Setup</a> &mdash; takes a minute.</div>';
  else if(LG.source==='csv')h+='<div class="banner warn">Using draft-day rosters, which miss every trade and pickup since. <a href="#" data-go="setup">Load from ESPN</a>.</div>';
  document.getElementById('banners').innerHTML=h;
  Array.prototype.forEach.call(document.querySelectorAll('[data-go]'),function(a){
    a.addEventListener('click',function(e){e.preventDefault();showTab(a.getAttribute('data-go'));});});
}
function drawHeader(){
  document.getElementById('hWeek').textContent=WEEK;
  var t=myTeam();document.getElementById('hTeam').textContent=t?t.name:'—';
  var s='—';
  if(LG){var d=LG.fetched?new Date(LG.fetched):null,ds=d&&!isNaN(d)?' · '+(d.getMonth()+1)+'/'+d.getDate():'';
    s=LG.source==='auto'?'ESPN auto'+ds:LG.source==='pasted'?'ESPN'+ds:'draft CSV';}
  document.getElementById('hSrc').textContent=s;
}
function drawConn(){
  var host=document.getElementById('connStatus'),rows=[];
  var age=(Date.now()-new Date(D.meta.built).getTime())/86400000,act=repoActionsUrl();
  rows.push([age<=4?'var(--ok)':'var(--urg)','<b>Weekly stats</b> &mdash; built '+new Date(D.meta.built).toLocaleDateString()+
    (age>4?'. Stale. '+(act?'<a href="'+act+'" target="_blank" rel="noopener">Open Actions</a> to see why.':''):'')]);
  var e=D.meta.espn||{status:'not configured',detail:''};
  rows.push([e.status==='connected'?'var(--ok)':'var(--dimr)','<b>ESPN auto-sync</b> &mdash; '+esc(e.status)+
    (e.detail?'<br><span style="color:var(--dimr)">'+esc(e.detail)+'</span>':'')+
    (e.status==='connected'?'':'<br><span style="color:var(--dimr)">Optional. Pasting below works either way.</span>')]);
  var p=null;try{p=JSON.parse(ls('swrespn')||'null');}catch(x){}
  rows.push([p?'var(--ok)':'var(--dimr)','<b>Pasted league</b> &mdash; '+(p?'loaded '+new Date(p.at).toLocaleString():'none yet')]);
  rows.push(['var(--ac)','<b>Using</b> &mdash; '+(LG?(LG.source==='auto'?'ESPN auto-sync':LG.source==='pasted'?'pasted ESPN data':'draft CSV'):'nothing yet')]);
  host.innerHTML=rows.map(function(r){return '<div class="stat"><span class="dot" style="background:'+r[0]+'"></span><div>'+r[1]+'</div></div>';}).join('');
}
function drawMySel(){
  var s=document.getElementById('mySel');
  if(!LG){s.innerHTML='<option>load your league first</option>';return;}
  s.innerHTML=LG.teams.map(function(t){return '<option value="'+esc(t.id)+'"'+(t.id===MYID?' selected':'')+'>'+esc(t.name)+'</option>';}).join('');
}
function drawSrc(){
  document.getElementById('srcInfo').innerHTML='Season <b>'+D.meta.season+'</b>, week <b>'+WEEK+'</b> &middot; weeks played: '+
    ((D.meta.played||[]).join(', ')||'none')+'<br>Values are projected points averaged over the next four weeks, byes as zero.<br>'+
    'Scoring: '+(D.meta.scoring?D.meta.scoring.rec+' per reception, '+D.meta.scoring.int+' per interception':'')+'<br>'+
    (D.meta.warnings||[]).filter(function(w){return w.indexOf('ESPN')<0;}).map(esc).join('<br>');
}
function applyTheme(t){THEME=(['dark','slate','ember','paper'].indexOf(t)>-1)?t:'dark';COL=COLSETS[THEME];
  document.documentElement.setAttribute('data-theme',THEME);ls('swrtheme',THEME);}
function applyScale(s){TSCALE=Math.max(.9,Math.min(1.45,s||1));var b=document.body;
  if(b){if(TSCALE===1)b.style.removeProperty('zoom');else b.style.zoom=TSCALE;}ls('swrscale',String(TSCALE));}
function drawThemes(){var g=document.getElementById('thGrid');g.innerHTML='';
  THEMEMETA.forEach(function(m){var b=document.createElement('button');b.className='thb'+(THEME===m[0]?' on':'');
    b.innerHTML='<span class="thsw">'+m[2].map(function(x){return '<span style="background:'+x+'"></span>';}).join('')+'</span><span class="thn">'+m[1]+'</span>';
    b.addEventListener('click',function(){applyTheme(m[0]);drawThemes();redraw();});g.appendChild(b);});
  Array.prototype.forEach.call(document.querySelectorAll('[data-sz]'),function(b){
    b.className=(Math.abs(parseFloat(b.getAttribute('data-sz'))-TSCALE)<.01)?'on':'';});}
function showTab(n){
  Array.prototype.forEach.call(document.querySelectorAll('.tab'),function(x){
    if(x.getAttribute('data-t')===n)x.classList.add('on');else x.classList.remove('on');});
  Array.prototype.forEach.call(document.querySelectorAll('.panel'),function(p){p.hidden=true;});
  var el=document.getElementById('p-'+n);if(el)el.hidden=false;window.scrollTo(0,0);
}

// ── boot ───────────────────────────────────────────────────
function loadLeague(){LG=chooseLeague();trackDrops(LG);MYID=resolveMine();TRADECACHE={key:null,deals:null};}
function redraw(){
  VCACHE={};
  drawBanners();drawHeader();drawNeeds();drawAdds();drawRising();drawTrades();
  drawStandings();drawMoves();drawHeat();drawPvA();drawConn();drawMySel();drawSrc();
}
function boot(){
  applyTheme(ls('swrtheme')||'dark');applyScale(parseFloat(ls('swrscale'))||1);
  fetch('./data.json',{cache:'no-store'}).then(function(r){if(!r.ok)throw new Error('HTTP '+r.status);return r.json();})
    .then(function(j){D=j;WEEK=D.meta.week||1;loadLeague();drawThemes();wire();redraw();})
    .catch(function(e){document.getElementById('banners').innerHTML='<div class="banner bad"><b>Could not load data.json.</b> '+
      esc(String(e.message||e))+'</div>';});
}
function wire(){
  Array.prototype.forEach.call(document.querySelectorAll('.tab'),function(t){
    t.addEventListener('click',function(){showTab(t.getAttribute('data-t'));});});
  var lid=document.getElementById('lid');lid.value=ls('swrlid')||'';
  document.getElementById('openEspn').addEventListener('click',function(){
    var id=(lid.value||'').replace(/\D/g,'');
    if(!id){document.getElementById('espnMsg').textContent='Enter your league ID first.';return;}
    ls('swrlid',id);
    window.open('https://lm-api-reads.fantasy.espn.com/apis/v3/games/ffl/seasons/'+D.meta.season+
      '/segments/0/leagues/'+id+'?view=mTeam&view=mRoster&view=mMatchupScore&view=mSettings','_blank','noopener');
  });
  document.getElementById('espnLoad').addEventListener('click',function(){
    var m=document.getElementById('espnMsg'),raw;
    try{raw=JSON.parse(document.getElementById('espnBox').value);}
    catch(e){m.textContent='That isn\'t the league data page. Make sure you copied the whole page.';return;}
    if(raw&&raw.messages&&!raw.teams){m.textContent='ESPN refused: '+String(raw.messages[0]||'not logged in')+'. Log in to ESPN in this browser and try again.';return;}
    var lg=parseESPN(raw);
    if(!lg){m.textContent='No teams in that data — check the league ID and that you\'re logged in.';return;}
    var slim={teams:raw.teams.map(function(t){return {id:t.id,name:t.name,location:t.location,nickname:t.nickname,abbrev:t.abbrev,
      owners:t.owners,record:t.record,roster:{entries:((t.roster&&t.roster.entries)||[]).map(function(e){
        var pl=(e.playerPoolEntry&&e.playerPoolEntry.player)||{};
        return {acquisitionType:e.acquisitionType,acquisitionDate:e.acquisitionDate,lineupSlotId:e.lineupSlotId,
          playerPoolEntry:{player:{fullName:pl.fullName,defaultPositionId:pl.defaultPositionId,injuryStatus:pl.injuryStatus,ownership:pl.ownership}}};})}};})};
    ls('swrespn',JSON.stringify({at:new Date().toISOString(),raw:slim}));
    document.getElementById('espnBox').value='';
    loadLeague();redraw();
    var n=0,miss=0;LG.teams.forEach(function(t){t.roster.forEach(function(r){if(r.pos==='K'||r.pos==='DST')return;n++;if(!D.players[r.k])miss++;});});
    m.textContent='Loaded '+LG.teams.length+' teams. '+(n-miss)+' of '+n+' skill players matched to stats.';
  });
  document.getElementById('csvLoad').addEventListener('click',function(){
    var v=document.getElementById('csvBox').value;
    if(!parseCSV(v)){alert('That doesn\'t look like the draft app CSV.');return;}
    ls('swrcsv',v);loadLeague();redraw();});
  document.getElementById('mySel').addEventListener('change',function(e){
    var v=e.target.value;MYID=isNaN(+v)?v:+v;
    ls('swrmine:'+LG.teams.map(function(t){return t.id;}).join(','),String(MYID));redraw();});
  Array.prototype.forEach.call(document.querySelectorAll('[data-sz]'),function(b){
    b.addEventListener('click',function(){applyScale(parseFloat(b.getAttribute('data-sz')));drawThemes();});});
  var pop=document.getElementById('pop');
  Array.prototype.forEach.call(document.querySelectorAll('.info'),function(b){
    b.addEventListener('click',function(ev){ev.stopPropagation();var k=b.getAttribute('data-info');
      if(pop.classList.contains('on')&&pop.getAttribute('data-k')===k){pop.classList.remove('on');return;}
      pop.innerHTML=INFO[k]||'';pop.setAttribute('data-k',k);pop.classList.add('on');
      var r=b.getBoundingClientRect(),pw=Math.min(330,window.innerWidth-24);pop.style.width=pw+'px';
      pop.style.left=Math.min(Math.max(8,r.left-pw/2+r.width/2),window.innerWidth-pw-8)+'px';
      var top=r.bottom+8;if(top+pop.offsetHeight>window.innerHeight-8)top=Math.max(8,r.top-pop.offsetHeight-8);
      pop.style.top=top+'px';});});
  document.addEventListener('click',function(){pop.classList.remove('on');});
  pop.addEventListener('click',function(e){e.stopPropagation();});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();

"use strict";
// ════════════════════════════════════════════════════════════
// Season War Room — Dashboard · League · Waivers · Trades · Stats
// Projections are computed in the pipeline and written down BEFORE each week,
// so projected-vs-actual scores a real forecast rather than hindsight.
// ════════════════════════════════════════════════════════════
var D=null,WEEK=1,MYTEAM=null,DASHTEAM=null,ROSTERS={},THEME='dark',TSCALE=1,PCTMODE=false;
var POSN=['QB','RB','WR','TE'],SLOTS=['QB','RB','RB','WR','WR','TE','FLEX','FLEX'],FLEXOK=['RB','WR','TE'];
var COLSETS={dark:{QB:'#c06a7d',RB:'#5b91c4',WR:'#4aa691',TE:'#c08a4d'},
  slate:{QB:'#f5788d',RB:'#6aa9ff',WR:'#3fd6ad',TE:'#ff9f45'},
  ember:{QB:'#f07a86',RB:'#69a5d8',WR:'#4fc9a4',TE:'#ffab52'},
  paper:{QB:'#9e3247',RB:'#1f5688',WR:'#146353',TE:'#8a4d0b'}};
var COL=COLSETS.dark;
var THEMEMETA=[['dark','Dark',['#0c0c0c','#242424','#e0a832','#f0f0f0']],
  ['slate','Slate',['#0a0a0c','#22222a','#ffb638','#f6f6f9']],
  ['ember','Ember',['#0d0a08','#28211c','#ff9d3d','#f7f1ea']],
  ['paper','Paper',['#e8e6e0','#f4f2ec','#a35c07','#17171a']]];
var TEAMFIX={LAR:'LA',JAC:'JAX',WSH:'WAS',SD:'LAC',OAK:'LV',STL:'LA'};
function team(t){t=(t||'').toUpperCase();return TEAMFIX[t]||t;}
var INFO={
 kpi:"<p>Your team at a glance. <b>Vs projection</b> is the line worth watching: a roster beating its forecast is either lucky or being used more than the model knows, and only the second is actionable.</p>",
 pva:"<p>The pale marker is what the projection said <b>before</b> the games; the bar is what happened. Past the marker means beating the forecast.</p><p>Switch to % when comparing a 6-point tight end with a 20-point back &mdash; +4 means very different things to each.</p><p>Projections are recorded each Tuesday and never rewritten, so this is a real score, not hindsight.</p>",
 heat:"<p>Each team's starting strength by position against the league average. Green is surplus, red is a hole.</p><p>Read the columns as much as the rows: a column of red means the whole league is thin there, which changes what a waiver add at that position is worth.</p>",
 rising:"<p>Early detection is the point of a waiver claim &mdash; by the time a player has three good box scores he is gone.</p><p>This ranks on inputs that <b>lead</b> scoring rather than follow it: snap share, target share, touches, depth-chart position, and beating projection on growing usage. A player whose role expanded last week but whose points have not caught up is exactly the profile.</p>",
 waivers:"<p>Everyone unrostered, ranked by value over the replacement you could stream at that position. Raw points would fill the list with spare quarterbacks.</p><p>With ESPN connected this is your league's true free-agent pool; otherwise it is everyone missing from the CSV.</p>",
 trades:"<p>Two directions. <b>They might want</b> is your surplus at a position another team is thin at. <b>You might want</b> is the reverse.</p><p>Fit comes from starting-lineup strength against the league average, so a third good back on a team already set at the position reads as tradeable rather than valuable.</p><p>It has no idea what anyone will accept. It tells you who to call.</p>",
 league:"<p>Every team ranked by projected starting lineup, with positional strengths and how they are doing against their own forecasts.</p>",
 stats:"<p>Counting stats for the season in the data. Not rates, not projections &mdash; what happened. Sortable on any column.</p>",
 sources:"<p>Public nflverse data plus the open schedule. A scheduled job rebuilds it weekly; stale or failed builds raise a banner rather than being served quietly.</p><p>With ESPN sync configured, rosters come from your actual league.</p>",
 scoring:"<p>Your league's settings, used in every calculation. Half PPR makes a target worth about 20% less than full PPR, moving value toward backs and quarterbacks.</p>"};

function esc(s){return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;');}
var ALIAS={'hollywood brown':'marquise brown','tank dell':'nathaniel dell','cam ward':'cameron ward','chig okonkwo':'chigoziem okonkwo'};
function pkey(n){n=(n||'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'');
  n=n.toLowerCase().replace(/\./g,'').replace(/'/g,'').replace(/-/g,' ');
  n=n.replace(/\b(jr|sr|ii|iii|iv|v)\b/g,'').replace(/\s+/g,' ').trim();return ALIAS[n]||n;}
function statLine(p){return p.r||p.s||p.b||null;}
function statSrc(p){return p.r?'last 3':(p.s?'this season':'last season');}
function isInactive(p){return p.st==='CUT'||p.st==='RET'||p.st==='RES';}
function projFor(k,wk){var w=String(wk||WEEK);
  if(D.hist&&D.hist[w]&&D.hist[w][k]!==undefined)return D.hist[w][k];
  if(D.proj&&D.proj[w]&&D.proj[w][k]!==undefined)return D.proj[w][k];return null;}
function actualFor(k,wk){var w=String(wk);return (D.actual&&D.actual[w]&&D.actual[w][k]!==undefined)?D.actual[w][k]:null;}
function playedWeeks(){return (D.meta.played||[]).slice();}
function oppOf(t,wk){t=team(t);
  for(var i=0;i<D.games.length;i++){var g=D.games[i];
    if(g.w===wk&&(g.a===t||g.h===t))return {opp:g.a===t?g.h:g.a,home:g.h===t,implied:g.a===t?g.ia:g.ih};}
  return null;}
function myRoster(){return (MYTEAM&&ROSTERS[MYTEAM])?ROSTERS[MYTEAM]:[];}
function rosterOf(t){return ROSTERS[t]||[];}
function rosteredKeys(){var s={};Object.keys(ROSTERS).forEach(function(t){
  ROSTERS[t].forEach(function(n){s[pkey(n)]=t;});});return s;}
function pvaFor(k){var pr=0,ac=0,n=0;
  playedWeeks().forEach(function(w){var a=actualFor(k,w);if(a===null)return;
    var p=projFor(k,w);if(p===null)return;pr+=p;ac+=a;n++;});
  if(!n)return null;
  return {proj:pr,act:ac,n:n,diff:ac-pr,pct:pr>0?(ac/pr*100):null};}
var REPL={};
function computeRepl(){var teams=Math.max(2,Object.keys(ROSTERS).length||12),need={QB:1,RB:2.5,WR:3,TE:1};REPL={};
  POSN.forEach(function(pos){var v=[];
    Object.keys(D.players).forEach(function(k){var p=D.players[k];if(p.pos!==pos)return;
      var x=projFor(k,WEEK);if(x!==null)v.push(x);});
    v.sort(function(a,b){return b-a;});
    REPL[pos]=v.length?v[Math.min(v.length-1,Math.max(0,Math.round(teams*need[pos])-1))]:0;});}
function teamStrength(t){var by={QB:[],RB:[],WR:[],TE:[]};
  rosterOf(t).forEach(function(n){var k=pkey(n),p=D.players[k];if(!p||!by[p.pos])return;
    var v=projFor(k,WEEK);by[p.pos].push(v===null?0:v);});
  var need={QB:1,RB:2,WR:2,TE:1},out={};
  POSN.forEach(function(pos){by[pos].sort(function(a,b){return b-a;});var s=0;
    for(var i=0;i<need[pos];i++)s+=by[pos][i]||0;
    out[pos]={pts:s,extra:by[pos].slice(need[pos])};});
  return out;}
function leagueAverages(){var a={QB:0,RB:0,WR:0,TE:0},n=0;
  Object.keys(ROSTERS).forEach(function(t){var s=teamStrength(t);n++;POSN.forEach(function(p){a[p]+=s[p].pts;});});
  if(n)POSN.forEach(function(p){a[p]=a[p]/n;});return a;}
function forwardScore(k){var o=0,n=0;
  for(var w=WEEK;w<WEEK+3&&w<=18;w++){var v=projFor(k,w);if(v!==null){o+=v;n++;}}
  return n?o/n:null;}

// ── boot ───────────────────────────────────────────────────
function boot(){
  try{applyTheme(localStorage.getItem('swrtheme')||'dark');}catch(e){}
  try{applyScale(parseFloat(localStorage.getItem('swrscale'))||1);}catch(e){}
  try{var r=localStorage.getItem('swrroster');
    if(r){var o=JSON.parse(r);ROSTERS=o.rosters||{};MYTEAM=o.mine||null;}}catch(e){}
  fetch('./data.json',{cache:'no-store'})
    .then(function(r){if(!r.ok)throw new Error('HTTP '+r.status);return r.json();})
    .then(function(j){D=j;ready();})
    .catch(function(e){document.getElementById('banners').innerHTML=
      '<div class="banner bad"><b>Could not load data.json.</b> '+esc(String(e.message||e))+
      '. On a fresh deploy, run <i>Refresh season data</i> once from the Actions tab.</div>';});
}
function ready(){
  WEEK=D.meta.week||1;
  // ESPN rosters are the truth when present and override anything pasted in
  if(D.league&&D.league.rosters&&Object.keys(D.league.rosters).length){
    ROSTERS=D.league.rosters;
    if(!MYTEAM||!ROSTERS[MYTEAM])MYTEAM=Object.keys(ROSTERS)[0];
  }
  if(!DASHTEAM||!ROSTERS[DASHTEAM])DASHTEAM=MYTEAM;
  drawBanners();drawWeeks();drawThemes();drawScoring();drawTeamSel();wireStatic();redraw();
}
function redraw(){
  computeRepl();
  drawHeader();drawKPI();drawPvA();drawLineup();drawScoreboard();
  drawHeat();drawTeamCards();drawLeagueTrends();
  drawRising();drawWaivers();drawDrops();drawTrades();drawStats();drawSources();
}
function drawBanners(){
  var h='',built=new Date(D.meta.built),age=(Date.now()-built.getTime())/86400000;
  if(age>9)h+='<div class="banner bad"><b>Data is '+Math.round(age)+' days old.</b> The weekly refresh may have failed.</div>';
  if(!D.league)h+='<div class="banner warn">ESPN not connected &mdash; rosters come from the CSV import, so the waiver pool is an approximation. See SETUP.md.</div>';
  (D.meta.warnings||[]).forEach(function(w){h+='<div class="banner warn">'+esc(w)+'</div>';});
  document.getElementById('banners').innerHTML=h;
}
function drawHeader(){
  document.getElementById('hSeason').textContent=D.meta.season;
  document.getElementById('hWeek').textContent=WEEK;
  var d=new Date(D.meta.built);
  document.getElementById('hBuilt').textContent=isNaN(d)?'—':d.toLocaleDateString();
}
function drawWeeks(){
  var e=document.getElementById('wkPick');e.innerHTML='';
  for(var i=1;i<=18;i++){(function(w){var b=document.createElement('button');
    b.className='wkb'+(w===WEEK?' on':'');b.textContent=w;
    b.addEventListener('click',function(){WEEK=w;drawWeeks();redraw();});e.appendChild(b);})(i);}
}

// ── DASHBOARD ──────────────────────────────────────────────
function drawKPI(){
  var host=document.getElementById('kpis'),t=DASHTEAM||MYTEAM;
  if(!t||!rosterOf(t).length){host.innerHTML='<div class="empty">Connect ESPN or import a roster in Setup.</div>';return;}
  var projWk=0,over=0,overN=0,inj=0,byes=0;
  rosterOf(t).forEach(function(n){var k=pkey(n),p=D.players[k];if(!p)return;
    var v=projFor(k,WEEK);if(v!==null)projWk+=v;
    var pv=pvaFor(k);if(pv){over+=pv.diff;overN++;}
    if(p.inj)inj++;
    if(!oppOf(p.team,WEEK))byes++;});
  var s=teamStrength(t),avg=leagueAverages(),best=null,worst=null;
  POSN.forEach(function(p){var d=s[p].pts-(avg[p]||0);
    if(best===null||d>best[1])best=[p,d];
    if(worst===null||d<worst[1])worst=[p,d];});
  var cards=[['Projected week '+WEEK,projWk.toFixed(1),'points',''],
    ['Vs projection',(over>=0?'+':'')+over.toFixed(1),overN?'across '+overN+' players':'no results yet',over>0?'good':(over<0?'bad':'')],
    ['Strongest',best?best[0]:'—',best?(best[1]>=0?'+':'')+best[1].toFixed(1)+' vs league':'','good'],
    ['Thinnest',worst?worst[0]:'—',worst?(worst[1]>=0?'+':'')+worst[1].toFixed(1)+' vs league':'','bad'],
    ['Injuries',String(inj),'on report',inj?'bad':''],
    ['On bye',String(byes),'week '+WEEK,byes?'warn':'']];
  host.innerHTML=cards.map(function(c){return '<div class="kpi'+(c[3]?' '+c[3]:'')+'">'+
    '<div class="kl">'+c[0]+'</div><div class="kv">'+c[1]+'</div><div class="ks">'+c[2]+'</div></div>';}).join('');
}
function drawPvA(){
  var host=document.getElementById('pvaList'),t=DASHTEAM||MYTEAM,wks=playedWeeks();
  if(!wks.length){host.innerHTML='<div class="empty">No completed weeks yet. This fills in as games are played, '+
    'comparing results against the projection recorded beforehand.</div>';return;}
  var rows=[];
  rosterOf(t).forEach(function(n){var k=pkey(n),p=D.players[k];if(!p)return;
    var pv=pvaFor(k);if(pv)rows.push({p:p,pv:pv});});
  if(!rows.length){host.innerHTML='<div class="empty">No stored projection yet for anyone on this roster. '+
    'Projections are recorded from the first pipeline run onward, so week 1 has none.</div>';return;}
  rows.sort(function(a,b){return PCTMODE?((b.pv.pct||0)-(a.pv.pct||0)):(b.pv.diff-a.pv.diff);});
  var mx=Math.max.apply(null,rows.map(function(r){return Math.max(r.pv.act,r.pv.proj);}))||1;
  host.innerHTML=rows.map(function(r){
    var beat=r.pv.diff>=0;
    var lab=PCTMODE?(r.pv.pct===null?'—':Math.round(r.pv.pct)+'%'):(beat?'+':'')+r.pv.diff.toFixed(1);
    return '<div class="pvarow"><span class="pvan">'+esc(r.p.name)+
      ' <span class="pvap" style="color:'+COL[r.p.pos]+'">'+r.p.pos+'</span></span>'+
      '<span class="pvatrack"><span class="pvafill" style="width:'+Math.max(1,Math.min(100,r.pv.act/mx*100))+
      '%;background:'+(beat?'var(--ok)':'var(--urg)')+'"></span>'+
      '<span class="pvamark" style="left:'+Math.max(1,Math.min(99,r.pv.proj/mx*100))+'%"></span></span>'+
      '<span class="pvav" style="color:'+(beat?'var(--ok)':'var(--urg)')+'">'+lab+'</span>'+
      '<span class="pvad">'+r.pv.act.toFixed(1)+' / '+r.pv.proj.toFixed(1)+'</span></div>';
  }).join('')+'<div class="wcn" style="padding:9px 13px;">Bar is actual, marker is the projection made beforehand. '+
    'Totals over '+wks.length+' completed week'+(wks.length>1?'s':'')+'.</div>';
}
function drawLineup(){
  var host=document.getElementById('lineup'),t=DASHTEAM||MYTEAM,names=rosterOf(t);
  if(!names.length){host.innerHTML='<div class="empty">No roster.</div>';
    document.getElementById('benchList').innerHTML='';return;}
  var rs=[];
  names.forEach(function(n){var k=pkey(n),p=D.players[k];
    if(!p){rs.push({k:k,name:n,unknown:true,v:-1});return;}
    var v=projFor(k,WEEK),o=oppOf(p.team,WEEK);
    rs.push({k:k,p:p,name:p.name,v:v===null?0:v,o:o,bye:!o});});
  var by={QB:[],RB:[],WR:[],TE:[]};
  rs.forEach(function(r){if(r.p&&by[r.p.pos])by[r.p.pos].push(r);});
  Object.keys(by).forEach(function(x){by[x].sort(function(a,b){return (b.bye?-1:b.v)-(a.bye?-1:a.v);});});
  var used={},fill=[];
  SLOTS.forEach(function(s){if(s==='FLEX')return;var pick=null;
    for(var i=0;i<by[s].length;i++){if(!used[by[s][i].k]&&!by[s][i].bye){pick=by[s][i];used[pick.k]=1;break;}}
    fill.push({slot:s,r:pick});});
  var pool=[];
  FLEXOK.forEach(function(ps){by[ps].forEach(function(r){if(!used[r.k]&&!r.bye)pool.push(r);});});
  pool.sort(function(a,b){return b.v-a.v;});
  for(var i=0;i<2;i++){var r=pool[i]||null;if(r)used[r.k]=1;fill.push({slot:'FLEX',r:r});}
  host.innerHTML=fill.map(function(f){
    if(!f.r)return '<div class="slotrow"><span class="slotlab">'+f.slot+'</span>'+
      '<div class="slotmain"><div class="slotname" style="color:var(--dimr);font-style:italic">nobody available</div></div></div>';
    var p=f.r.p,pv=pvaFor(f.r.k);
    return '<div class="slotrow" style="border-left-color:'+COL[p.pos]+'">'+
      '<span class="slotlab">'+f.slot+'</span><div class="slotmain">'+
      '<div class="slotname">'+esc(p.name)+(p.d?' <span class="dep">'+p.pos+p.d+'</span>':'')+
      (isInactive(p)?' <span class="flag">'+esc(p.st)+'</span>':'')+'</div>'+
      '<div class="slotmeta">'+p.team+(f.r.o?' '+(f.r.o.home?'vs ':'@ ')+f.r.o.opp:' bye')+
      (pv?' · '+(pv.diff>=0?'+':'')+pv.diff.toFixed(1)+' vs proj':'')+
      (p.inj?' · <span style="color:var(--ac)">'+esc(p.inj[0])+'</span>':'')+'</div></div>'+
      '<span class="proj">'+f.r.v.toFixed(1)+'<span class="proju">proj</span></span></div>';
  }).join('');
  var bench=rs.filter(function(r){return !used[r.k];});
  bench.sort(function(a,b){return b.v-a.v;});
  document.getElementById('benchList').innerHTML=bench.length?bench.map(function(r){
    return '<div class="slotrow benchrow" style="border-left-color:'+(r.p?COL[r.p.pos]:'var(--ln)')+'">'+
      '<span class="slotlab">BN</span><div class="slotmain"><div class="slotname">'+esc(r.name)+
      (r.unknown?' <span class="flag">no stats</span>':'')+'</div><div class="slotmeta">'+
      (r.p?r.p.pos+' '+r.p.team+(r.bye?' · bye':''):'')+'</div></div>'+
      '<span class="proj">'+(r.unknown||r.bye?'—':r.v.toFixed(1))+'<span class="proju">proj</span></span></div>';
  }).join(''):'<div class="empty">Bench empty.</div>';
}
function drawScoreboard(){
  var host=document.getElementById('scoreboard');
  document.getElementById('sbWeek').textContent=WEEK;
  var gs=D.games.filter(function(g){return g.w===WEEK;});
  if(!gs.length){host.innerHTML='<div class="empty">No games.</div>';return;}
  var done=gs.filter(function(g){return g.done;}).length;
  document.getElementById('sbCx').textContent=done?done+' of '+gs.length+' final':gs.length+' scheduled';
  host.innerHTML=gs.map(function(g){
    var line=(g.t!==undefined)?('O/U '+g.t):'no line';
    var right=g.done?'<span class="sbsc">'+(g.as!==undefined?g.as:'')+'–'+(g.hs!==undefined?g.hs:'')+'</span>'
      :'<span class="sbimp">'+(g.ia!==undefined?g.ia.toFixed(1)+'/'+g.ih.toFixed(1):'—')+'</span>';
    return '<div class="sbrow"><span class="sbt">'+g.a+' @ '+g.h+'</span><span class="sbl">'+line+'</span>'+right+'</div>';
  }).join('');
}

// ── LEAGUE ─────────────────────────────────────────────────
function drawHeat(){
  var host=document.getElementById('heatGrid'),ks=Object.keys(ROSTERS);
  if(!ks.length){host.innerHTML='<div class="empty">No league loaded.</div>';return;}
  var avg=leagueAverages();
  var cells=ks.map(function(t){var s=teamStrength(t);
    return {t:t,v:POSN.map(function(p){return s[p].pts-(avg[p]||0);})};});
  var mx=1;cells.forEach(function(c){c.v.forEach(function(x){mx=Math.max(mx,Math.abs(x));});});
  cells.sort(function(a,b){
    var sa=a.v.reduce(function(x,y){return x+y;},0),sb=b.v.reduce(function(x,y){return x+y;},0);
    return sb-sa;});
  host.innerHTML='<div class="hrow hhead"><span class="hlab"></span>'+
    POSN.map(function(p){return '<span class="hc" style="color:'+COL[p]+'">'+p+'</span>';}).join('')+'</div>'+
    cells.map(function(c){
      return '<div class="hrow'+(c.t===MYTEAM?' mine':'')+'"><span class="hlab">'+esc(c.t)+'</span>'+
        c.v.map(function(x){var a=Math.min(.8,Math.abs(x)/mx*.8);
          return '<span class="hc" style="background:'+(x>=0?'rgba(90,168,122,':'rgba(217,83,79,')+a+')">'+
            (x>=0?'+':'')+x.toFixed(0)+'</span>';}).join('')+'</div>';}).join('')+
    '<div class="wcn" style="padding:9px 2px;">Starting-lineup points above or below the league average. '+
    'A column of red means the whole league is short there.</div>';
}
function drawTeamCards(){
  var host=document.getElementById('teamCards'),ks=Object.keys(ROSTERS);
  if(!ks.length){host.innerHTML='<div class="empty">No league loaded.</div>';return;}
  var avg=leagueAverages();
  var rows=ks.map(function(t){var s=teamStrength(t),tot=0,over=0,n=0;
    POSN.forEach(function(p){tot+=s[p].pts;});
    rosterOf(t).forEach(function(nm){var pv=pvaFor(pkey(nm));if(pv){over+=pv.diff;n++;}});
    return {t:t,s:s,tot:tot,over:over,n:n};});
  rows.sort(function(a,b){return b.tot-a.tot;});
  host.innerHTML=rows.map(function(r,i){
    return '<div class="tcard'+(r.t===MYTEAM?' mine':'')+'">'+
      '<div class="tch"><span class="trank">'+(i+1)+'</span><span class="tname">'+esc(r.t)+
      '</span><span class="ttot">'+r.tot.toFixed(0)+'</span></div><div class="tbars">'+
      POSN.map(function(p){var d=r.s[p].pts-(avg[p]||0);
        var w=Math.min(100,Math.max(4,r.s[p].pts/Math.max(1,avg[p]*1.8)*100));
        return '<div class="tbar"><span class="tbp">'+p+'</span><span class="tbt">'+
          '<span style="width:'+w+'%;background:'+COL[p]+'"></span></span>'+
          '<span class="tbv" style="color:'+(d>=0?'var(--ok)':'var(--urg)')+'">'+(d>=0?'+':'')+d.toFixed(0)+'</span></div>';
      }).join('')+'</div><div class="tfoot">'+
      (r.n?'season '+(r.over>=0?'+':'')+r.over.toFixed(1)+' vs projection':'no results yet')+'</div></div>';
  }).join('');
}
function drawLeagueTrends(){
  var host=document.getElementById('leagueTrend'),taken=rosteredKeys(),rows=[];
  Object.keys(taken).forEach(function(k){var p=D.players[k];if(!p)return;
    var pv=pvaFor(k);if(pv)rows.push({p:p,pv:pv,owner:taken[k]});});
  if(!rows.length){host.innerHTML='<div class="empty">Needs completed weeks with stored projections.</div>';return;}
  rows.sort(function(a,b){return PCTMODE?((b.pv.pct||0)-(a.pv.pct||0)):(b.pv.diff-a.pv.diff);});
  function blk(list,title,good){
    return '<div class="bwh">'+title+'</div>'+list.map(function(r){
      var lab=PCTMODE?(r.pv.pct===null?'—':Math.round(r.pv.pct)+'%'):(r.pv.diff>=0?'+':'')+r.pv.diff.toFixed(1);
      return '<div class="trrow" style="border-left:3px solid '+COL[r.p.pos]+'">'+
        '<span class="trarrow" style="color:'+(good?'var(--ok)':'var(--urg)')+'">'+lab+'</span>'+
        '<div style="flex:1;min-width:0"><div style="font-size:12.5px;font-weight:700">'+esc(r.p.name)+'</div>'+
        '<div style="font-size:10px;color:var(--dim);font-family:var(--fm)">'+r.p.pos+' '+r.p.team+' · '+
        esc(r.owner)+' · '+r.pv.act.toFixed(1)+' on '+r.pv.proj.toFixed(1)+' projected</div></div></div>';}).join('');}
  host.innerHTML=blk(rows.slice(0,10),'Beating projection',true)+blk(rows.slice(-6).reverse(),'Falling short',false);
}

// ── WAIVERS ────────────────────────────────────────────────
var wvFilter='ALL',wvSearch='';
// Rank on inputs that LEAD scoring rather than follow it. By the time a player
// has three good box scores he is already gone.
function risingScore(k){
  var p=D.players[k],cur=p.r||p.s,base=p.b;
  if(!cur)return null;
  // Rising value is about CHANGE, not level. An earlier version summed snap
  // share and depth rank, which handed the list to quarterbacks - they play
  // every snap and are always QB1, so they maxed both terms while telling you
  // nothing. Only movement counts now, and a player with no movement to
  // measure does not appear at all.
  var dTgt=base?((cur[5]||0)-(base[5]||0)):0;      // target share vs last season
  var dTch=base?((cur[3]||0)-(base[3]||0)):0;      // touches vs last season
  var pv=pvaFor(k),beat=pv?Math.max(-8,Math.min(12,pv.diff)):0;
  var moved=(Math.abs(dTgt)>=2)||(Math.abs(dTch)>=1)||(pv&&Math.abs(pv.diff)>=3);
  if(!moved)return null;
  var lead=dTgt*2.2+dTch*2.6+beat*1.0;
  if(lead<=0)return null;
  var conf=(p.d===1?1.15:(p.d===2?1.0:0.85));      // small tilt, not a driver
  return {score:lead*conf,dTgt:dTgt,dTch:dTch,beat:pv?pv.diff:null,snap:p.sn};
}
function drawRising(){
  var host=document.getElementById('risingList'),taken=rosteredKeys(),rows=[];
  if(!Object.keys(ROSTERS).length){host.innerHTML='<div class="empty">Load your league first.</div>';return;}
  Object.keys(D.players).forEach(function(k){
    if(taken[k])return;
    var p=D.players[k];if(isInactive(p))return;
    var r=risingScore(k);if(!r)return;
    rows.push({k:k,p:p,r:r,proj:forwardScore(k)});});
  if(!rows.length){
    host.innerHTML='<div class="empty">No usage movement to report yet. This compares each player\'s '+
      'current role against his own baseline, so it needs a couple of weeks of the season before it '+
      'can distinguish a rising role from a good box score.</div>';
    return;}
  rows.sort(function(a,b){return b.r.score-a.r.score;});
  rows=rows.slice(0,12);
  var mx=Math.max.apply(null,rows.map(function(r){return Math.max(.1,r.r.score);}));
  host.innerHTML=rows.map(function(r,i){
    var sig=[];
    if(r.r.dTgt>=3)sig.push('targets <b>+'+r.r.dTgt.toFixed(0)+'</b> share');
    if(r.r.dTch>=1.5)sig.push('touches <b>+'+r.r.dTch.toFixed(1)+'</b>');
    if(r.r.snap!==undefined)sig.push(r.r.snap.toFixed(0)+'% snaps');
    if(r.p.d===1)sig.push('<b>'+r.p.pos+'1</b> on the chart');
    if(r.r.beat!==null&&r.r.beat>2)sig.push('beat projection by <b>'+r.r.beat.toFixed(1)+'</b>');
    return '<div class="slotrow" style="border-left-color:'+COL[r.p.pos]+'">'+
      '<span class="slotlab">'+(i+1)+'</span><div class="slotmain">'+
      '<div class="slotname">'+esc(r.p.name)+'</div><div class="slotmeta">'+r.p.pos+(r.p.d||'')+' '+r.p.team+'</div>'+
      (sig.length?'<div class="slotwhy">'+sig.slice(0,3).join(' · ')+'</div>':'')+
      '<div class="sigbar"><span class="sig"><span style="width:'+Math.max(3,r.r.score/mx*100)+
      '%;background:'+COL[r.p.pos]+'"></span></span></div></div>'+
      '<span class="proj">'+(r.proj===null?'—':r.proj.toFixed(1))+'<span class="proju">3wk proj</span></span></div>';
  }).join('');
}
function drawWaivers(){
  var host=document.getElementById('wvList'),cx=document.getElementById('wvCx');
  if(!Object.keys(ROSTERS).length){host.innerHTML='<div class="empty">Connect ESPN or import the draft CSV.</div>';
    cx.textContent='';return;}
  var taken=rosteredKeys(),rows=[];
  Object.keys(D.players).forEach(function(k){
    if(taken[k])return;
    var p=D.players[k];
    if(wvFilter!=='ALL'&&p.pos!==wvFilter)return;
    if(wvSearch.trim()&&p.name.toLowerCase().indexOf(wvSearch.toLowerCase())<0)return;
    if(isInactive(p))return;
    var f=forwardScore(k);if(f===null)return;
    var st=statLine(p);if(!st)return;
    rows.push({k:k,p:p,st:st,f:f,vor:f-(REPL[p.pos]||0)});});
  if(!rows.length){host.innerHTML='<div class="empty">Nobody matches.</div>';cx.textContent='';return;}
  rows.sort(function(a,b){return b.vor-a.vor;});
  cx.textContent=rows.length+' available';
  host.innerHTML=rows.slice(0,25).map(function(r,i){
    var w=[];
    if(r.st[5]>=20)w.push('<b>'+r.st[5].toFixed(0)+'%</b> targets');
    if(r.st[3]>=11)w.push('<b>'+r.st[3].toFixed(1)+'</b> touches');
    if(r.p.sn!==undefined)w.push(r.p.sn.toFixed(0)+'% snaps');
    if(r.p.inj)w.push('<span style="color:var(--ac)">'+esc(r.p.inj[0])+'</span>');
    return '<div class="slotrow" style="border-left-color:'+COL[r.p.pos]+'">'+
      '<span class="slotlab">'+(i+1)+'</span><div class="slotmain">'+
      '<div class="slotname">'+esc(r.p.name)+'</div><div class="slotmeta">'+r.p.pos+(r.p.d||'')+' '+r.p.team+
      ' · '+r.f.toFixed(1)+' proj · '+statSrc(r.p)+'</div>'+
      (w.length?'<div class="slotwhy">'+w.slice(0,3).join(' · ')+'</div>':'')+'</div>'+
      '<span class="proj">'+(r.vor>0?'+':'')+r.vor.toFixed(1)+'<span class="proju">vs repl</span></span></div>';
  }).join('');
}
function drawDrops(){
  var host=document.getElementById('dropList'),names=myRoster();
  if(!names.length){host.innerHTML='<div class="empty">No roster.</div>';return;}
  var rows=names.map(function(n){var k=pkey(n),p=D.players[k];
    if(!p)return {name:n,unknown:true,f:-1};
    return {name:p.name,p:p,f:forwardScore(k)||0,inj:p.inj,bye:!oppOf(p.team,WEEK)};});
  rows.sort(function(a,b){return a.f-b.f;});
  host.innerHTML=rows.slice(0,8).map(function(r){
    var note=r.unknown?'no stats on file':(r.inj?'injury: '+esc(r.inj[0]):(r.bye?'on bye':''));
    return '<div class="slotrow'+(r.unknown?' benchrow':'')+'" style="border-left-color:'+
      (r.p?COL[r.p.pos]:'var(--ln)')+'"><span class="slotlab">'+(r.p?r.p.pos:'?')+'</span>'+
      '<div class="slotmain"><div class="slotname">'+esc(r.name)+'</div>'+
      (note?'<div class="slotwhy">'+note+'</div>':'')+'</div>'+
      '<span class="proj">'+(r.unknown?'—':r.f.toFixed(1))+'<span class="proju">3wk proj</span></span></div>';
  }).join('')+'<div class="wcn" style="padding:9px 13px;">Weakest first. A stashed handcuff is worth more than this shows.</div>';
}

// ── TRADES ─────────────────────────────────────────────────
function drawTrades(){
  var give=document.getElementById('tradeGive'),get=document.getElementById('tradeGet'),ks=Object.keys(ROSTERS);
  if(ks.length<2||!MYTEAM){give.innerHTML='<div class="empty">Needs a full league loaded.</div>';get.innerHTML='';return;}
  var avg=leagueAverages(),mine=teamStrength(MYTEAM),myNeed=[],mySur=[];
  POSN.forEach(function(p){var d=mine[p].pts-(avg[p]||0);
    if(d<-3)myNeed.push(p);
    if(d>3&&mine[p].extra.length)mySur.push(p);});
  function spares(t,pos){
    var out=[];
    rosterOf(t).forEach(function(n){var k=pkey(n),p=D.players[k];if(!p||p.pos!==pos)return;
      var v=projFor(k,WEEK);out.push({k:k,p:p,v:v===null?0:v});});
    out.sort(function(a,b){return b.v-a.v;});
    return out.slice({QB:1,RB:2,WR:2,TE:1}[pos]||1);
  }
  var giveRows=[],getRows=[];
  ks.filter(function(t){return t!==MYTEAM;}).forEach(function(t){
    var s=teamStrength(t);
    POSN.forEach(function(pos){
      var gap=(avg[pos]||0)-s[pos].pts;
      if(gap>=3&&mySur.indexOf(pos)>-1)
        spares(MYTEAM,pos).slice(0,2).forEach(function(x){if(x.v>0)giveRows.push({t:t,pos:pos,x:x,fit:gap+x.v*.3});});
      var sur=s[pos].pts-(avg[pos]||0);
      if(sur>=3&&myNeed.indexOf(pos)>-1)
        spares(t,pos).slice(0,2).forEach(function(x){if(x.v>0)getRows.push({t:t,pos:pos,x:x,fit:sur+x.v*.3});});
    });});
  giveRows.sort(function(a,b){return b.fit-a.fit;});
  getRows.sort(function(a,b){return b.fit-a.fit;});
  function render(rows,dir){
    if(!rows.length)return '<div class="empty">'+(dir==='give'
      ?'You have no clear surplus at a position anyone is short of.'
      :'No other team has spare depth where you are thin.')+'</div>';
    return rows.slice(0,8).map(function(r){
      return '<div class="slotrow" style="border-left-color:'+COL[r.pos]+'">'+
        '<span class="slotlab">'+r.pos+'</span><div class="slotmain">'+
        '<div class="slotname">'+esc(r.x.p.name)+'</div><div class="slotmeta">'+
        (dir==='give'?'→ '+esc(r.t)+' is thin at '+r.pos:'← from '+esc(r.t)+', spare '+r.pos)+
        '</div></div><span class="proj">'+r.x.v.toFixed(1)+'<span class="proju">proj</span></span></div>';
    }).join('');}
  give.innerHTML=render(giveRows,'give');
  get.innerHTML=render(getRows,'get');
  document.getElementById('tradeCx').textContent=
    (myNeed.length?'thin at '+myNeed.join(', '):'no obvious holes')+
    (mySur.length?' · spare '+mySur.join(', '):'');
}

// ── STATS ──────────────────────────────────────────────────
var stPos='QB',stSearch='',stRostOnly=false,stSort='pts',stDir=-1;
var STCOLS={
  QB:[['name','Player'],['team','Tm'],['d','Dep'],['g','G'],['cmp','Cmp'],['att','Att'],['pass_yd','Yds'],
      ['pass_td','TD'],['int','Int'],['car','Car'],['rush_yd','RuYd'],['rush_td','RuTD'],['pts','Pts']],
  RB:[['name','Player'],['team','Tm'],['d','Dep'],['g','G'],['car','Car'],['rush_yd','Yds'],['rush_td','TD'],
      ['tgt','Tgt'],['rec','Rec'],['rec_yd','ReYd'],['rec_td','ReTD'],['pts','Pts']],
  WR:[['name','Player'],['team','Tm'],['d','Dep'],['g','G'],['tgt','Tgt'],['rec','Rec'],['rec_yd','Yds'],
      ['rec_td','TD'],['car','Car'],['rush_yd','RuYd'],['pts','Pts']]};
STCOLS.TE=STCOLS.WR;
function statVal(p,id){
  if(id==='name')return p.name;
  if(id==='team')return p.team;
  if(id==='d')return p.d===undefined?99:p.d;
  var c=D.meta.tot_cols||[],ix=c.indexOf(id);
  return (p.t&&ix>=0)?p.t[ix]:0;
}
function drawStats(){
  var head=document.getElementById('stHead'),body=document.getElementById('stBody');
  var cols=STCOLS[stPos]||STCOLS.WR,taken=rosteredKeys(),list=[];
  Object.keys(D.players).forEach(function(k){var p=D.players[k];
    if(p.pos!==stPos||!p.t)return;
    if(stRostOnly&&!taken[k])return;
    if(stSearch.trim()&&p.name.toLowerCase().indexOf(stSearch.toLowerCase())<0)return;
    list.push(p);});
  list.sort(function(a,b){var x=statVal(a,stSort),y=statVal(b,stSort);
    if(typeof x==='string')return x.localeCompare(y)*stDir*-1;return (x-y)*stDir;});
  head.innerHTML='<tr>'+cols.map(function(cl){var act=stSort===cl[0];
    return '<th class="sortable'+(act?' act':'')+'" data-stc="'+cl[0]+'">'+cl[1]+
      (act?'<span class="sar">'+(stDir<0?'▾':'▴')+'</span>':'')+'</th>';}).join('')+'</tr>';
  body.innerHTML=list.length?list.slice(0,200).map(function(p){
    return '<tr style="border-left:3px solid '+COL[p.pos]+'">'+cols.map(function(cl){
      if(cl[0]==='name')return '<td class="pn">'+esc(p.name)+
        (isInactive(p)?' <span class="flag">'+esc(p.st)+'</span>':'')+'</td>';
      if(cl[0]==='team')return '<td class="mono">'+esc(p.team)+'</td>';
      if(cl[0]==='d')return '<td class="mono">'+(p.d===undefined?'—':p.pos+p.d)+'</td>';
      return '<td class="mono">'+statVal(p,cl[0])+'</td>';}).join('')+'</tr>';
  }).join(''):'<tr><td colspan="13" class="empty">Nobody matches.</td></tr>';
  Array.prototype.forEach.call(head.querySelectorAll('[data-stc]'),function(h){
    h.addEventListener('click',function(){var id=h.getAttribute('data-stc');
      if(stSort===id)stDir=-stDir;else{stSort=id;stDir=(id==='name'||id==='team')?1:-1;}
      drawStats();});});
}

// ── setup ──────────────────────────────────────────────────
function drawScoring(){
  var host=document.getElementById('scoreGrid');if(!host||!D.meta.scoring)return;
  var s=D.meta.scoring;
  var g=[['Passing',[['Yards',s.pass_yd],['TD',s.pass_td],['Int',s.int]]],
         ['Rushing',[['Yards',s.rush_yd],['TD',s.rush_td]]],
         ['Receiving',[['Reception',s.rec],['Yards',s.rec_yd],['TD',s.rec_td]]],
         ['Other',[['Fumble lost',s.fumble_lost],['Return TD',s.return_td]]]];
  host.innerHTML=g.map(function(x){return '<div class="mxcard"><div class="mxt">'+x[0]+'</div>'+
    x[1].map(function(r){return '<div class="mxr"><span>'+r[0]+'</span><span class="mxv">'+r[1]+'</span></div>';}).join('')+
    '</div>';}).join('');
}
function drawSources(){
  var e=document.getElementById('srcInfo');if(!e)return;
  e.innerHTML='Season <b>'+D.meta.season+'</b>, week <b>'+D.meta.week+'</b><br>'+
    'Weeks played: '+((D.meta.played||[]).join(', ')||'none yet')+'<br>'+
    'Projection history: '+(Object.keys(D.hist||{}).join(', ')||'none yet')+'<br>'+
    'Opportunity: <b>'+D.meta.ppc+'</b>/carry, <b>'+D.meta.ppt+'</b>/target, <b>'+(D.meta.ppa||'—')+'</b>/attempt<br>'+
    'Defence ratings from <b>'+D.meta.defense_season+'</b><br>'+
    'League source: <b>'+(D.league?'ESPN (live)':'CSV import')+'</b><br>'+
    'Players '+Object.keys(D.players).length+' · depth ranks '+(D.meta.depth||0)+'<br>'+
    'Built '+new Date(D.meta.built).toLocaleString();
}
function drawTeamSel(){
  [['myTeamSel',MYTEAM],['dashTeamSel',DASHTEAM]].forEach(function(cfg){
    var s=document.getElementById(cfg[0]);if(!s)return;
    var ks=Object.keys(ROSTERS);
    s.innerHTML=ks.length?ks.map(function(k){
      return '<option value="'+esc(k)+'"'+(cfg[1]===k?' selected':'')+'>'+esc(k)+'</option>';}).join('')
      :'<option>no roster</option>';});
}
function parseCSV(txt){
  var lines=txt.trim().split(/\r?\n/);if(lines.length<2)return null;
  var head=lines[0].toLowerCase();
  if(head.indexOf('player')<0||head.indexOf('team')<0)return null;
  var cols=head.split(','),iT=cols.indexOf('team'),iP=cols.indexOf('player'),out={};
  for(var i=1;i<lines.length;i++){
    var f=lines[i].match(/("([^"]*)"|[^,]*)/g);if(!f)continue;
    f=f.filter(function(x,ix){return ix%2===0;}).map(function(x){return x.replace(/^"|"$/g,'').trim();});
    if(!f[iT]||!f[iP])continue;
    (out[f[iT]]=out[f[iT]]||[]).push(f[iP]);}
  return Object.keys(out).length?out:null;
}
function saveRoster(){try{localStorage.setItem('swrroster',JSON.stringify({rosters:ROSTERS,mine:MYTEAM}));}catch(e){}}
function applyTheme(t){
  THEME=(['dark','slate','ember','paper'].indexOf(t)>-1)?t:'dark';COL=COLSETS[THEME];
  if(document.documentElement)document.documentElement.setAttribute('data-theme',THEME);
  try{localStorage.setItem('swrtheme',THEME);}catch(e){}}
function applyScale(s){
  TSCALE=Math.max(.9,Math.min(1.45,s||1));
  try{var b=document.body;
    if(b){if(TSCALE===1)b.style.removeProperty('zoom');else b.style.zoom=TSCALE;}
    localStorage.setItem('swrscale',String(TSCALE));}catch(e){}}
function drawThemes(){
  var g=document.getElementById('thGrid');if(!g)return;g.innerHTML='';
  THEMEMETA.forEach(function(m){var b=document.createElement('button');
    b.className='thb'+(THEME===m[0]?' on':'');
    b.innerHTML='<span class="thsw">'+m[2].map(function(x){return '<span style="background:'+x+'"></span>';}).join('')+
      '</span><span class="thn">'+m[1]+'</span>';
    b.addEventListener('click',function(){applyTheme(m[0]);drawThemes();redraw();});g.appendChild(b);});
  Array.prototype.forEach.call(document.querySelectorAll('[data-sz]'),function(b){
    b.className=(Math.abs(parseFloat(b.getAttribute('data-sz'))-TSCALE)<.01)?'on':'';});
}
function wireStatic(){
  Array.prototype.forEach.call(document.querySelectorAll('.tab'),function(t){
    t.addEventListener('click',function(){
      Array.prototype.forEach.call(document.querySelectorAll('.tab'),function(x){x.classList.remove('on');});
      t.classList.add('on');
      Array.prototype.forEach.call(document.querySelectorAll('.panel'),function(p){p.hidden=true;});
      var el=document.getElementById('p-'+t.getAttribute('data-t'));if(el)el.hidden=false;});});
  var pp=document.getElementById('pvaPts'),pc=document.getElementById('pvaPct');
  if(pp)pp.addEventListener('click',function(){PCTMODE=false;pp.className='on';pc.className='';drawPvA();drawLeagueTrends();});
  if(pc)pc.addEventListener('click',function(){PCTMODE=true;pc.className='on';pp.className='';drawPvA();drawLeagueTrends();});
  var imp=document.getElementById('impRun');
  if(imp)imp.addEventListener('click',function(){
    var m=document.getElementById('impMsg'),r=parseCSV(document.getElementById('impBox').value||'');
    if(!r){m.textContent='That does not look like the draft app CSV export.';return;}
    ROSTERS=r;var ks=Object.keys(r);
    MYTEAM=ks.filter(function(k){return /my team/i.test(k);})[0]||ks[0];DASHTEAM=MYTEAM;
    var all=0,miss=0;
    ks.forEach(function(k){r[k].forEach(function(n){all++;if(!D.players[pkey(n)])miss++;});});
    saveRoster();drawTeamSel();redraw();
    m.textContent=ks.length+' teams, '+all+' players, '+(all-miss)+' matched.';});
  var clr=document.getElementById('impClear');
  if(clr)clr.addEventListener('click',function(){ROSTERS={};MYTEAM=null;DASHTEAM=null;saveRoster();drawTeamSel();redraw();});
  var ms=document.getElementById('myTeamSel');
  if(ms)ms.addEventListener('change',function(e){MYTEAM=e.target.value;DASHTEAM=e.target.value;saveRoster();drawTeamSel();redraw();});
  var ds=document.getElementById('dashTeamSel');
  if(ds)ds.addEventListener('change',function(e){DASHTEAM=e.target.value;redraw();});
  Array.prototype.forEach.call(document.querySelectorAll('[data-wv]'),function(b){
    b.addEventListener('click',function(){
      Array.prototype.forEach.call(document.querySelectorAll('[data-wv]'),function(x){x.className='btn s g';});
      b.className='btn s';wvFilter=b.getAttribute('data-wv');drawWaivers();});});
  var ws=document.getElementById('wvSearch');
  if(ws)ws.addEventListener('input',function(e){wvSearch=e.target.value;drawWaivers();});
  Array.prototype.forEach.call(document.querySelectorAll('[data-st]'),function(b){
    b.addEventListener('click',function(){
      Array.prototype.forEach.call(document.querySelectorAll('[data-st]'),function(x){x.className='btn s g';});
      b.className='btn s';stPos=b.getAttribute('data-st');stSort='pts';stDir=-1;drawStats();});});
  var ss=document.getElementById('stSearch');
  if(ss)ss.addEventListener('input',function(e){stSearch=e.target.value;drawStats();});
  var a=document.getElementById('stMine'),b2=document.getElementById('stRost');
  if(a)a.addEventListener('click',function(){stRostOnly=false;a.className='on';b2.className='';drawStats();});
  if(b2)b2.addEventListener('click',function(){stRostOnly=true;b2.className='on';a.className='';drawStats();});
  Array.prototype.forEach.call(document.querySelectorAll('[data-sz]'),function(b){
    b.addEventListener('click',function(){applyScale(parseFloat(b.getAttribute('data-sz')));drawThemes();});});
  var pop=document.getElementById('pop');
  Array.prototype.forEach.call(document.querySelectorAll('.info'),function(b){
    b.addEventListener('click',function(ev){ev.stopPropagation();
      var k=b.getAttribute('data-info');
      if(pop.classList.contains('on')&&pop.getAttribute('data-k')===k){pop.classList.remove('on');return;}
      pop.innerHTML=INFO[k]||'';pop.setAttribute('data-k',k);pop.classList.add('on');
      var r=b.getBoundingClientRect(),pw=Math.min(330,window.innerWidth-24);
      pop.style.width=pw+'px';
      pop.style.left=Math.min(Math.max(8,r.left-pw/2+r.width/2),window.innerWidth-pw-8)+'px';
      var top=r.bottom+8;
      if(top+pop.offsetHeight>window.innerHeight-8)top=Math.max(8,r.top-pop.offsetHeight-8);
      pop.style.top=top+'px';});});
  document.addEventListener('click',function(){pop.classList.remove('on');});
  pop.addEventListener('click',function(e){e.stopPropagation();});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);
else boot();

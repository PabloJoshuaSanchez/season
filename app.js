"use strict";
// ════════════════════════════════════════════════════════════
// Season War Room
// Reads data.json (built weekly by build_data.py) and turns four signals into
// a start/sit call: recent volume, matchup adjusted for schedule faced, game
// environment from the betting market, and the gap between what a player has
// scored and what his usage says he should have.
// ════════════════════════════════════════════════════════════
var D=null, WEEK=1, MYTEAM=null, ROSTERS={}, THEME='dark', TSCALE=1;
var POSN=['QB','RB','WR','TE'];
var SLOTS=['QB','RB','RB','WR','WR','TE','FLEX','FLEX'];
var FLEXOK=['RB','WR','TE'];
var COLSETS={
  dark:  {QB:'#c06a7d',RB:'#5b91c4',WR:'#4aa691',TE:'#c08a4d',DST:'#9179b8'},
  slate: {QB:'#f5788d',RB:'#6aa9ff',WR:'#3fd6ad',TE:'#ff9f45',DST:'#b18cff'},
  ember: {QB:'#f07a86',RB:'#69a5d8',WR:'#4fc9a4',TE:'#ffab52',DST:'#b394e6'},
  paper: {QB:'#9e3247',RB:'#1f5688',WR:'#146353',TE:'#8a4d0b',DST:'#573f80'}
};
var COL=COLSETS.dark;
var THEMEMETA=[['dark','Dark',['#0c0c0c','#242424','#e0a832','#f0f0f0']],
  ['slate','Slate',['#0a0a0c','#22222a','#ffb638','#f6f6f9']],
  ['ember','Ember',['#0d0a08','#28211c','#ff9d3d','#f7f1ea']],
  ['paper','Paper',['#e8e6e0','#f4f2ec','#a35c07','#17171a']]];
// The Rams are LAR in the draft app and LA in the schedule feed.
var TEAMFIX={LAR:'LA',JAC:'JAX',WSH:'WAS',SD:'LAC',OAK:'LV',STL:'LA'};
function team(t){t=(t||'').toUpperCase();return TEAMFIX[t]||t;}

var INFO={
 score:"<p>The projection is expected points from <b>recent volume</b>, adjusted for the matchup and scaled by the game's betting total. It is deliberately not last week's score: points bounce around, opportunity is sticky, and chasing a box score is how people talk themselves into the wrong start.</p><p><b>Confidence</b> reflects how much evidence sits behind it &mdash; games played and how steady the role has been. A big number on two games says so.</p><p>For your clear starters there is no decision and the app will say so rather than inventing one.</p>",
 flex:"<p>This is where a start/sit tool can actually earn something. Your studs start themselves; the flex is three or four comparable players where a point or two of edge decides it.</p><p>The gap shown is between the best option and the next one. Under about 1.5 points it is noise &mdash; start whoever you like and don't agonise.</p>",
 trends:"<p>Three-week rolling usage against each player's own season baseline. A rising target or snap share tends to show up in the box score later, which is exactly when everyone else notices.</p><p>Needs a few weeks of the current season before it means anything.</p>",
 env:"<p><b>Implied team total</b> is how many points the betting market expects a team to score, from the game total and the spread. It is the sharpest public read on game environment and almost nobody works it out by hand.</p><p>A back in a 28-point offence is in a different game from one in a 17-point offence, whatever their season averages look like.</p>",
 def:"<p>Points allowed per position, <b>adjusted for who each defence actually faced</b>. Raw points-allowed is badly confounded &mdash; a defence looks elite if its schedule handed it three weak offences.</p><p>Above 1.00 means generous; below means tough. 1.20 means the players facing them scored about 20% more than their own averages.</p>",
 import:"<p>Paste the CSV from the draft app's export. It carries every team's roster, so the app knows not just what you have but what everyone else has.</p><p>Names are matched to the stats feed automatically; anything that doesn't match is listed so you can add it by hand.</p>",
 waivers:"<p>Everyone not on any of the twelve imported rosters, ranked by <b>opportunity</b> rather than name recognition. That is the whole point: the players worth adding are the ones whose usage has outgrown their reputation.</p><p>The score blends expected points from recent volume, the next three weeks of matchups and game environment, and role security from snap share. A rising target share counts for more than a big box score.</p><p>Anyone the import could not match &mdash; defences, kickers, players with no NFL snaps &mdash; is invisible here. They are not necessarily free.</p>",
 drops:"<p>Your roster sorted by what each player is projected to contribute the rest of the way, worst first, with byes and injuries flagged.</p><p>It is a prompt, not an instruction. A stashed handcuff or a player returning from injury is worth more than his current projection says, and the model has no idea about either.</p>",
 scoring:"<p>Your league's settings, as used in every calculation. Half PPR changes things more than people expect: a target is worth about 20% less than in full PPR, which moves value from high-volume receivers toward backs and quarterbacks.</p><p>Ja'Marr Chase alone is worth nearly four points a game less here than he would be in full PPR.</p>",
 stats:"<p>Counting stats for the season the data covers &mdash; not rates, not projections, just what happened. Sortable by any column.</p><p>Until the current season has games, this shows last season. The header says which.</p>",
 sources:"<p>Everything comes from nflverse's public data and the open schedule file. No accounts, no private endpoints, nothing that breaks when a fantasy site changes its site.</p><p>A scheduled job rebuilds the data every Tuesday. If it fails or the file goes stale, a banner appears at the top rather than the app quietly showing you last week's numbers.</p>"
};

// ── boot ───────────────────────────────────────────────────
function boot(){
  try{ applyTheme(localStorage.getItem('swrtheme')||'dark'); }catch(e){ applyTheme('dark'); }
  try{ applyScale(parseFloat(localStorage.getItem('swrscale'))||1); }catch(e){}
  try{
    var r=localStorage.getItem('swrroster');
    if(r){ var o=JSON.parse(r); ROSTERS=o.rosters||{}; MYTEAM=o.mine||null; }
  }catch(e){}
  fetch('./data.json',{cache:'no-store'})
    .then(function(r){ if(!r.ok) throw new Error('HTTP '+r.status); return r.json(); })
    .then(function(j){ D=j; ready(); })
    .catch(function(e){
      document.getElementById('banners').innerHTML=
        '<div class="banner bad"><b>Could not load data.json.</b> '+esc(String(e.message||e))+
        '. If this is a fresh deploy, run the <i>Refresh season data</i> action once from the Actions tab.</div>';
    });
}
function ready(){
  WEEK=D.meta.week||1;
  drawBanners(); drawWeeks(); drawThemes(); drawSources(); drawTeamSel();
  redraw();
  wireStatic();
}
function redraw(){
  drawHeader(); drawLineup(); drawBench(); drawFlex();
  drawCompareOptions(); drawCompare(); drawTrends(); drawEnv(); drawDef();
  drawWaivers(); drawDrops(); drawScoring(); drawStats(); drawScoreboard();
}

// ── helpers ────────────────────────────────────────────────
function esc(s){return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;');}
var ALIAS={'hollywood brown':'marquise brown','tank dell':'nathaniel dell',
           'cam ward':'cameron ward','chig okonkwo':'chigoziem okonkwo'};
function pkey(n){
  n=(n||'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'');
  n=n.toLowerCase().replace(/\./g,'').replace(/'/g,'').replace(/-/g,' ');
  n=n.replace(/\b(jr|sr|ii|iii|iv|v)\b/g,'');
  n=n.replace(/\s+/g,' ').trim();
  return ALIAS[n]||n;
}
function P(k){return D&&D.players[k];}
function statLine(p){ return p.r||p.s||p.b||null; }      // recent > season > prior
function statSrc(p){ return p.r?'last 3':(p.s?'this season':'last season'); }
function gameFor(t,wk){
  t=team(t);
  for(var i=0;i<D.games.length;i++){
    var g=D.games[i];
    if(g.w===wk&&(g.a===t||g.h===t)) return g;
  }
  return null;
}
function oppOf(t,wk){
  var g=gameFor(t,wk); if(!g) return null;
  t=team(t);
  return {opp:g.a===t?g.h:g.a, home:g.h===t, implied:g.a===t?g.ia:g.ih, total:g.t, spread:g.s};
}
var LEAGUE_AVG_IMPLIED=22.5;

// ── role adjustment ────────────────────────────────────────
// Last season's numbers describe the job a player HAD. Depth-chart rank says
// what he has now. Without this the model ranks a fill-in starter who is now a
// third-stringer above the man who actually took the job.
// Backups matter very differently by position: a QB2 scores nothing, a WR2
// scores plenty, so each position gets its own curve.
var ROLE={QB:[1,.12,.05,.03], RB:[1,.60,.30,.15], WR:[1,.92,.72,.45,.25], TE:[1,.45,.20,.12]};
function roleMult(p){
  if(p.d===undefined) return {m:1,w:0,rank:null};
  var curve=ROLE[p.pos]||[1,.8,.5,.3];
  var raw=curve[Math.min(curve.length-1,Math.max(0,p.d-1))];
  // The depth chart matters most in week 1, when guesswork is all there is.
  // Once a player has real current-season usage, that usage is the better
  // evidence and this fades back.
  var g=(p.s&&p.s[0])||0;
  var w=Math.max(.2,1-g/8);
  return {m:1+(raw-1)*w, w:w, rank:p.d, raw:raw};
}
function isInactive(p){ return p.st==='CUT'||p.st==='RET'||p.st==='RES'; }

// ── the model ──────────────────────────────────────────────
// projection = recent expected points x matchup x game environment,
// each multiplier clamped so one input can't run away with the answer.
function project(k,wk){
  var p=P(k); if(!p) return null;
  var st=statLine(p); if(!st) return null;
  var g=st[0], xfp=st[2], ppg=st[1];
  var base=xfp>0?xfp:ppg;
  var o=oppOf(p.team,wk);
  var mMatch=1, mEnv=1, dr=null;
  if(o){
    var dd=D.defense[team(o.opp)];
    if(dd&&dd[p.pos]){ dr=dd[p.pos]; mMatch=Math.max(.82,Math.min(1.22,dr)); }
    if(o.implied!==undefined&&o.implied!==null){
      mEnv=Math.max(.85,Math.min(1.18,o.implied/LEAGUE_AVG_IMPLIED));
    }
  }
  var role=roleMult(p);
  var proj=base*mMatch*mEnv*role.m;
  // regression gap: scoring far above your own usage is not a repeatable skill
  var gap=(ppg&&xfp)?ppg-xfp:0;
  var conf = g>=10?'hi':g>=5?'md':'lo';
  if(!p.r&&!p.s) conf = (g>=10?'md':'lo');   // prior-season only
  if(role.rank&&role.rank>1&&conf==='hi') conf='md';
  return {k:k,p:p,proj:Math.round(proj*10)/10,base:base,mMatch:mMatch,mEnv:mEnv,
          dr:dr,o:o,gap:Math.round(gap*10)/10,conf:conf,g:g,src:statSrc(p),st:st,
          bye:!o,role:role};
}
function why(r){
  var out=[];
  if(r.bye){ out.push('<b>On bye</b> this week'); return out; }
  var st=r.st;
  if(isInactive(r.p)) out.push('<b>'+esc(r.p.st)+'</b> — not on an active roster');
  if(r.role.rank){
    if(r.role.rank===1) out.push('listed <b>'+r.p.pos+'1</b> on the depth chart');
    else out.push('listed <b>'+r.p.pos+r.role.rank+'</b> — last season\'s numbers came from a different role');
  }
  if(st[5]>=25) out.push('commands <b>'+st[5].toFixed(0)+'%</b> of his team\'s targets');
  else if(st[3]>=14) out.push('<b>'+st[3].toFixed(1)+'</b> touches a game');
  if(r.dr!==null&&r.dr>=1.12) out.push('faces a defence giving up <b>'+Math.round((r.dr-1)*100)+'% more</b> than normal to '+r.p.pos+'s');
  else if(r.dr!==null&&r.dr<=0.9) out.push('faces a <b>tough</b> defence for '+r.p.pos+'s');
  if(r.o&&r.o.implied!==undefined&&r.o.implied!==null){
    if(r.o.implied>=25.5) out.push('in a <b>'+r.o.implied.toFixed(1)+'-point</b> implied offence');
    else if(r.o.implied<=18.5) out.push('in a <b>'+r.o.implied.toFixed(1)+'-point</b> implied offence, a low-scoring spot');
  }
  if(r.gap>=4) out.push('scoring <b>'+r.gap.toFixed(1)+'</b> above what his usage supports &mdash; expect some giveback');
  else if(r.gap<=-4) out.push('scoring <b>'+Math.abs(r.gap).toFixed(1)+'</b> below his usage &mdash; due a correction upward');
  if(r.p.inj) out.push('injury report: <b>'+esc(r.p.inj[0])+'</b>'+(r.p.inj[1]?' ('+esc(r.p.inj[1])+')':''));
  if(r.p.sn!==undefined&&r.p.sn<55) out.push('only <b>'+r.p.sn.toFixed(0)+'%</b> of snaps');
  return out;
}

// ── rendering ──────────────────────────────────────────────
function drawBanners(){
  var b=document.getElementById('banners'),h='';
  var w=(D.meta.warnings||[]);
  var built=new Date(D.meta.built);
  var ageDays=(Date.now()-built.getTime())/86400000;
  if(ageDays>9) h+='<div class="banner bad"><b>This data is '+Math.round(ageDays)+' days old.</b> '+
    'The weekly refresh may have failed &mdash; check the Actions tab before trusting anything here.</div>';
  if(w.length) h+='<div class="banner warn">'+w.map(esc).join('<br>')+'</div>';
  b.innerHTML=h;
}
function drawHeader(){
  document.getElementById('hSeason').textContent=D.meta.season;
  document.getElementById('hWeek').textContent=WEEK;
  var d=new Date(D.meta.built);
  document.getElementById('hBuilt').textContent=isNaN(d)?'—':d.toLocaleDateString();
}
function drawWeeks(){
  var e=document.getElementById('wkPick'); e.innerHTML='';
  var max=18;
  for(var i=1;i<=max;i++){
    (function(w){
      var b=document.createElement('button');
      b.className='wkb'+(w===WEEK?' on':'');
      b.textContent=w;
      b.addEventListener('click',function(){WEEK=w;drawWeeks();redraw();});
      e.appendChild(b);
    })(i);
  }
}
function myRoster(){ return (MYTEAM&&ROSTERS[MYTEAM])?ROSTERS[MYTEAM]:[]; }

function drawLineup(){
  var host=document.getElementById('lineup');
  var roster=myRoster();
  if(!roster.length){
    host.innerHTML='<div class="empty">No roster yet. Go to <b>Setup</b> and paste the CSV export from the draft app.</div>';
    document.getElementById('lineupCx').textContent='';
    return;
  }
  var rs=roster.map(function(n){return project(pkey(n),WEEK);}).filter(Boolean);
  var unmatched=roster.length-rs.length;
  var by={QB:[],RB:[],WR:[],TE:[]};
  rs.forEach(function(r){ if(by[r.p.pos]) by[r.p.pos].push(r); });
  Object.keys(by).forEach(function(k){
    by[k].sort(function(a,b){return (b.bye?-1:b.proj)-(a.bye?-1:a.proj);});
  });
  var used={},fill=[];
  SLOTS.forEach(function(s){
    if(s==='FLEX') return;
    var pick=null;
    for(var i=0;i<by[s].length;i++){ if(!used[by[s][i].k]&&!by[s][i].bye){pick=by[s][i];used[pick.k]=1;break;} }
    fill.push({slot:s,r:pick});
  });
  var flexPool=[];
  FLEXOK.forEach(function(ps){ by[ps].forEach(function(r){ if(!used[r.k]&&!r.bye) flexPool.push(r); }); });
  flexPool.sort(function(a,b){return b.proj-a.proj;});
  var nFlex=SLOTS.filter(function(s){return s==='FLEX';}).length;
  for(var i=0;i<nFlex;i++){
    var r=flexPool[i]||null;
    if(r) used[r.k]=1;
    fill.push({slot:'FLEX',r:r});
  }
  window._flexPool=flexPool; window._used=used; window._all=rs;

  var tot=0;
  host.innerHTML=fill.map(function(f){
    if(!f.r) return '<div class="slotrow"><span class="slotlab">'+f.slot+'</span>'+
      '<div class="slotmain"><div class="slotname" style="color:var(--dimr);font-style:italic">nobody available</div></div></div>';
    tot+=f.r.proj;
    var r=f.r,reasons=why(r);
    return '<div class="slotrow" style="border-left-color:'+COL[r.p.pos]+'">'+
      '<span class="slotlab">'+f.slot+'</span>'+
      '<div class="slotmain"><div class="slotname">'+esc(r.p.name)+
        ' <span class="conf '+r.conf+'">'+r.conf.toUpperCase()+'</span></div>'+
      '<div class="slotmeta">'+r.p.pos+(r.p.d?r.p.d:'')+' '+r.p.team+
        (r.o?' &middot; '+(r.o.home?'vs ':'@ ')+r.o.opp+
             (r.o.implied!==undefined&&r.o.implied!==null?' &middot; '+r.o.implied.toFixed(1)+' implied':''):' &middot; bye')+
        ' &middot; '+r.src+'</div>'+
      (reasons.length?'<div class="slotwhy">'+reasons.slice(0,3).join(' &middot; ')+'</div>':'')+
      '</div><span class="proj">'+r.proj.toFixed(1)+'<span class="proju">proj</span></span></div>';
  }).join('');
  document.getElementById('lineupCx').textContent=
    tot.toFixed(1)+' projected'+(unmatched?' · '+unmatched+' unmatched':'');
}

function drawFlex(){
  var card=document.getElementById('flexCard'),host=document.getElementById('flexCall');
  var pool=(window._flexPool||[]).slice(0,5);
  if(pool.length<2){ card.hidden=true; return; }
  card.hidden=false;
  // Everyone who wasn't auto-slotted, plus the last flex starter for context
  var all=(window._all||[]).filter(function(r){return !r.bye&&FLEXOK.indexOf(r.p.pos)>-1;});
  all.sort(function(a,b){return b.proj-a.proj;});
  var contenders=all.slice(0,6);
  if(contenders.length<2){ card.hidden=true; return; }
  var gap=contenders[0].proj-contenders[1].proj;
  var verdict = gap<1.5
    ? '<b>Too close to call.</b> '+esc(contenders[0].p.name)+' and '+esc(contenders[1].p.name)+
      ' are within '+gap.toFixed(1)+' points. Start whichever you prefer &mdash; this is inside the noise.'
    : '<b>Start '+esc(contenders[0].p.name)+'.</b> He projects '+gap.toFixed(1)+
      ' points clear of '+esc(contenders[1].p.name)+', which is a real gap rather than rounding.';
  host.innerHTML='<div class="callout">'+verdict+'</div>'+contenders.map(function(r,i){
    var mx=contenders[0].proj||1;
    return '<div class="slotrow" style="border-left-color:'+COL[r.p.pos]+'">'+
      '<span class="slotlab">'+(i+1)+'</span>'+
      '<div class="slotmain"><div class="slotname">'+esc(r.p.name)+'</div>'+
      '<div class="slotmeta">'+r.p.pos+(r.p.d?r.p.d:'')+' '+r.p.team+(r.o?' '+(r.o.home?'vs ':'@ ')+r.o.opp:'')+
        ' &middot; matchup &times;'+r.mMatch.toFixed(2)+' &middot; environment &times;'+r.mEnv.toFixed(2)+'</div>'+
      '<div class="sigbar"><span class="sig"><span style="width:'+(r.proj/mx*100)+'%;background:'+COL[r.p.pos]+'"></span></span></div>'+
      '</div><span class="proj">'+r.proj.toFixed(1)+'<span class="proju">proj</span></span></div>';
  }).join('');
}

function drawBench(){
  var host=document.getElementById('benchList');
  var all=window._all||[],used=window._used||{};
  var bench=all.filter(function(r){return !used[r.k];});
  if(!bench.length){ host.innerHTML='<div class="empty">Nothing on the bench.</div>'; return; }
  bench.sort(function(a,b){return b.proj-a.proj;});
  host.innerHTML=bench.map(function(r){
    return '<div class="slotrow benchrow" style="border-left-color:'+COL[r.p.pos]+'">'+
      '<span class="slotlab">BN</span><div class="slotmain">'+
      '<div class="slotname">'+esc(r.p.name)+'</div>'+
      '<div class="slotmeta">'+r.p.pos+(r.p.d?r.p.d:'')+' '+r.p.team+(r.bye?' &middot; bye':(r.o?' '+(r.o.home?'vs ':'@ ')+r.o.opp:''))+'</div>'+
      '</div><span class="proj">'+(r.bye?'—':r.proj.toFixed(1))+'<span class="proju">proj</span></span></div>';
  }).join('');
}

function drawCompareOptions(){
  var opts=Object.keys(D.players).map(function(k){return {k:k,n:D.players[k].name,p:D.players[k]};});
  opts.sort(function(a,b){return a.n.localeCompare(b.n);});
  ['cmpA','cmpB'].forEach(function(id,ix){
    var s=document.getElementById(id),cur=s.value;
    s.innerHTML=opts.map(function(o){
      return '<option value="'+esc(o.k)+'">'+esc(o.n)+' ('+o.p.pos+' '+o.p.team+')</option>';
    }).join('');
    if(cur) s.value=cur;
    else{
      var mine=myRoster().map(pkey).filter(function(k){return D.players[k];});
      if(mine[ix]) s.value=mine[ix];
    }
  });
}
function drawCompare(){
  var host=document.getElementById('cmpOut');
  var a=project(document.getElementById('cmpA').value,WEEK);
  var b=project(document.getElementById('cmpB').value,WEEK);
  if(!a||!b){ host.innerHTML='<div class="card"><div class="empty">Pick two players.</div></div>'; return; }
  function card(r,other){
    var rows=[
      ['Projection',r.proj.toFixed(1),r.proj>other.proj],
      ['Expected pts from volume',r.st[2].toFixed(1),r.st[2]>other.st[2]],
      ['Actual scored',r.st[1].toFixed(1),r.st[1]>other.st[1]],
      ['Touches / game',r.st[3].toFixed(1),r.st[3]>other.st[3]],
      ['Targets / game',r.st[4].toFixed(1),r.st[4]>other.st[4]],
      ['Target share',r.st[5].toFixed(1)+'%',r.st[5]>other.st[5]],
      ['Snap share',r.p.sn!==undefined?r.p.sn.toFixed(0)+'%':'—',(r.p.sn||0)>(other.p.sn||0)],
      ['Matchup',r.dr===null?'—':'×'+r.mMatch.toFixed(2),r.mMatch>other.mMatch],
      ['Game environment',r.o&&r.o.implied!=null?r.o.implied.toFixed(1):'—',r.mEnv>other.mEnv],
      ['Regression gap',(r.gap>0?'+':'')+r.gap.toFixed(1),r.gap<other.gap],
      ['Sample',r.g+' games ('+r.src+')',r.g>other.g]
    ];
    return '<div class="card"><div class="ch"><h3 style="color:'+COL[r.p.pos]+'">'+esc(r.p.name)+'</h3>'+
      '<span class="cx">'+r.p.pos+' '+r.p.team+(r.o?(r.o.home?' vs ':' @ ')+r.o.opp:' bye')+'</span></div>'+
      '<div class="cb tight">'+rows.map(function(x){
        return '<div class="cmprow"><span class="cmpl">'+x[0]+'</span>'+
          '<span class="cmpv'+(x[2]?' win':'')+'">'+x[1]+'</span></div>';
      }).join('')+'</div></div>';
  }
  host.innerHTML=card(a,b)+card(b,a);
}

function drawTrends(){
  var host=document.getElementById('trendList');
  var rows=[];
  Object.keys(D.players).forEach(function(k){
    var p=D.players[k];
    if(!p.r||!p.s) return;                       // needs current-season recent vs season
    if(p.s[0]<4) return;
    var dTgt=p.r[5]-p.s[5], dTch=p.r[3]-p.s[3];
    var move=Math.abs(dTgt)>=4?dTgt:(Math.abs(dTch)>=2.5?dTch*2:0);
    if(!move) return;
    rows.push({p:p,dTgt:dTgt,dTch:dTch,move:move});
  });
  if(!rows.length){
    host.innerHTML='<div class="empty">Trends need at least four games of the current season, '+
      'plus a recent three-week window to compare against. Nothing to show yet.</div>';
    return;
  }
  rows.sort(function(a,b){return Math.abs(b.move)-Math.abs(a.move);});
  host.innerHTML=rows.slice(0,20).map(function(r){
    var up=r.move>0;
    return '<div class="trrow" style="border-left:3px solid '+COL[r.p.pos]+'">'+
      '<span class="trarrow" style="color:'+(up?'var(--ok)':'var(--urg)')+'">'+
        (up?'▲':'▼')+' '+Math.abs(r.move).toFixed(1)+'</span>'+
      '<div style="flex:1;min-width:0"><div style="font-size:12.5px;font-weight:700">'+esc(r.p.name)+'</div>'+
      '<div style="font-size:10px;color:var(--dim);font-family:var(--fm)">'+r.p.pos+' '+r.p.team+
        ' &middot; targets '+r.p.s[5].toFixed(0)+'% → '+r.p.r[5].toFixed(0)+'%'+
        ' &middot; touches '+r.p.s[3].toFixed(1)+' → '+r.p.r[3].toFixed(1)+'</div></div></div>';
  }).join('');
}

function drawEnv(){
  var host=document.getElementById('impList');
  var gs=D.games.filter(function(g){return g.w===WEEK&&g.t!==undefined;});
  if(!gs.length){
    host.innerHTML='<div class="empty">No betting lines posted for week '+WEEK+' yet. '+
      'They appear closer to kickoff.</div>';
    return;
  }
  var rows=[];
  gs.forEach(function(g){
    rows.push({t:g.a,v:g.ia,opp:g.h,at:true,tot:g.t});
    rows.push({t:g.h,v:g.ih,opp:g.a,at:false,tot:g.t});
  });
  rows.sort(function(a,b){return b.v-a.v;});
  var mx=rows[0].v||1;
  host.innerHTML=rows.map(function(r){
    var c=r.v>=26?'var(--ok)':r.v>=22?'var(--ac)':'var(--ln2)';
    return '<div class="imp"><span class="impt">'+r.t+(r.at?' @ ':' vs ')+r.opp+'</span>'+
      '<span class="impbar"><span style="width:'+(r.v/mx*100)+'%;background:'+c+'"></span></span>'+
      '<span class="impv" style="color:'+c+'">'+r.v.toFixed(1)+'</span></div>';
  }).join('')+'<div class="wcn" style="padding:9px 13px;">Implied points per team, from the game total and spread. '+
    'League average is about '+LEAGUE_AVG_IMPLIED+'.</div>';
}

function drawDef(){
  var host=document.getElementById('defGrid');
  document.getElementById('defSrc').textContent='from '+D.meta.defense_season;
  var teams=Object.keys(D.defense).sort();
  host.innerHTML=teams.map(function(t){
    return '<div class="mxcard"><div class="mxt">'+t+'</div>'+POSN.map(function(p){
      var v=D.defense[t][p];
      var c=v===null||v===undefined?'var(--dimr)':v>=1.12?'var(--ok)':v<=.9?'var(--urg)':'var(--dim)';
      return '<div class="mxr"><span>'+p+'</span><span class="mxv" style="color:'+c+'">'+
        (v==null?'—':v.toFixed(2))+'</span></div>';
    }).join('')+'</div>';
  }).join('');
}

// ── waivers ────────────────────────────────────────────────
var wvFilter='ALL', wvSearch='';
// Raw points rank quarterbacks first at every position, which makes a waiver
// list useless: you start one QB and the rest of the league is free. What
// matters is value over the replacement you could pick up at that position,
// so a startable back outranks a seventh-best quarterback.
var REPL={};
function computeRepl(){
  var teams=Math.max(2,Object.keys(ROSTERS).length||12);
  var need={QB:1,RB:2.5,WR:3,TE:1};   // starters plus a share of the flex
  REPL={};
  POSN.forEach(function(pos){
    var vals=[];
    Object.keys(D.players).forEach(function(k){
      var p=D.players[k];
      if(p.pos!==pos) return;
      var st=statLine(p); if(!st||st[0]<3) return;
      vals.push(st[2]>0?st[2]:st[1]);
    });
    vals.sort(function(a,b){return b-a;});
    var idx=Math.min(vals.length-1,Math.max(0,Math.round(teams*need[pos])-1));
    REPL[pos]=vals.length?vals[idx]:0;
  });
}
function rosteredKeys(){
  var set={};
  Object.keys(ROSTERS).forEach(function(t){
    ROSTERS[t].forEach(function(n){ set[pkey(n)]=t; });
  });
  return set;
}
// Value over the next three weeks, not just this one - a waiver add is a
// multi-week decision and one soft matchup shouldn't carry it.
function forwardScore(k){
  var out=0,n=0;
  for(var w=WEEK;w<WEEK+3&&w<=18;w++){
    var r=project(k,w);
    if(!r) break;
    if(r.bye) continue;
    out+=r.proj; n++;
  }
  return n?out/n:null;
}
function drawWaivers(){
  var host=document.getElementById('wvList'),cx=document.getElementById('wvCx');
  if(!Object.keys(ROSTERS).length){
    host.innerHTML='<div class="empty">Import your league first, in <b>Setup</b>. '+
      'Without every team\'s roster the app can\'t tell who is actually a free agent.</div>';
    cx.textContent=''; return;
  }
  computeRepl();
  var taken=rosteredKeys();
  var rows=[];
  Object.keys(D.players).forEach(function(k){
    if(taken[k]) return;
    var p=D.players[k];
    if(wvFilter!=='ALL'&&p.pos!==wvFilter) return;
    if(wvSearch.trim()&&p.name.toLowerCase().indexOf(wvSearch.toLowerCase())<0) return;
    var st=statLine(p); if(!st||st[0]<3) return;
    var f=forwardScore(k); if(f===null) return;
    var trend=(p.r&&p.s)?(p.r[5]-p.s[5]):0;
    var secure=(p.sn!==undefined)?Math.max(.85,Math.min(1.1,p.sn/60)):1;
    var vor=f-(REPL[p.pos]||0);
    rows.push({k:k,p:p,st:st,f:f,vor:vor,score:vor*secure+trend*.35,trend:trend});
  });
  if(!rows.length){ host.innerHTML='<div class="empty">Nobody available matches.</div>'; cx.textContent=''; return; }
  rows.sort(function(a,b){return b.score-a.score;});
  cx.textContent=rows.length+' available';
  var mx=Math.max.apply(null,rows.slice(0,25).map(function(r){return Math.max(.1,r.score);}));
  host.innerHTML=rows.slice(0,25).map(function(r,i){
    var reasons=[];
    if(r.st[5]>=20) reasons.push('<b>'+r.st[5].toFixed(0)+'%</b> target share');
    if(r.st[3]>=11) reasons.push('<b>'+r.st[3].toFixed(1)+'</b> touches a game');
    if(r.trend>=4) reasons.push('<b>role growing</b> — targets up '+r.trend.toFixed(0)+' points');
    else if(r.trend<=-4) reasons.push('role shrinking');
    if(r.p.sn!==undefined) reasons.push(r.p.sn.toFixed(0)+'% of snaps');
    if(r.p.inj) reasons.push('<span style="color:var(--ac)">'+esc(r.p.inj[0])+'</span>');
    var nx=oppOf(r.p.team,WEEK);
    return '<div class="slotrow" style="border-left-color:'+COL[r.p.pos]+'">'+
      '<span class="slotlab">'+(i+1)+'</span>'+
      '<div class="slotmain"><div class="slotname">'+esc(r.p.name)+'</div>'+
      '<div class="slotmeta">'+r.p.pos+(r.p.d?r.p.d:'')+' '+r.p.team+
        (nx?' &middot; '+(nx.home?'vs ':'@ ')+nx.opp:' &middot; bye')+
        ' &middot; '+r.st[0]+'g '+statSrc(r.p)+' &middot; '+r.f.toFixed(1)+' proj</div>'+
      (reasons.length?'<div class="slotwhy">'+reasons.slice(0,3).join(' &middot; ')+'</div>':'')+
      '<div class="sigbar"><span class="sig"><span style="width:'+Math.max(2,Math.min(100,r.score/mx*100))+'%;background:'+COL[r.p.pos]+'"></span></span></div>'+
      '</div><span class="proj">'+(r.vor>0?'+':'')+r.vor.toFixed(1)+
      '<span class="proju">vs repl</span></span></div>';
  }).join('')+
  '<div class="wcn" style="padding:9px 13px;">Ranked by points above the replacement you could stream '+
  'at that position, not raw points &mdash; otherwise every spare quarterback sits at the top.</div>';
}
function drawDrops(){
  var host=document.getElementById('dropList');
  var roster=myRoster();
  if(!roster.length){ host.innerHTML='<div class="empty">No roster imported.</div>'; return; }
  var rows=roster.map(function(n){
    var k=pkey(n),p=D.players[k];
    if(!p) return {name:n,unknown:true,f:-1};
    var f=forwardScore(k);
    return {name:p.name,p:p,f:f===null?0:f,inj:p.inj,bye:!oppOf(p.team,WEEK)};
  });
  rows.sort(function(a,b){return a.f-b.f;});
  host.innerHTML=rows.slice(0,8).map(function(r){
    var note=r.unknown?'no stats on file — probably a defence or kicker'
      :(r.inj?'injury report: '+esc(r.inj[0]):(r.bye?'on bye this week':''));
    return '<div class="slotrow'+(r.unknown?' benchrow':'')+'" style="border-left-color:'+
      (r.p?COL[r.p.pos]:'var(--ln)')+'">'+
      '<span class="slotlab">'+(r.p?r.p.pos:'?')+'</span>'+
      '<div class="slotmain"><div class="slotname">'+esc(r.name)+'</div>'+
      (note?'<div class="slotwhy">'+note+'</div>':'')+'</div>'+
      '<span class="proj">'+(r.unknown?'—':r.f.toFixed(1))+'<span class="proju">3wk avg</span></span></div>';
  }).join('')+'<div class="wcn" style="padding:9px 13px;">Weakest first. A stashed handcuff or a '+
    'player coming back from injury is worth more than this shows &mdash; the model has no idea about either.</div>';
}
function drawScoring(){
  var host=document.getElementById('scoreGrid'); if(!host||!D.meta.scoring) return;
  var s=D.meta.scoring;
  var groups=[
    ['Passing',[['Yards',s.pass_yd],['TD',s.pass_td],['Interception',s.int],['400 yd bonus',s.pass_400_bonus]]],
    ['Rushing',[['Yards',s.rush_yd],['TD',s.rush_td],['200 yd bonus',s.rush_200_bonus]]],
    ['Receiving',[['Reception',s.rec],['Yards',s.rec_yd],['TD',s.rec_td],['200 yd bonus',s.rec_200_bonus]]],
    ['Other',[['Fumble lost',s.fumble_lost],['Return TD',s.return_td],
              ['2pt',s.rec_2pt]]]
  ];
  host.innerHTML=groups.map(function(g){
    return '<div class="mxcard"><div class="mxt">'+g[0]+'</div>'+g[1].map(function(r){
      return '<div class="mxr"><span>'+r[0]+'</span><span class="mxv">'+r[1]+'</span></div>';
    }).join('')+'</div>';
  }).join('');
}

// ── raw stats sheet ────────────────────────────────────────
var stPos='QB', stSearch='', stRostOnly=false, stSort='pts', stDir=-1;
var STCOLS={
  QB:[['name','Player'],['team','Tm'],['d','Dep'],['g','G'],['cmp','Cmp'],['att','Att'],
      ['pass_yd','Yds'],['pass_td','TD'],['int','Int'],['car','Car'],['rush_yd','RuYd'],
      ['rush_td','RuTD'],['pts','Pts']],
  RB:[['name','Player'],['team','Tm'],['d','Dep'],['g','G'],['car','Car'],['rush_yd','Yds'],
      ['rush_td','TD'],['tgt','Tgt'],['rec','Rec'],['rec_yd','ReYd'],['rec_td','ReTD'],['pts','Pts']],
  WR:[['name','Player'],['team','Tm'],['d','Dep'],['g','G'],['tgt','Tgt'],['rec','Rec'],
      ['rec_yd','Yds'],['rec_td','TD'],['car','Car'],['rush_yd','RuYd'],['pts','Pts']],
  TE:null
};
STCOLS.TE=STCOLS.WR;
function statVal(p,id){
  if(id==='name') return p.name;
  if(id==='team') return p.team;
  if(id==='d') return p.d===undefined?99:p.d;
  var cols=D.meta.tot_cols||[];
  var ix=cols.indexOf(id);
  return (p.t&&ix>=0)?p.t[ix]:0;
}
function drawStats(){
  var head=document.getElementById('stHead'),body=document.getElementById('stBody');
  if(!head) return;
  var cols=STCOLS[stPos]||STCOLS.WR;
  var taken=rosteredKeys();
  var list=[];
  Object.keys(D.players).forEach(function(k){
    var p=D.players[k];
    if(p.pos!==stPos||!p.t) return;
    if(stRostOnly&&!taken[k]) return;
    if(stSearch.trim()&&p.name.toLowerCase().indexOf(stSearch.toLowerCase())<0) return;
    list.push(p);
  });
  list.sort(function(a,b){
    var x=statVal(a,stSort),y=statVal(b,stSort);
    if(typeof x==='string') return x.localeCompare(y)*stDir*-1;
    return (x-y)*stDir;
  });
  head.innerHTML='<tr>'+cols.map(function(cl){
    var act=stSort===cl[0];
    return '<th class="sortable'+(act?' act':'')+'" data-stc="'+cl[0]+'">'+cl[1]+
      (act?'<span class="sar">'+(stDir<0?'▾':'▴')+'</span>':'')+'</th>';
  }).join('')+'</tr>';
  if(!list.length){ body.innerHTML='<tr><td colspan="13" class="empty">Nobody matches.</td></tr>'; return; }
  body.innerHTML=list.slice(0,200).map(function(p){
    return '<tr style="border-left:3px solid '+COL[p.pos]+'">'+cols.map(function(cl){
      var v=statVal(p,cl[0]);
      if(cl[0]==='name') return '<td class="pn">'+esc(p.name)+
        (isInactive(p)?' <span style="color:var(--urg);font-size:9px">'+esc(p.st)+'</span>':'')+'</td>';
      if(cl[0]==='team') return '<td class="mono">'+esc(p.team)+'</td>';
      if(cl[0]==='d') return '<td class="mono">'+(p.d===undefined?'—':p.pos+p.d)+'</td>';
      return '<td class="mono">'+v+'</td>';
    }).join('')+'</tr>';
  }).join('');
  Array.prototype.forEach.call(head.querySelectorAll('[data-stc]'),function(h){
    h.addEventListener('click',function(){
      var id=h.getAttribute('data-stc');
      if(stSort===id) stDir=-stDir; else { stSort=id; stDir=(id==='name'||id==='team')?1:-1; }
      drawStats();
    });
  });
}

// ── scoreboard ─────────────────────────────────────────────
function drawScoreboard(){
  var host=document.getElementById('scoreboard'); if(!host) return;
  document.getElementById('sbWeek').textContent=WEEK;
  var gs=D.games.filter(function(g){return g.w===WEEK;});
  if(!gs.length){ host.innerHTML='<div class="empty">No games scheduled for week '+WEEK+'.</div>'; return; }
  var done=gs.filter(function(g){return g.done;}).length;
  document.getElementById('sbCx').textContent=done?done+' of '+gs.length+' final':gs.length+' scheduled';
  host.innerHTML=gs.map(function(g){
    var line=(g.t!==undefined)?('O/U '+g.t+' &middot; '+(g.s>0?g.h+' -'+g.s:g.a+' -'+Math.abs(g.s))):'no line';
    var score=g.done
      ? '<span class="sbsc">'+(g.as!==undefined?g.as:'')+' &ndash; '+(g.hs!==undefined?g.hs:'')+'</span>'
      : '<span class="sbimp">'+(g.ia!==undefined?g.ia.toFixed(1)+' / '+g.ih.toFixed(1):'—')+'</span>';
    return '<div class="sbrow"><span class="sbt">'+g.a+' @ '+g.h+'</span>'+
      '<span class="sbl">'+line+'</span>'+score+'</div>';
  }).join('')+'<div class="wcn" style="padding:9px 13px;">Numbers on the right are implied team points until a game is final, then the score.</div>';
}

function drawSources(){
  document.getElementById('srcInfo').innerHTML=
    'Season <b>'+D.meta.season+'</b>, week <b>'+D.meta.week+'</b>.<br>'+
    'Weeks played: '+(D.meta.played&&D.meta.played.length?D.meta.played.join(', '):'none yet')+'<br>'+
    'Opportunity values under your scoring: <b>'+D.meta.ppc+'</b> per carry, <b>'+D.meta.ppt+'</b> per target, <b>'+(D.meta.ppa||'—')+'</b> per pass attempt<br>'+
    'Defence ratings from <b>'+D.meta.defense_season+'</b><br>'+
    'Players: '+Object.keys(D.players).length+' &middot; games: '+D.games.length+'<br>'+
    'Built '+new Date(D.meta.built).toLocaleString();
}
function drawTeamSel(){
  var s=document.getElementById('myTeamSel'); s.innerHTML='';
  var ks=Object.keys(ROSTERS);
  if(!ks.length){ s.innerHTML='<option>no roster imported</option>'; return; }
  s.innerHTML=ks.map(function(k){
    return '<option value="'+esc(k)+'"'+(k===MYTEAM?' selected':'')+'>'+esc(k)+' ('+ROSTERS[k].length+')</option>';
  }).join('');
}

// ── import ─────────────────────────────────────────────────
function parseCSV(txt){
  var lines=txt.trim().split(/\r?\n/);
  if(lines.length<2) return null;
  var head=lines[0].toLowerCase();
  if(head.indexOf('player')<0||head.indexOf('team')<0) return null;
  var cols=head.split(',');
  var iTeam=cols.indexOf('team'), iPlayer=cols.indexOf('player'), iPos=cols.indexOf('pos');
  var out={};
  for(var i=1;i<lines.length;i++){
    var f=lines[i].match(/("([^"]*)"|[^,]*)/g);
    if(!f) continue;
    f=f.filter(function(x,ix){return ix%2===0;}).map(function(x){return x.replace(/^"|"$/g,'').trim();});
    var t=f[iTeam],n=f[iPlayer];
    if(!t||!n) continue;
    (out[t]=out[t]||[]).push(n);
  }
  return Object.keys(out).length?out:null;
}
function runImport(){
  var msg=document.getElementById('impMsg');
  var r=parseCSV(document.getElementById('impBox').value||'');
  if(!r){ msg.textContent='That does not look like the draft app CSV export.'; return; }
  ROSTERS=r;
  var ks=Object.keys(r);
  MYTEAM=ks.filter(function(k){return /my team/i.test(k);})[0]||ks[0];
  var all=0,miss=[];
  ks.forEach(function(k){ r[k].forEach(function(n){ all++; if(!D.players[pkey(n)]) miss.push(n); }); });
  saveRoster(); drawTeamSel(); redraw();
  msg.innerHTML=ks.length+' teams, '+all+' players. '+(all-miss.length)+' matched.'+
    (miss.length?' <span style="color:var(--ac)">No stats for: '+miss.slice(0,6).map(esc).join(', ')+
      (miss.length>6?' and '+(miss.length-6)+' more':'')+' — usually defences, kickers or rookies.</span>':'');
}
function saveRoster(){
  try{ localStorage.setItem('swrroster',JSON.stringify({rosters:ROSTERS,mine:MYTEAM})); }catch(e){}
}

// ── theme / scale ──────────────────────────────────────────
function applyTheme(t){
  THEME=(['dark','slate','ember','paper'].indexOf(t)>-1)?t:'dark';
  COL=COLSETS[THEME];
  if(document.documentElement) document.documentElement.setAttribute('data-theme',THEME);
  try{ localStorage.setItem('swrtheme',THEME); }catch(e){}
}
function applyScale(s){
  TSCALE=Math.max(.9,Math.min(1.45,s||1));
  try{
    var b=document.body;
    if(b){ if(TSCALE===1) b.style.removeProperty('zoom'); else b.style.zoom=TSCALE; }
    localStorage.setItem('swrscale',String(TSCALE));
  }catch(e){}
}
function drawThemes(){
  var g=document.getElementById('thGrid'); if(!g) return;
  g.innerHTML='';
  THEMEMETA.forEach(function(m){
    var b=document.createElement('button');
    b.className='thb'+(THEME===m[0]?' on':'');
    b.innerHTML='<span class="thsw">'+m[2].map(function(x){return '<span style="background:'+x+'"></span>';}).join('')+
      '</span><span class="thn">'+m[1]+'</span>';
    b.addEventListener('click',function(){ applyTheme(m[0]); drawThemes(); redraw(); });
    g.appendChild(b);
  });
  Array.prototype.forEach.call(document.querySelectorAll('[data-sz]'),function(b){
    b.className=(Math.abs(parseFloat(b.getAttribute('data-sz'))-TSCALE)<.01)?'on':'';
  });
}

// ── wiring ─────────────────────────────────────────────────
function wireStatic(){
  Array.prototype.forEach.call(document.querySelectorAll('.tab'),function(t){
    t.addEventListener('click',function(){
      Array.prototype.forEach.call(document.querySelectorAll('.tab'),function(x){x.classList.remove('on');});
      t.classList.add('on');
      Array.prototype.forEach.call(document.querySelectorAll('.panel'),function(p){p.hidden=true;});
      var el=document.getElementById('p-'+t.getAttribute('data-t')); if(el) el.hidden=false;
    });
  });
  document.getElementById('impRun').addEventListener('click',runImport);
  document.getElementById('impClear').addEventListener('click',function(){
    ROSTERS={};MYTEAM=null;saveRoster();drawTeamSel();redraw();
    document.getElementById('impMsg').textContent='Roster cleared.';
  });
  document.getElementById('myTeamSel').addEventListener('change',function(e){
    MYTEAM=e.target.value;saveRoster();redraw();
  });
  document.getElementById('addBtn').addEventListener('click',function(){
    var n=(document.getElementById('addName').value||'').trim();
    var m=document.getElementById('addMsg');
    if(!n) return;
    if(!D.players[pkey(n)]){ m.textContent='No stats found for "'+n+'".'; return; }
    if(!MYTEAM){ MYTEAM='My Team'; }
    ROSTERS[MYTEAM]=(ROSTERS[MYTEAM]||[]).concat([n]);
    document.getElementById('addName').value='';
    saveRoster(); drawTeamSel(); redraw();
    m.textContent='Added '+D.players[pkey(n)].name+'.';
  });
  Array.prototype.forEach.call(document.querySelectorAll('[data-st]'),function(b){
    b.addEventListener('click',function(){
      Array.prototype.forEach.call(document.querySelectorAll('[data-st]'),function(x){x.className='btn s g';});
      b.className='btn s'; stPos=b.getAttribute('data-st'); stSort='pts'; stDir=-1; drawStats();
    });
  });
  document.getElementById('stSearch').addEventListener('input',function(e){stSearch=e.target.value;drawStats();});
  document.getElementById('stMine').addEventListener('click',function(){
    stRostOnly=false;this.className='on';document.getElementById('stRost').className='';drawStats();});
  document.getElementById('stRost').addEventListener('click',function(){
    stRostOnly=true;this.className='on';document.getElementById('stMine').className='';drawStats();});
  Array.prototype.forEach.call(document.querySelectorAll('[data-wv]'),function(b){
    b.addEventListener('click',function(){
      Array.prototype.forEach.call(document.querySelectorAll('[data-wv]'),function(x){x.className='btn s g';});
      b.className='btn s'; wvFilter=b.getAttribute('data-wv'); drawWaivers();
    });
  });
  document.getElementById('wvSearch').addEventListener('input',function(e){
    wvSearch=e.target.value; drawWaivers();
  });
  ['cmpA','cmpB'].forEach(function(id){
    document.getElementById(id).addEventListener('change',drawCompare);
  });
  Array.prototype.forEach.call(document.querySelectorAll('[data-sz]'),function(b){
    b.addEventListener('click',function(){ applyScale(parseFloat(b.getAttribute('data-sz'))); drawThemes(); });
  });
  var pop=document.getElementById('pop');
  Array.prototype.forEach.call(document.querySelectorAll('.info'),function(b){
    b.addEventListener('click',function(ev){
      ev.stopPropagation();
      var k=b.getAttribute('data-info');
      if(pop.classList.contains('on')&&pop.getAttribute('data-k')===k){pop.classList.remove('on');return;}
      pop.innerHTML=INFO[k]||''; pop.setAttribute('data-k',k); pop.classList.add('on');
      var r=b.getBoundingClientRect(),pw=Math.min(330,window.innerWidth-24);
      pop.style.width=pw+'px';
      pop.style.left=Math.min(Math.max(8,r.left-pw/2+r.width/2),window.innerWidth-pw-8)+'px';
      var top=r.bottom+8;
      if(top+pop.offsetHeight>window.innerHeight-8) top=Math.max(8,r.top-pop.offsetHeight-8);
      pop.style.top=top+'px';
    });
  });
  document.addEventListener('click',function(){pop.classList.remove('on');});
  pop.addEventListener('click',function(e){e.stopPropagation();});
}

if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',boot);
else boot();

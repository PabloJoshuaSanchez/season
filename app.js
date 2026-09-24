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
 wtable:"<p>Every free agent, sortable on any column.</p><p><b>Rise</b> (0&ndash;100, 50 = no change): how fast his value is growing &mdash; see the chart above for what's driving it.</p><p><b>+/- you</b>: how much he'd add to your best starting lineup each week, after cutting whoever costs you least. Zero means he wouldn't start for you.</p><p><b>Need</b>: how well he fits your weakest spots &mdash; 60% how short you are at his position, 40% how he compares with your starter there.</p><p><b>Claim</b>: an <i>estimate</i> of the chance another team grabs him, from how much he'd improve each of their lineups, weighted up for losing teams and rising players. A heuristic, not a real probability.</p><p><b>Proj</b> this week &middot; <b>Avg</b> and <b>Last</b> are actual points this season &middot; <b>vs proj</b> is season points against the projection made before each week.</p><p>IR, PS, O, D and Q flag injured reserve, practice squad and injury status.</p>",
 weekly:"<p>This team's score each completed week against the league average and the week's top score. From ESPN's matchup data.</p>",
 strength:"<p>Each position's starters against the league-average starter, over the next four weeks of projections. Bars scale to the widest gap in the league at that position.</p>",
 pvabars:"<p>Season points against the projection recorded before each week &mdash; never rewritten afterwards. Over the marker is beating the forecast.</p>",
 rising:"<p>Players whose <b>role</b> is growing faster than their points: target share up, touches up, beating their projection. By the time the box score catches up, someone else has claimed him.</p><p>Built from four signals that lead scoring &mdash; beating projection, usage growth, climbing the depth chart, and a teammate ahead of him getting hurt &mdash; minus his own injury risk. The chart shows which ones are driving each player.</p><p>Only players projecting at least 3 points a week, so you're not chasing someone whose bigger role still amounts to nothing.</p>",
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
            pf:rec.pointsFor||0,pa:rec.pointsAgainst||0,hasRecord:rec.wins!==undefined,
            roster:roster,owners:t.owners||[],weekly:{}};
  });
  // weekly scores from the schedule - completed periods only
  var curP=(raw.status&&raw.status.currentMatchupPeriod)||null,byId={};
  teams.forEach(function(t){byId[t.id]=t;});
  (raw.schedule||[]).forEach(function(m){
    var pid=m.matchupPeriodId;if(pid==null)return;
    if(curP&&pid>=curP)return;
    [m.away,m.home].forEach(function(s){
      if(s&&byId[s.teamId]&&s.totalPoints)byId[s.teamId].weekly[pid]=s.totalPoints;});
  });
  return {teams:teams,myTeamId:raw.myTeamId!=null?raw.myTeamId:null,fetched:raw.fetched||null,period:curP};
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

// ── rising value ───────────────────────────────────────────
// Five parts, kept separate so the chart can show WHY a player is rising:
//  perf   - scoring above the projection recorded before each week
//  usage  - target share and touches up on his own baseline
//  depth  - climbed the depth chart since last week
//  opp    - someone ahead of him at his position is hurt
//  risk   - his own injury, IR or practice-squad status (negative)
// A player with none of the first four is not rising, however good he is.
function clamp(x,a,b){return Math.max(a,Math.min(b,x));}
var TEAMPOS=null;
function buildTeamPos(){
  TEAMPOS={};
  Object.keys(D.players).forEach(function(k){var p=D.players[k];if(!p.team||p.d==null)return;
    (TEAMPOS[p.team+'|'+p.pos]=TEAMPOS[p.team+'|'+p.pos]||[]).push(k);});
}
function injOpp(k){
  var p=D.players[k];if(!p||p.d==null)return {v:0,who:null};
  var mates=(TEAMPOS[p.team+'|'+p.pos]||[]),v=0,who=null;
  mates.forEach(function(m){if(m===k)return;var q=D.players[m];if(q.d==null||q.d>=p.d)return;
    var hurt=q.st==='RES'||(q.inj&&(q.inj[0]==='Out'||q.inj[0]==='Doubtful'));
    if(!hurt)return;var gap=p.d-q.d;v+=gap===1?6:(gap===2?3:1);if(!who||gap===1)who=q.name;});
  return {v:Math.min(9,v),who:who};
}
function riseParts(k){
  var p=D.players[k];if(!p)return null;
  var cur=p.r||p.s,base=p.b,pv=pvaFor(k);
  var pt={perf:0,usage:0,depth:0,opp:0,risk:0};
  // one big game is a spike, not a trend - half weight until there are two
  if(pv&&pv.n)pt.perf=clamp(pv.diff/pv.n,-6,8)*1.2*(pv.n>=2?1:.5);
  if(cur&&base&&p.s)pt.usage=clamp(((cur[5]||0)-(base[5]||0))*.45+((cur[3]||0)-(base[3]||0))*.55,-6,9);
  if(p.pd!=null&&p.d!=null){var mv=p.pd-p.d;pt.depth=mv>0?Math.min(9,mv*3):Math.max(-6,mv*2.5);}
  var io=injOpp(k);pt.opp=io.v;
  var inj=p.inj?p.inj[0]:'';
  pt.risk=(p.st==='RES'?-10:0)+(p.st==='DEV'?-6:0)+({Questionable:-1.5,Doubtful:-4,Out:-8}[inj]||0);
  // Rising VALUE, not just rising role: a player going from nothing to slightly
  // more than nothing isn't worth a claim. Scale the upside by how much he
  // matters - using the better of his projection and what he's actually been
  // scoring, because an injury opening (Drew Lock with Darnold out) shows up
  // in his real points before the depth-chart projection catches up.
  var st=actualStats(k),lvl=Math.max(val(k)||0,(st.avg||0)*(st.n>=2?1:.5));
  var rel=clamp((lvl-2)/8,.15,1);
  var up=Math.max(0,pt.perf)+Math.max(0,pt.usage)+Math.max(0,pt.depth)+pt.opp;
  var down=Math.min(0,pt.perf)+Math.min(0,pt.usage)+Math.min(0,pt.depth)+pt.risk;
  var tot=up*rel+down;
  return {pt:pt,tot:tot,rel:rel,score:Math.round(clamp(50+tot*3,0,100)),oppWho:io.who};
}

// ── per-player waiver metrics, computed once per league load ─
function lineupSlots(keys){
  var by={QB:[],RB:[],WR:[],TE:[]};
  keys.forEach(function(k){var p=D.players[k];if(!p||!by[p.pos])return;var v=val(k);if(v!==null)by[p.pos].push(v);});
  for(var q in by)by[q].sort(function(a,b){return b-a;});
  var fl=by.RB.slice(2).concat(by.WR.slice(2),by.TE.slice(1)).sort(function(a,b){return b-a;}).slice(0,2);
  return {QB:by.QB.slice(0,1),RB:by.RB.slice(0,2),WR:by.WR.slice(0,2),TE:by.TE.slice(0,1),FLEX:fl};
}
function actualStats(k){
  var wks=(D.meta.played||[]),sum=0,n=0,last=null,lw=wks.length?wks[wks.length-1]:null;
  wks.forEach(function(w){var a=actualFor(k,w);if(a!==null){sum+=a;n++;}});
  if(lw!==null)last=actualFor(k,lw);
  return {avg:n?sum/n:null,n:n,last:last};
}
var WCACHE={key:null,rows:null};
function waiverRows(){
  var t=myTeam();if(!t||!LG)return [];
  var ck=[LG.fetched,LG.source,MYID,WEEK].join('|');
  if(WCACHE.key===ck)return WCACHE.rows;
  if(!TEAMPOS)buildTeamPos();
  var mine=keysOf(t),base=lineupValue(mine),taken=rosteredSet();
  var droppable=t.roster.filter(function(r){return D.players[r.k]&&r.pos!=='K'&&r.pos!=='DST';}).map(function(r){return r.k;});
  // my need by position, scaled against how far apart the league is at each spot
  var avg=leagueAvg(),mineS=starterByPos(mine),spread={};
  POSN.forEach(function(p){var m=1;LG.teams.forEach(function(tm){m=Math.max(m,Math.abs(starterByPos(keysOf(tm))[p]-avg[p]));});spread[p]=m;});
  var need={};POSN.forEach(function(p){need[p]=clamp(50+(avg[p]-mineS[p])/spread[p]*50,0,100);});
  var slots=lineupSlots(mine),ref={};
  POSN.forEach(function(p){var s=slots[p],worst=s.length?s[s.length-1]:0;
    if((p==='RB'||p==='WR'||p==='TE')&&slots.FLEX.length)worst=Math.min(worst||99,slots.FLEX[slots.FLEX.length-1]);
    ref[p]=worst||1;});
  var others=LG.teams.filter(function(x){return x.id!==t.id;}).map(function(x){var ks=keysOf(x);return {t:x,ks:ks,base:lineupValue(ks)};});
  var rows=[];
  Object.keys(D.players).forEach(function(k){
    if(taken[k])return;var p=D.players[k];if(POSN.indexOf(p.pos)<0)return;
    var v=val(k),st=actualStats(k);
    if(v===null&&st.n===0)return;
    var gain=0,drop=null;
    if(v!==null&&v>=1){
      var depthW=(p.pos==='RB'||p.pos==='WR')?0.35:0,best=null;
      droppable.forEach(function(d){var set=mine.filter(function(x){return x!==d;});set.push(k);
        var lg=lineupValue(set)-base,sc=lg+depthW*(v-(val(d)||0));
        if(!best||sc>best.sc)best={d:d,lg:lg,sc:sc};});
      if(best){gain=Math.max(0,best.lg);drop=best.d;}
    }
    var r=riseParts(k);
    var fit=v===null?0:clamp(v/ref[p.pos]*70,0,100);
    var match=Math.round(.6*need[p.pos]+.4*fit);
    // chance another team claims him: how much he helps each of them, more if
    // they're losing, more again if he's rising and therefore being noticed
    var q=1;
    if(v!==null&&v>=1)others.forEach(function(o){
      var g=lineupValue(o.ks.concat([k]))-o.base,pr=g>0.3?Math.min(.5,g/(g+4)):.015;
      if(o.t.hasRecord&&o.t.losses>o.t.wins)pr*=1.25;q*=(1-Math.min(.7,pr));});
    var claim=v===null?1:clamp((1-q)*(.55+r.score/100*.9)*100,1,97);
    rows.push({k:k,p:p,v:v,proj:projFor(k,WEEK),avg:st.avg,last:st.last,n:st.n,
      pva:(pvaFor(k)||{}).diff,gain:gain,drop:drop,match:match,claim:Math.round(claim),rise:r});
  });
  WCACHE={key:ck,rows:rows};
  return rows;
}

// ── waivers tab ────────────────────────────────────────────
var WV={pos:'ALL',q:'',hide:true,sort:'rise',dir:-1,all:false};
var WCOLS=[
  ['name','Player',function(r){return r.p.name;}],
  ['rise','Rise',function(r){return r.rise.score;}],
  ['gain','+/- you',function(r){return r.gain;}],
  ['match','Need',function(r){return r.match;}],
  ['claim','Claim',function(r){return r.claim;}],
  ['proj','Proj',function(r){return r.proj;}],
  ['avg','Avg',function(r){return r.avg;}],
  ['last','Last',function(r){return r.last;}],
  ['pva','vs proj',function(r){return r.pva;}]];
function pill(v,good,bad){
  var bg=v>=good?'rgba(90,168,122,.22)':v<=bad?'rgba(217,83,79,.18)':'var(--s3)';
  var fg=v>=good?'var(--ok)':v<=bad?'var(--urg)':'var(--tx)';
  return '<span class="pill" style="background:'+bg+';color:'+fg+'">'+v+'</span>';
}
function fmt(v,d,plus){if(v===null||v===undefined||isNaN(v))return '<span style="color:var(--dimr)">—</span>';
  return (plus&&v>0?'+':'')+v.toFixed(d);}
function drawWaiverTable(){
  var head=document.getElementById('wtHead'),body=document.getElementById('wtBody'),cx=document.getElementById('wvCx'),more=document.getElementById('wtMore');
  if(!myTeam()){body.innerHTML='<tr><td colspan="9" class="empty" style="text-align:center">Load your league in Setup.</td></tr>';head.innerHTML='';more.innerHTML='';return;}
  var rows=waiverRows().filter(function(r){
    if(WV.pos!=='ALL'&&r.p.pos!==WV.pos)return false;
    if(WV.hide&&(r.p.st==='RES'||r.p.st==='DEV'))return false;
    if(WV.q&&r.p.name.toLowerCase().indexOf(WV.q.toLowerCase())<0)return false;
    return true;});
  var col=WCOLS.filter(function(x){return x[0]===WV.sort;})[0];
  rows.sort(function(a,b){var x=col[2](a),y=col[2](b);
    if(typeof x==='string')return x.localeCompare(y)*(WV.dir<0?-1:1);
    if(x==null)return 1;if(y==null)return -1;return (x-y)*WV.dir;});
  cx.textContent=rows.length+' available';
  head.innerHTML='<tr>'+WCOLS.map(function(x){return '<th class="'+(WV.sort===x[0]?'act':'')+'" data-ws="'+x[0]+'">'+x[1]+
    (WV.sort===x[0]?(WV.dir<0?' ▾':' ▴'):'')+'</th>';}).join('')+'</tr>';
  var show=WV.all?rows:rows.slice(0,60);
  body.innerHTML=show.map(function(r){
    var flag=r.p.st==='RES'?'IR':r.p.st==='DEV'?'PS':(r.p.inj?({Out:'O',Doubtful:'D',Questionable:'Q'}[r.p.inj[0]]||''):'');
    var dp=r.drop&&r.gain>0.05?D.players[r.drop]:null;
    return '<tr><td style="border-left:3px solid '+COL[r.p.pos]+'"><b>'+esc(r.p.name)+(flag?'<span class="flagt">'+flag+'</span>':'')+'</b>'+
      '<span>'+r.p.pos+(r.p.d||'')+' '+r.p.team+(dp?' · cut '+esc(dp.name.split(' ').slice(-1)[0]):'')+'</span></td>'+
      '<td>'+pill(r.rise.score,60,40)+'</td>'+
      '<td style="color:'+(r.gain>0.05?'var(--ok)':'var(--dimr)')+'">'+(r.gain>0.05?'+'+r.gain.toFixed(1):'0.0')+'</td>'+
      '<td>'+pill(r.match,65,30)+'</td>'+
      '<td>'+(r.v===null?'—':r.claim+'%')+'</td>'+
      '<td>'+fmt(r.proj,1)+'</td><td>'+fmt(r.avg,1)+'</td><td>'+fmt(r.last,1)+'</td>'+
      '<td style="color:'+(r.pva>0?'var(--ok)':r.pva<0?'var(--urg)':'var(--dimr)')+'">'+fmt(r.pva,1,true)+'</td></tr>';
  }).join('')||'<tr><td colspan="9" class="empty">Nobody matches.</td></tr>';
  more.innerHTML=(!WV.all&&rows.length>60)?'<button class="btn s g" id="wtAll">Show all '+rows.length+'</button>':'';
  var b=document.getElementById('wtAll');if(b)b.addEventListener('click',function(){WV.all=true;drawWaiverTable();});
  Array.prototype.forEach.call(head.querySelectorAll('[data-ws]'),function(h){h.addEventListener('click',function(){
    var id=h.getAttribute('data-ws');if(WV.sort===id)WV.dir=-WV.dir;else{WV.sort=id;WV.dir=id==='name'?1:-1;}drawWaiverTable();});});
}
var RCOL={perf:'#5aa87a',usage:'#4d9fd1',depth:'#b58be0',opp:'#e0a832'};
function drawRiseChart(){
  var host=document.getElementById('riseChart');
  if(!myTeam()){host.innerHTML='<div class="empty">Load your league in Setup.</div>';return;}
  var rows=waiverRows().filter(function(r){return r.v!==null&&r.v>=3&&r.rise.tot>2&&r.p.st!=='RES'&&r.p.st!=='DEV';})
    .sort(function(a,b){return b.rise.tot-a.rise.tot;}).slice(0,10);
  if(!rows.length){host.innerHTML='<div class="empty">No free agent has a growing role right now.</div>';return;}
  var mx=Math.max.apply(null,rows.map(function(r){var s=0;for(var x in RCOL)s+=Math.max(0,r.rise.pt[x])*r.rise.rel;return s;}))||1;
  host.innerHTML=rows.map(function(r){
    var segs='';for(var x in RCOL){var w=Math.max(0,r.rise.pt[x])*r.rise.rel/mx*100;if(w>0)segs+='<span style="width:'+w+'%;background:'+RCOL[x]+'"></span>';}
    return '<div class="rbar"><span class="rn">'+esc(r.p.name)+' <span style="font-size:9px;color:'+COL[r.p.pos]+'">'+r.p.pos+'</span></span>'+
      '<span class="rt">'+segs+'</span><span class="rv">'+r.rise.score+'</span></div>';}).join('')+
    '<div class="legend"><span><i style="background:'+RCOL.perf+'"></i>beating projection</span>'+
    '<span><i style="background:'+RCOL.usage+'"></i>usage up</span><span><i style="background:'+RCOL.depth+'"></i>climbed depth chart</span>'+
    '<span><i style="background:'+RCOL.opp+'"></i>teammate ahead hurt</span></div>';
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


// ── insights: one team at a time ───────────────────────────
var INSID=null;
function projRank(){
  var rk=LG.teams.map(function(t){return {id:t.id,v:lineupValue(keysOf(t))};}).sort(function(a,b){return b.v-a.v;});
  var out={};rk.forEach(function(x,i){out[x.id]={rank:i+1,v:x.v};});return out;
}
function lineChart(series,labels,h){
  // series: [{name,color,dash,vals:[]}] ; small hand-rolled SVG, no library
  var W=320,H=h||150,pl=30,pr=8,pt=10,pb=22,all=[];
  series.forEach(function(s){s.vals.forEach(function(v){if(v!=null)all.push(v);});});
  if(!all.length)return '';
  var lo=Math.floor(Math.min.apply(null,all)*0.9/10)*10,hi=Math.ceil(Math.max.apply(null,all)*1.05/10)*10;
  if(hi===lo)hi=lo+10;
  var n=labels.length,x=function(i){return pl+(n<2?(W-pl-pr)/2:i*(W-pl-pr)/(n-1));},
      y=function(v){return pt+(H-pt-pb)*(1-(v-lo)/(hi-lo));};
  var g='';
  [lo,(lo+hi)/2,hi].forEach(function(v){g+='<line x1="'+pl+'" x2="'+(W-pr)+'" y1="'+y(v)+'" y2="'+y(v)+'" stroke="var(--ln)" stroke-width="1"/>'+
    '<text x="'+(pl-4)+'" y="'+(y(v)+3)+'" text-anchor="end">'+Math.round(v)+'</text>';});
  labels.forEach(function(l,i){g+='<text x="'+x(i)+'" y="'+(H-6)+'" text-anchor="middle">'+l+'</text>';});
  series.forEach(function(s){
    var pts=[];s.vals.forEach(function(v,i){if(v!=null)pts.push(x(i)+','+y(v));});
    if(pts.length>1)g+='<polyline points="'+pts.join(' ')+'" fill="none" stroke="'+s.color+'" stroke-width="2"'+(s.dash?' stroke-dasharray="4 3"':'')+'/>';
    s.vals.forEach(function(v,i){if(v!=null)g+='<circle cx="'+x(i)+'" cy="'+y(v)+'" r="3" fill="'+s.color+'"/>';});
  });
  return '<svg class="line" viewBox="0 0 '+W+' '+H+'" width="100%" preserveAspectRatio="xMidYMid meet">'+g+'</svg>'+
    '<div class="legend">'+series.map(function(s){return '<span><i style="background:'+s.color+'"></i>'+esc(s.name)+'</span>';}).join('')+'</div>';
}
function drawInsights(){
  var sel=document.getElementById('insTeam');
  if(!LG){sel.innerHTML='<option>load your league first</option>';
    ['insKpi','insNotes','insWeekly','insStrength','insPva','insFlags'].forEach(function(id){document.getElementById(id).innerHTML='';});
    document.getElementById('insNotes').innerHTML='<div class="empty">Load your league in Setup.</div>';return;}
  if(INSID==null||!teamById(INSID))INSID=MYID;
  sel.innerHTML=LG.teams.map(function(t){return '<option value="'+esc(t.id)+'"'+(t.id===INSID?' selected':'')+'>'+
    esc(t.name)+(t.id===MYID?' (you)':'')+'</option>';}).join('');
  var t=teamById(INSID),ks=keysOf(t),pr=projRank()[t.id],avg=leagueAvg(),s=starterByPos(ks);
  var pvaSum=0,pvaN=0;ks.forEach(function(k){var x=pvaFor(k);if(x){pvaSum+=x.diff;pvaN++;}});
  var rec=t.hasRecord?t.wins+'-'+t.losses+(t.ties?'-'+t.ties:''):'—';
  var standRank=null;
  if(t.hasRecord){var st=LG.teams.slice().sort(function(a,b){return (b.wins-a.wins)||(b.pf-a.pf);});
    st.forEach(function(x,i){if(x.id===t.id)standRank=i+1;});}
  var N=LG.teams.length;
  var k=[['Record',rec,standRank?'#'+standRank+' of '+N:'',standRank&&standRank<=N/3?'good':(standRank&&standRank>2*N/3?'bad':'')],
    ['Points for',t.hasRecord?t.pf.toFixed(1):'—',t.hasRecord&&Object.keys(t.weekly).length?(t.pf/Object.keys(t.weekly).length).toFixed(1)+' a week':'',''],
    ['Projected lineup',pr.v.toFixed(1),'#'+pr.rank+' of '+N+' /wk',pr.rank<=N/3?'good':(pr.rank>2*N/3?'bad':'')],
    ['Vs projection',(pvaSum>=0?'+':'')+pvaSum.toFixed(1),pvaN?'across '+pvaN+' players':'no results yet',pvaSum>5?'good':(pvaSum<-5?'bad':'')]];
  document.getElementById('insKpi').innerHTML=k.map(function(x){return '<div class="kpi '+x[3]+'"><div class="kl">'+x[0]+'</div>'+
    '<div class="kv">'+x[1]+'</div><div class="ks">'+x[2]+'</div></div>';}).join('');

  // what stands out - plain sentences, ranked by how actionable they are
  var notes=[],isMe=t.id===MYID;
  var worst=null,best=null;POSN.forEach(function(p){var d=s[p]-avg[p];if(!worst||d<worst[1])worst=[p,d];if(!best||d>best[1])best=[p,d];});
  if(worst&&worst[1]<-1.5){
    var fits=isMe?waiverRows().filter(function(r){return r.p.pos===worst[0]&&r.gain>0.3;}).sort(function(a,b){return b.gain-a.gain;}).slice(0,2):[];
    notes.push(['var(--urg)','Thin at <b>'+worst[0]+'</b>: '+worst[1].toFixed(1)+' a week below the league-average starter.'+
      (isMe?(fits.length?' Best free-agent fits: '+fits.map(function(f){return '<b>'+esc(f.p.name)+'</b> (+'+f.gain.toFixed(1)+')';}).join(', ')+'.':' No free agent fixes it &mdash; look at Trades.')
           :' Expect them to shop for one &mdash; a trade angle if you\'re deep there.')]);
  }
  if(best&&best[1]>1.5)notes.push(['var(--ok)','Deepest at <b>'+best[0]+'</b>: +'+best[1].toFixed(1)+' over the league average.'+
    (isMe?' That\'s your trade currency.':' Somewhere they can afford to deal from.')]);
  if(t.hasRecord&&standRank&&Math.abs(standRank-pr.rank)>=Math.ceil(N/3)){
    notes.push(['var(--ac)',standRank>pr.rank?'<b>Better than the record says.</b> '+rec+' but the #'+pr.rank+' projected lineup &mdash; likely to climb.'
      :'<b>Record is ahead of the roster.</b> '+rec+' with the #'+pr.rank+' projected lineup &mdash; some of that is schedule and luck.']);}
  var pl=ks.map(function(x){return {k:x,p:D.players[x],pv:pvaFor(x)};}).filter(function(x){return x.pv;});
  pl.sort(function(a,b){return b.pv.diff-a.pv.diff;});
  if(pl.length&&pl[0].pv.diff>6)notes.push(['var(--ok)','<b>'+esc(pl[0].p.name)+'</b> is +'+pl[0].pv.diff.toFixed(1)+' over projection. '+
    (isMe?'Sell-high candidate if the usage doesn\'t back it up.':'Their owner will value him highly right now.')]);
  if(pl.length&&pl[pl.length-1].pv.diff<-6){var lo=pl[pl.length-1];
    notes.push(['var(--urg)','<b>'+esc(lo.p.name)+'</b> is '+lo.pv.diff.toFixed(1)+' under projection. '+
      (isMe?'Check whether the role changed before you give up on him.':'A buy-low target if his role is intact.')]);}
  ks.forEach(function(x){var p=D.players[x];if(p.pd!=null&&p.d!=null&&p.d>p.pd&&p.pd<=2)
    notes.push(['var(--urg)','<b>'+esc(p.name)+'</b> slipped from '+p.pos+p.pd+' to '+p.pos+p.d+' on the depth chart.']);});
  document.getElementById('insNotes').innerHTML=notes.length?notes.slice(0,6).map(function(n){
    return '<div class="note"><span class="dot" style="background:'+n[0]+';margin-top:5px"></span><div>'+n[1]+'</div></div>';}).join('')
    :'<div class="empty">Nothing unusual about this roster right now.</div>';

  // weekly points vs the league
  var periods={};LG.teams.forEach(function(x){Object.keys(x.weekly).forEach(function(w){periods[w]=1;});});
  var P=Object.keys(periods).map(Number).sort(function(a,b){return a-b;});
  if(P.length){
    var lgAvg=P.map(function(w){var s2=0,n=0;LG.teams.forEach(function(x){if(x.weekly[w]!=null){s2+=x.weekly[w];n++;}});return n?s2/n:null;});
    var hiT=P.map(function(w){var m=null;LG.teams.forEach(function(x){if(x.weekly[w]!=null&&(m===null||x.weekly[w]>m))m=x.weekly[w];});return m;});
    document.getElementById('insWeekly').innerHTML=lineChart([
      {name:t.name,color:'var(--ac)',vals:P.map(function(w){return t.weekly[w]!=null?t.weekly[w]:null;})},
      {name:'League average',color:'var(--dim)',dash:1,vals:lgAvg},
      {name:'Week\'s best',color:'var(--ok)',dash:1,vals:hiT}],P.map(function(w){return 'W'+w;}));
  } else document.getElementById('insWeekly').innerHTML='<div class="empty">Weekly scores come from ESPN &mdash; load the league from ESPN (not the draft CSV) to see them.</div>';

  // strength by position: diverging bars against the league average
  var mx={};POSN.forEach(function(p){var m=1;LG.teams.forEach(function(x){m=Math.max(m,Math.abs(starterByPos(keysOf(x))[p]-avg[p]));});mx[p]=m;});
  document.getElementById('insStrength').innerHTML=POSN.map(function(p){
    var d=s[p]-avg[p],w=Math.min(50,Math.abs(d)/mx[p]*50);
    return '<div class="div"><span class="dl" style="color:'+COL[p]+'">'+p+'</span><span class="dt"><span class="dm"></span>'+
      '<span class="df" style="'+(d>=0?'left:50%':'right:50%')+';width:'+w+'%;background:'+(d>=0?'var(--ok)':'var(--urg)')+'"></span></span>'+
      '<span class="dv" style="color:'+(d>=0?'var(--ok)':'var(--urg)')+'">'+(d>=0?'+':'')+d.toFixed(1)+'</span></div>';}).join('')+
    '<div class="legend"><span>Left of centre: below the league-average starter. Right: above.</span></div>';

  // bullet chart: bar = actual, marker = what was projected beforehand
  if(pl.length){
    var top=Math.max.apply(null,pl.map(function(x){return Math.max(x.pv.act,x.pv.proj);}))||1;
    document.getElementById('insPva').innerHTML=pl.map(function(x){var good=x.pv.diff>=0;
      return '<div class="blt"><span class="bn">'+esc(x.p.name)+' <span style="font-size:9px;color:'+COL[x.p.pos]+'">'+x.p.pos+'</span></span>'+
        '<span class="bt"><span class="bf" style="width:'+(x.pv.act/top*100)+'%;background:'+(good?'var(--ok)':'var(--urg)')+';opacity:.75"></span>'+
        '<span class="bm" style="left:'+Math.min(99,x.pv.proj/top*100)+'%"></span></span>'+
        '<span class="bv" style="color:'+(good?'var(--ok)':'var(--urg)')+'">'+(good?'+':'')+x.pv.diff.toFixed(1)+'</span></div>';}).join('')+
      '<div class="legend"><span>Bar: points scored. White marker: the projection made before each week.</span></div>';
  } else document.getElementById('insPva').innerHTML='<div class="empty">No completed weeks with a stored projection yet.</div>';

  // injuries and role changes on this roster
  var fl=[];
  ks.forEach(function(x){var p=D.players[x];
    if(p.st==='RES')fl.push(['var(--urg)','IR',p]);
    else if(p.inj)fl.push([p.inj[0]==='Questionable'?'var(--ac)':'var(--urg)',p.inj[0],p]);
    if(p.pd!=null&&p.d!=null&&p.pd!==p.d)fl.push([p.d<p.pd?'var(--ok)':'var(--urg)',p.pos+p.pd+' → '+p.pos+p.d,p]);});
  document.getElementById('insFlags').innerHTML=fl.length?fl.map(function(f){
    return '<div class="mv"><span class="mvt" style="color:'+f[0]+';width:68px">'+esc(f[1])+'</span>'+
      '<span class="mvn">'+esc(f[2].name)+' <span style="font-size:9.5px;color:'+COL[f[2].pos]+'">'+f[2].pos+'</span></span>'+
      '<span class="mvm">'+f[2].team+'</span></div>';}).join(''):'<div class="empty">Clean bill of health, no depth-chart changes.</div>';
}

// ── league ─────────────────────────────────────────────────
function drawStandings(){
  var host=document.getElementById('standings'),card=document.getElementById('standCard');
  if(!LG||!LG.teams.some(function(t){return t.hasRecord;})){card.hidden=true;return;}
  card.hidden=false;
  var ts=LG.teams.slice().sort(function(a,b){return (b.wins-a.wins)||(b.pf-a.pf);});
  var mx=Math.max.apply(null,ts.map(function(t){return t.pf;}))||1;
  host.innerHTML=ts.map(function(t,i){
    return '<div class="std'+(t.id===MYID?' mine':'')+'"><span class="stdr">'+(i+1)+'</span>'+
      '<span class="stdn">'+esc(t.name)+'</span><span class="stdw">'+t.wins+'-'+t.losses+(t.ties?'-'+t.ties:'')+'</span>'+
      '<span class="stdbar"><span style="width:'+(t.pf/mx*100)+'%"></span></span>'+
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
function loadLeague(){LG=chooseLeague();trackDrops(LG);MYID=resolveMine();TRADECACHE={key:null,deals:null};WCACHE={key:null,rows:null};INSID=null;}
function redraw(){
  VCACHE={};
  drawBanners();drawHeader();drawNeeds();drawRiseChart();drawWaiverTable();drawInsights();drawTrades();
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
          playerPoolEntry:{player:{fullName:pl.fullName,defaultPositionId:pl.defaultPositionId,injuryStatus:pl.injuryStatus,ownership:pl.ownership}}};})}};}),
      status:raw.status?{currentMatchupPeriod:raw.status.currentMatchupPeriod}:null,
      schedule:(raw.schedule||[]).map(function(m){return {matchupPeriodId:m.matchupPeriodId,
        away:m.away?{teamId:m.away.teamId,totalPoints:m.away.totalPoints}:null,
        home:m.home?{teamId:m.home.teamId,totalPoints:m.home.totalPoints}:null};})};
    ls('swrespn',JSON.stringify({at:new Date().toISOString(),raw:slim}));
    document.getElementById('espnBox').value='';
    loadLeague();redraw();
    var n=0,miss=0;LG.teams.forEach(function(t){t.roster.forEach(function(r){if(r.pos==='K'||r.pos==='DST')return;n++;if(!D.players[r.k])miss++;});});
    m.textContent='Loaded '+LG.teams.length+' teams. '+(n-miss)+' of '+n+' skill players matched to stats.';
  });
  Array.prototype.forEach.call(document.querySelectorAll('[data-wp]'),function(b){b.addEventListener('click',function(){
    Array.prototype.forEach.call(document.querySelectorAll('[data-wp]'),function(x){x.className='btn s g';});
    b.className='btn s';WV.pos=b.getAttribute('data-wp');WV.all=false;drawWaiverTable();});});
  document.getElementById('wvSearch').addEventListener('input',function(e){WV.q=e.target.value;drawWaiverTable();});
  document.getElementById('wvHide').addEventListener('change',function(e){WV.hide=e.target.checked;drawWaiverTable();});
  document.getElementById('insTeam').addEventListener('change',function(e){var v=e.target.value;INSID=isNaN(+v)?v:+v;drawInsights();});
  document.getElementById('csvLoad').addEventListener('click',function(){
    var v=document.getElementById('csvBox').value;
    if(!parseCSV(v)){alert('That doesn\'t look like the draft app CSV.');return;}
    ls('swrcsv',v);loadLeague();redraw();});
  document.getElementById('mySel').addEventListener('change',function(e){
    var v=e.target.value;MYID=isNaN(+v)?v:+v;
    ls('swrmine:'+LG.teams.map(function(t){return t.id;}).join(','),String(MYID));WCACHE={key:null};INSID=null;redraw();});
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

'use strict';
const $=s=>document.querySelector(s);
let DATA, OFFICIAL, route='bat';
const state={baseline:'matched',variant:'all',boundary:'exact'};
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const pct=(v,d=1)=>v==null?'—':`${(100*v).toFixed(d)}%`;
const pp=v=>v==null?'—':`${v>0?'+':''}${(v*100).toFixed(1)} pp`;
const duration=s=>s==null?'—':`${Math.floor(Math.round(s)/60)}m ${Math.round(s)%60}s`;
const fmtTime=t=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/Toronto',month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}).format(new Date(t*1000));
const count=r=>`${r.k}/${r.n}`;
const diffText=d=>d?`${pp(d.ci[0])} to ${pp(d.ci[1])}`:'not available';
const current=()=>DATA.comparisons[`${state.baseline}|${state.variant}|${state.boundary}`];
const rate=(k,n)=>({k,n,value:n?k/n:null});
const width=v=>Math.max(0,Math.min(100,(v??0)*100));

function bar(r,side,{ci=false,short=false}={}){
 const tooltip=`${side==='before'?'Before':'After'}: ${pct(r.value)} (${count(r)})${r.ci?`\n95% CI: ${pct(r.ci[0])}–${pct(r.ci[1])}`:''}`;
 return `<div class="bar-line"><span class="bar-label">${side==='before'?'Pre':'Post'}</span><div class="bar-track" tabindex="0" data-tip="${esc(tooltip)}" aria-label="${esc(tooltip)}"><div class="bar ${side}" style="width:${width(r.value)}%"></div>${ci&&r.n?`<span class="whisker" style="left:${width(r.ci[0])}%;width:${width(r.ci[1])-width(r.ci[0])}%"></span>`:''}</div><strong>${pct(r.value)}${short?'':` <small>${count(r)}</small>`}</strong></div>`;
}
function card(label,key,a,b,delta,{lower=false}={}){
 const change=delta?.value,clear=delta&&(delta.ci[0]>0||delta.ci[1]<0),good=clear&&(lower?change<0:change>0);
 return `<article class="kpi"><p class="kpi-label">${label}</p><div class="kpi-main"><strong>${pct(b[key].value)}</strong><span class="kpi-change ${good?'good':clear?'bad':''}">${pp(change)}</span></div><p>Before: <b>${pct(a[key].value)}</b> → After: <b>${pct(b[key].value)}</b></p><div class="kpi-count">${count(a[key])} before · ${count(b[key])} after<br>95% change interval: ${diffText(delta)}</div></article>`;
}
function render(){
 const c=current(),a=c.before,b=c.after;
 const dates={matched:'Before: Oct 28, 00:30–08:30 EDT · After: Oct 29, 00:30–08:30 EDT',sameHours:'Before: Oct 28, 00:30–11:12 EDT · After: Oct 29, 00:30–11:12 EDT', '24h':'Before: Oct 28, 00:30–Oct 29, 00:30 EDT · After: Oct 29, 00:30–11:12 EDT',all:'Before: current save-generation enrollments before Oct 29, 00:30 EDT · After: Oct 29, 00:30–11:12 EDT'};
 $('#comparison-dates').textContent=dates[state.baseline]+(state.boundary==='guard'?' · Publish boundary exclusion enabled.':'')+' · Enrollment windows; observed session outcomes through the snapshot.';
 $('#cohort-line').innerHTML=`<strong>${a.enrolled.toLocaleString()}</strong> enrolled before <span aria-hidden="true">/</span> <strong>${b.enrolled.toLocaleString()}</strong> enrolled after · ${a.finalN+b.finalN} completed first-session records`;
 $('#pending-line').textContent=`${a.pendingFirst+b.pendingFirst} unfinished first sessions excluded${a.missingFirst+b.missingFirst?` · ${a.missingFirst+b.missingFirst} missing durations`:''}`;
 $('#kpis').innerHTML=card('Tutorial completion · session one','firstCompletion',a,b,c.deltas.firstCompletion)+card('Reached 5 minutes · session one','stay5',a,b,c.deltas.stay5)+card('Exited before 60 seconds','under60',a,b,c.deltas.under60,{lower:true})+`<article class="kpi"><p class="kpi-label">Median first-session length</p><div class="kpi-main"><strong>${duration(b.medianSeconds)}</strong><span class="kpi-change">${a.medianSeconds!=null&&b.medianSeconds!=null?`${b.medianSeconds-a.medianSeconds>0?'+':''}${Math.round(b.medianSeconds-a.medianSeconds)} sec`:'—'}</span></div><p>Before: <b>${duration(a.medianSeconds)}</b> → After: <b>${duration(b.medianSeconds)}</b></p><div class="kpi-count">Includes loading, menus and cutscene time</div></article>`;
 const start=c.deltas.firstStart,finish=c.deltas.firstCompletion;
 $('#verdict-title').textContent=!start?'This selection needs more completed sessions.':start.ci[0]>0?'More players reach the tutorial. Completion is the next question.':finish&&finish.ci[0]>0?'Completion is higher in this slice. Keep the comparison in context.':'The direction is mixed. Treat this as an early read.';
 $('#verdict-detail').textContent=start?`Tutorial starts: ${pct(a.firstStart.value)} → ${pct(b.firstStart.value)} (${pp(start.value)}). First-session completion: ${pct(a.firstCompletion.value)} → ${pct(b.firstCompletion.value)} (${pp(finish.value)}; 95% difference interval ${diffText(finish)}). ${finish.ci[0]<=0&&finish.ci[1]>=0?'That interval includes no change.':'This interval excludes no change, but the comparison is observational.'}`:'Choose a broader baseline or include more tutorial variants to inspect a populated comparison.';
 $('#evidence').textContent='OBSERVATIONAL';
 const metrics=[['firstStart','Started tutorial'],['firstCompletion','Completed tutorial'],['stay5','Stayed at least 5 minutes']];
 $('#conversion-chart').innerHTML=metrics.map(([key,label])=>`<div class="metric-row"><div class="metric-label"><span>${label}</span><small>${pp(c.deltas[key]?.value)}</small></div><div class="bar-pair">${bar(a[key],'before',{ci:true})}${bar(b[key],'after',{ci:true})}</div></div>`).join('');
 renderFunnel();renderFollowup(a,b);renderTiming(a,b);renderDurations(a,b);renderInsights(c);renderAudit(c);
}
function renderFunnel(){
 const c=current(),a=c.before.routes[route],b=c.after.routes[route];
 $('#route-bat').classList.toggle('selected',route==='bat');$('#route-class').classList.toggle('selected',route==='class');
 $('#route-bat').setAttribute('aria-pressed',route==='bat');$('#route-class').setAttribute('aria-pressed',route==='class');
 $('#route-note').textContent=`${a.n} before / ${b.n} after · bars show the share of this route’s completed first-session records`;
 $('#funnel-chart').innerHTML=a.order.map((key,i)=>`<div class="funnel-row"><div class="funnel-name"><span class="step-num">${i+1}</span>${DATA.labels[key]}</div><div class="funnel-pair">${['before','after'].map((side,j)=>{const s=j?b:a,v=s.n?s.counts[i]/s.n:0;return `<div class="funnel-track" tabindex="0" data-tip="${side==='before'?'Before':'After'} · ${DATA.labels[key]}\n${s.counts[i]} / ${s.n} · ${pct(s.n?v:null)}" aria-label="${side} ${DATA.labels[key]} ${s.counts[i]} of ${s.n}"><div class="bar ${side}" style="width:${width(v)}%"></div></div>`}).join('')}</div><div class="funnel-values"><span class="before-text">${pct(a.n?a.counts[i]/a.n:null)}<small>${a.counts[i]} players</small></span><span class="after-text">${pct(b.n?b.counts[i]/b.n:null)}<small>${b.counts[i]} players</small></span></div></div>`).join('');
 if(!b.n){$('#funnel-insight').innerHTML='No after-update records on this route for the selected tutorial arm. Switch routes or choose all variants.';return;}
 let largest=1;for(let i=2;i<b.counts.length;i++)if(b.counts[i-1]-b.counts[i]>b.counts[largest-1]-b.counts[largest])largest=i;
 const loss=b.counts[largest-1]-b.counts[largest],den=b.counts[largest-1];
 $('#funnel-insight').innerHTML=`<strong>Largest observed drop:</strong> ${DATA.labels[b.order[largest-1]]} → ${DATA.labels[b.order[largest]]}: <strong>${loss} of ${den} players (${pct(den?loss/den:null)})</strong> did not reach the next checkpoint in their first session. This locates the gap; it does not identify its cause.`;
}
function renderFollowup(a,b){
 const labels=['Tutorial completed','Quest accepted','Three objectives','Knife claimed','Steal reward claimed'];
 $('#followup-chart').innerHTML=labels.map((label,i)=>`<div class="follow-row"><span>${label}</span><div class="funnel-pair">${['before','after'].map((side,j)=>{let c=j?b:a,n=c.followup.counts[i],v=c.enrolled?n/c.enrolled:0;return `<div class="funnel-track" tabindex="0" data-tip="${side} · ${label}\n${n}/${c.enrolled} · ${pct(c.enrolled?v:null)}" aria-label="${side} ${label} ${n} of ${c.enrolled}"><span class="bar ${side}" style="width:${width(v)}%"></span></div>`}).join('')}</div><div class="follow-counts"><span>${a.followup.counts[i]}</span><span>${b.followup.counts[i]}</span></div></div>`).join('')+`<div class="inline-insight">First real theft recorded: <strong>${a.core.firstTheft}/${a.enrolled}</strong> before · <strong>${b.core.firstTheft}/${b.enrolled}</strong> after. First completed core loop: <strong>${a.core.coreLoop}/${a.enrolled}</strong> before · <strong>${b.core.coreLoop}/${b.enrolled}</strong> after.</div>`;
}
function renderTiming(a,b){
 const keys=['TutorialStarted','BatPurchased','BatEquipped','TimeStolen','Completed'];
 $('#timing-table').innerHTML=`<table><thead><tr><th>CHECKPOINT</th><th>BEFORE</th><th>AFTER</th></tr></thead><tbody>${keys.map(key=>`<tr><td>${DATA.labels[key]}</td>${[a,b].map(s=>`<td>${duration(s.stepTimings[key].median)}<small>n = ${s.stepTimings[key].n}</small></td>`).join('')}</tr>`).join('')}</tbody></table>`;
}
function renderDurations(a,b){
 $('#duration-chart').innerHTML=DATA.durationLabels.map((label,i)=>`<div class="duration-row"><span>${label}</span><div class="funnel-pair">${['before','after'].map((side,j)=>{let s=j?b:a,n=s.durations[i];return `<div class="funnel-track" tabindex="0" data-tip="${side} · ${label}\n${n}/${s.finalN} · ${pct(s.finalN?n/s.finalN:null)}" aria-label="${side}, ${label}, ${n} of ${s.finalN}"><span class="bar ${side}" style="width:${width(s.finalN?n/s.finalN:0)}%"></span></div>`}).join('')}</div><div class="duration-value"><span class="before-text">${pct(a.finalN?a.durations[i]/a.finalN:null)}</span><span class="after-text">${pct(b.finalN?b.durations[i]/b.finalN:null)}</span></div></div>`).join('')+`<p class="chart-note">Average session length: ${duration(a.meanSeconds)} before · ${duration(b.meanSeconds)} after. Session time includes the opening experience and is not a pure measure of active gameplay.</p>`;
}
function renderInsights(c){
 const a=c.before,b=c.after,batA=a.routes.bat,batB=b.routes.bat;
 const lossA=batA.counts[2]-batA.counts[3],lossB=batB.counts[2]-batB.counts[3];
 const same=DATA.comparisons[`sameHours|${state.variant}|${state.boundary}`];
 const d=same.deltas.stay5;
 const items=[
 ['Investigate the bat equip handoff',batB.n?`On the bat-first route, ${lossB}/${batB.counts[2]} buyers (${pct(batB.counts[2]?lossB/batB.counts[2]:null)}) do not reach “equipped” in session one, versus ${lossA}/${batA.counts[2]} before. Check the equip prompt and input path. The saved data cannot distinguish confusion from a technical failure.`:'Select variant A or C, or all variants, to inspect the bat equip handoff.'],
 ['Check the same-hours baseline',d?`Against the same hours on the previous day, the five-minute rate changes by ${pp(d.value)} (95% interval ${diffText(d)}). ${d.ci[0]<=0&&d.ci[1]>=0?'The interval includes no change; this signal depends on the comparison window.':'The interval excludes zero in this view; differences in traffic mix still remain possible.'}`:'There are not enough first-session records in the same-hours baseline for this selection.'],
 ['Separate staying longer from getting to gameplay',`Median time to tutorial completion among completers is ${duration(a.stepTimings.Completed.median)} before and ${duration(b.stepTimings.Completed.median)} after. Extra session time can include loading or the opening cutscene. The official first-visit funnel above shows the cutscene gap; it does not prove the cutscene caused exits.`],
 ['Give retention time to mature',`Post-update day-one retention is not yet measurable from a complete UTC day-one window. The selected before cohort has only ${a.d1.n} fully matured records. Wait for a complete post-update window before judging return behavior.`]
 ];
 $('#insights').innerHTML=items.map(([title,body],i)=>`<article class="insight"><span class="insight-index">0${i+1}</span><div><h3>${title}</h3><p>${body}</p></div></article>`).join('');
}
function renderHourly(){
 const rows=DATA.hourly,w=620,h=240,left=33,right=10,top=24,bottom=37,cw=w-left-right,ch=h-top-bottom;
 const peak=Math.max(1,...rows.map(x=>x.n)),max=Math.ceil(peak/20)*20,barW=cw/rows.length;
 let svg=`<svg viewBox="0 0 ${w} ${h}" class="chart-svg" role="img" aria-label="Eligible profile enrollments per hour, with the October 29 12:30 a.m. Toronto update marked">`;
 for(let j=0;j<=4;j++){let y=top+ch*j/4;svg+=`<line x1="${left}" y1="${y}" x2="${w-right}" y2="${y}" class="gridline"/><text x="${left-8}" y="${y+3}" text-anchor="end">${max*(1-j/4)}</text>`;}
 for(let i=0;i<rows.length;i++){
  let r=rows[i],bh=r.n/max*ch,x=left+i*barW+1,y=top+ch-bh,mixed=r.at<DATA.meta.cutoff&&r.at+3600>DATA.meta.cutoff,color=mixed?'#a2a976':r.at>=DATA.meta.cutoff?'#23755b':'#b98350';
  const tip=`${fmtTime(r.at)}\n${r.n} enrollments${mixed?' · mixed publish hour':''}${r.partial?' · partial hour':''}`;
  svg+=`<rect class="hour-bar" x="${x}" y="${y}" width="${Math.max(1,barW-2)}" height="${bh}" rx="1" fill="${color}" opacity="${r.partial?.55:1}" tabindex="0" data-tip="${esc(tip)}"><title>${esc(tip)}</title></rect>`;
  if(i%8===0){const d=new Date(r.at*1000),label=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Toronto',month:'short',day:'numeric',hour:'numeric',hour12:false}).format(d);svg+=`<text x="${x}" y="${h-12}" text-anchor="${i===0?'start':'middle'}">${esc(label.replace(',',''))}</text>`;}
 }
 const x=left+(DATA.meta.cutoff-rows[0].at)/3600*barW;
 svg+=`<line x1="${x}" x2="${x}" y1="8" y2="${top+ch}" stroke="#1b4035" stroke-dasharray="4 4"/><text x="${Math.min(w-8,x+5)}" y="11">UPDATE</text></svg>`;
 $('#hourly-chart').innerHTML=svg;
 const all=DATA.comparisons['all|all|exact'];
 $('#intake-summary').innerHTML=`<div><strong>${DATA.meta.eligible}</strong><p>eligible current-generation profiles</p></div><div><strong>${all.after.enrolled}</strong><p>enrolled after update</p></div><div><strong>${DATA.meta.postHours.toFixed(1)}h</strong><p>post-update snapshot window</p></div>`;
}
function experimentCard(e){
 const max=Math.max(1,...e.arms.map(a=>a.assigned));
 const specifics={
  firstLoss:'Eligibility reached: '+e.arms.map(a=>`${a.name} ${a.exposed}`).join(' · ')+'. '+(e.arms.find(a=>a.name==='free50')?.converted??0)+' free-revive uses recorded. Usage is not a retention effect.',
  gemDiscovery:'Eligible → bought with gems: '+e.arms.map(a=>`${a.name} ${a.converted}/${a.exposed}`).join(' · ')+'. Few buyers; this does not establish a winner.',
  mobileShop:'Both arms have persisted enrollment, but no payer flags in this snapshot. Zero observed payers does not mean the interfaces perform equally.',
  reviveFormat:'Actually exposed: '+e.arms.map(a=>`${a.name} ${a.exposed}`).join(' · ')+'. No payer flags observed. Assignment alone does not prove the UI was seen.'
 };
 return `<article class="panel experiment"><p class="eyebrow">${e.timeKey==='enrolledAt'?'ENROLLED PLAYERS':'ASSIGNED PLAYERS'}</p><h3>${esc(e.label)}</h3>${e.arms.map(a=>`<div class="experiment-arm"><span>${esc(a.name.replaceAll('_',' '))}</span><div class="bar-track"><span class="bar after" style="width:${a.assigned/max*100}%"></span></div><strong>${a.assigned}</strong></div>`).join('')}<p class="experiment-note">${esc(specifics[e.key]??'Descriptive profile state. Different exposure durations prevent a simple causal comparison.')}</p></article>`;
}
function renderExperiments(){
 const variants=['A','B','C'].map(v=>({v,c:DATA.comparisons[`all|${v}|exact`]}));
 let tutorial=`<article class="panel experiment"><p class="eyebrow">FIRST-SESSION COMPLETION · ALL DATES</p><h3>Tutorial variants</h3>${variants.map(({v,c})=>`<div class="metric-label"><span>${v} · ${v==='B'?'class first':'bat first'}</span><small>${pct(c.before.firstCompletion.value)} → <strong>${pct(c.after.firstCompletion.value)}</strong><br>${count(c.before.firstCompletion)} → ${count(c.after.firstCompletion)}</small></div>`).join('')}<p class="experiment-note">B has the highest observed post-update completion. A/C share step order, but may differ in other behavior. Subgroup comparisons are exploratory and not adjusted for multiple comparisons.</p></article>`;
 const full=DATA.comparisons['all|all|exact'];
 const retention=`<article class="panel experiment"><p class="eyebrow">NEXT DECISION WINDOW</p><h3>Day-one retention</h3><div style="font:600 35px Manrope;letter-spacing:-1px;margin:8px 0">Not mature</div><p>After-update cohorts still need a complete UTC day-one observation window. ${full.before.d1.n} before-update profiles have a fully matured window; ${full.before.d1.k} have a saved day-one return.</p><p class="experiment-note">Reharvest after October 30, 8 p.m. Toronto time to cover the full UTC day-one window for October 29 UTC enrollments. Save timing can still add delay.</p></article>`;
 $('#experiment-grid').innerHTML=tutorial+DATA.experiments.filter(e=>e.arms.length).map(experimentCard).join('')+retention;
}
function renderAudit(c){
 const labels={firstStart:'Started tutorial',firstCompletion:'Completed tutorial in first session',stay5:'First session ≥ 5 minutes',under60:'First session < 60 seconds'};
 $('#audit-table').innerHTML=`<table><thead><tr><th>METRIC</th><th>BEFORE · COUNT / RATE</th><th>AFTER · COUNT / RATE</th><th>CHANGE</th><th>95% DIFFERENCE INTERVAL</th></tr></thead><tbody>${Object.keys(labels).map(k=>`<tr><td>${labels[k]}</td><td>${count(c.before[k])} · ${pct(c.before[k].value)}</td><td>${count(c.after[k])} · ${pct(c.after[k].value)}</td><td>${pp(c.deltas[k]?.value)}</td><td>${diffText(c.deltas[k])}</td></tr>`).join('')}</tbody></table>`;
}
function renderOfficial(){
 const f=OFFICIAL.funnels;
 $('#official-meta').textContent=`Oct 23–29, 2026 · Last 7 days · By user · No filters · Experience-wide. Roblox data last updated: ${OFFICIAL.lastUpdatedLabel}. Captured ${fmtTime(Date.parse(OFFICIAL.capturedAt)/1000)} EDT. Counts below remain fixed when profile filters change.`;
 const headline=[['Tutorial A · completed',f.TutorialOrder_A],['Tutorial B · completed',f.TutorialOrder_B],['Tutorial C · completed',f.TutorialOrder_C],['First-visit funnel · gameplay ready',f.ST_FirstVisitEntryV3]];
 $('#official-kpis').innerHTML=headline.map(([title,rows])=>`<article class="kpi"><p class="kpi-label">${title}</p><div class="kpi-main"><strong>${pct(rows.at(-1).n/rows[0].n,2)}</strong></div><p>${rows.at(-1).n} / ${rows[0].n} recorded users</p><div class="kpi-count">Creator Dashboard · Oct 23–29 · By user</div></article>`).join('');
 $('#official-funnel').innerHTML=Object.keys(f).map(k=>`<option value="${esc(k)}" ${k==='ST_FirstVisitEntryV3'?'selected':''}>${esc(k)}</option>`).join('');
 $('#official-variants').innerHTML=['A','B','C'].map(v=>{const r=f['TutorialOrder_'+v],k=r.at(-1).n,n=r[0].n,p=k/n,z=1.95996398454,d=1+z*z/n,m=(p+z*z/(2*n))/d,w=z*Math.sqrt(p*(1-p)/n+z*z/(4*n*n))/d;return `<div class="metric-row"><div class="metric-label"><span>Variant ${v} · ${v==='B'?'class first':'bat first'}</span><strong>${pct(p,2)}</strong></div><div class="official-variant-track"><div class="bar after" style="width:${width(p)}%"></div><span class="whisker" style="left:${100*(m-w)}%;width:${200*w}%"></span></div><p class="chart-note">${k} completed / ${n} assigned · 95% CI ${pct(m-w)}–${pct(m+w)}</p></div>`}).join('');
 $('#official-actions').innerHTML=[
  ['01 / OPENING EXPERIENCE','Inspect the cutscene gap','247 reached CutsceneStarted; 205 reached CutsceneEnded. That is 42 users (17.0%) without the next event. Check duration, skipping, load failures and event delivery. These counts do not give exit reasons.'],
  ['02 / FOLLOW-UP QUEST','Make the next objective clear','219 accepted the follow-up quest; 51 reached ThreeObjectives. The gap is 168 users (76.7%). Inspect objective visibility, difficulty and reward clarity. This is observed progress, not a timed retention metric.'],
  ['03 / CORE GAMEPLAY','Verify the full loop','251 reached LeftSafezone and 59 reached StoleTime. ReturnedAlive has 44; DepositedTime has 0. Check the deposit event and required step order before treating that zero as proof nobody deposited.']
 ].map(([tag,title,body])=>`<article class="panel"><p class="eyebrow">${tag}</p><h3>${title}</h3><p>${body}</p></article>`).join('');
 renderOfficialFunnel();
 $('#official-funnel').addEventListener('change',renderOfficialFunnel);
}
function renderOfficialFunnel(){
 const name=$('#official-funnel').value,rows=OFFICIAL.funnels[name],total=rows[0].n;
 const notes={ST_FirstVisitEntryV3:'First-visit entry instrumentation. “First visit” is the game’s classification, not independently verified first-ever Roblox history.',ST_RejoinEntryV3:'Returning-visit instrumentation. Only 17 recorded users: treat these percentages as a small sample.',ST_Startup:'Older startup instrumentation. Different event definitions and coverage from ST_StartupV2; do not use them as a direct before/after test.',ST_PlayEntryV2:'Older entry instrumentation. Includes a menu path; the newer first-visit flow differs. Rates across versions are not directly comparable.',ST_StartupV2:'Newer startup instrumentation. Its coverage and step definitions differ from the older ST_Startup funnel.',ST_Engagement:'By-user engagement thresholds across recorded sessions. This is not the percentage of first sessions lasting this long.',ST_CoreLoop:'Ordered gameplay events. DepositedTime requires earlier steps in the same session in the current source. Zero received deposit events is not proof of zero deposits.',ST_Followup:'Cumulative follow-up progress starting at tutorial completion. Later visits may add progress.',ST_Monetization:'Only SessionStarted was shown in this capture. No downstream purchase steps were displayed; this cannot establish revenue or purchase conversion.'};
 $('#official-funnel-note').textContent=notes[name]||'One-time tutorial funnel. Later-session completions can count against the date of initial funnel entry.';
 $('#official-chart').innerHTML=rows.map((r,i)=>`<div class="official-row"><div class="metric-label"><span>${i+1}. ${esc(r.step)}</span><strong>${r.n} <small>/ ${total}</small></strong></div><div class="official-track" tabindex="0" aria-label="${esc(r.step)}: ${r.n} users, ${pct(r.n/total,2)}" data-tip="${esc(r.step)}\n${r.n}/${total} · ${pct(r.n/total,2)}"><span class="bar after" style="width:${width(r.n/total)}%"></span></div><span class="official-percent">${pct(r.n/total,2)}</span></div>`).join('');
 let gap=rows.length>1?1:0;for(let i=2;i<rows.length;i++)if(rows[i-1].n-rows[i].n>rows[gap-1].n-rows[gap].n)gap=i;
 $('#official-insight').innerHTML=gap?`<strong>Largest gap by user count:</strong> ${esc(rows[gap-1].step)} → ${esc(rows[gap].step)}: ${rows[gap-1].n-rows[gap].n} / ${rows[gap-1].n} (${pct((rows[gap-1].n-rows[gap].n)/rows[gap-1].n,2)}) without the next recorded step. This is not an exit-reason measurement.`:'Only the initial step is present. A conversion rate cannot be inferred from this one-step table.';
 $('#official-table').innerHTML=`<table><thead><tr><th>Step</th><th>Users</th><th>Step completion</th><th>Churn</th><th>Total conversion</th></tr></thead><tbody>${rows.map((r,i)=>{const previous=i?rows[i-1].n:r.n;return `<tr><td>${esc(r.step)}</td><td>${r.n}</td><td>${pct(previous?r.n/previous:null,2)}</td><td>${pct(previous?1-r.n/previous:null,2)}</td><td>${pct(r.n/total,2)}</td></tr>`}).join('')}</tbody></table>`;
 $('#official-source').href=`https://create.roblox.com/dashboard/creations/experiences/10352248866/analytics/funnels?tab=${encodeURIComponent(name)}&rangeType=Last7Days`;
}
function setupTooltips(){
 const tip=$('#tooltip');
 function show(e){const t=e.target.closest('[data-tip]');if(!t)return;tip.textContent=t.dataset.tip;tip.hidden=false;let r=t.getBoundingClientRect();tip.style.left=`${Math.min(innerWidth-tip.offsetWidth-12,Math.max(12,e.clientX??r.left))}px`;tip.style.top=`${Math.min(innerHeight-tip.offsetHeight-12,(e.clientY??r.bottom)+15)}px`;}
 document.addEventListener('pointerover',show);document.addEventListener('focusin',show);
 document.addEventListener('pointerout',()=>tip.hidden=true);document.addEventListener('focusout',()=>tip.hidden=true);document.addEventListener('keydown',e=>{if(e.key==='Escape')tip.hidden=true;});
}
async function init(){
 try{
  const [response,officialResponse]=await Promise.all([fetch('data.json?v=20261029-audit2'),fetch('official.json?v=20261029-audit2')]);if(!response.ok||!officialResponse.ok)throw new Error('Snapshot could not be loaded');[DATA,OFFICIAL]=await Promise.all([response.json(),officialResponse.json()]);
  $('#asof').textContent=`Harvested ${fmtTime(DATA.meta.finishedAt)} EDT`;
  $('#window').textContent=`${DATA.meta.postHours.toFixed(1)} hours after update`;
  $('#provenance').innerHTML=[['Profiles read',`${DATA.meta.profilesRead} / ${DATA.meta.totalKeys}`],['Unresolved read errors',DATA.meta.finalErrorCount],['Eligible current-generation profiles',DATA.meta.eligible],['Excluded from cohorts',DATA.meta.profilesRead-DATA.meta.eligible],['Harvest started',`${fmtTime(DATA.meta.startedAt)} EDT`],['Harvest finished',`${fmtTime(DATA.meta.finishedAt)} EDT`],['Cutoff (UTC)', 'Oct 29, 04:30'],['Current save generation',DATA.meta.generation]].map(([k,v])=>`<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('');
  render();renderOfficial();renderHourly();renderExperiments();setupTooltips();
  $('#loading').hidden=true;$('#dashboard').hidden=false;
  $('#baseline').addEventListener('change',e=>{state.baseline=e.target.value;render();});
  $('#variant').addEventListener('change',e=>{state.variant=e.target.value;if(state.variant==='B')route='class';else if(state.variant==='A'||state.variant==='C')route='bat';render();});
  $('#guard').addEventListener('change',e=>{state.boundary=e.target.checked?'guard':'exact';render();});
  $('#route-bat').addEventListener('click',()=>{route='bat';renderFunnel();});$('#route-class').addEventListener('click',()=>{route='class';renderFunnel();});
  $('#export').addEventListener('click',()=>{const a=document.createElement('a'),url=URL.createObjectURL(new Blob([JSON.stringify({creatorDashboard:OFFICIAL,savedProfiles:DATA},null,2)],{type:'application/json'}));a.href=url;a.download='steal-time-audited-aggregate-stats.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);});
  const observer=new IntersectionObserver(entries=>{for(const entry of entries)if(entry.isIntersecting){document.querySelectorAll('.nav a').forEach(a=>a.classList.toggle('active',a.hash==='#'+entry.target.id));}},{rootMargin:'-100px 0px -65% 0px'});
  ['overview','release-comparison','funnel','engagement','methodology'].forEach(id=>observer.observe($('#'+id)));
 }catch(e){$('#loading').textContent=`Could not load the analytics snapshot. ${e.message}. Please reload the page.`;console.error(e);}
}
init();

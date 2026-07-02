const CAT_COLORS = ['#034ea2','#5f5e5a','#1baf7a','#eda100','#4a3aa7','#008300','#e87ba4','#eb6834'];
const MODS = [{code:'US',name:'Ultrasound'},{code:'XR',name:'X-Ray'},{code:'CT',name:'CT Scan'},{code:'MR',name:'MRI'}];
const MOD_COLOR = {US:'#034ea2', XR:'#1baf7a', CT:'#eda100', MR:'#4a3aa7'};
Chart.defaults.devicePixelRatio = Math.max((window.devicePixelRatio||1)*2, 3);
Chart.defaults.font.family = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";

let currentMod='US', fromIdx=0, toIdx=RAW.months.length-1, sortKey='totalAssigned', sortDir=-1;
let opChart=null, trendChart=null, distChart=null;

function fmtMin(v){
  if(!v) return '\u2013';
  if(v>=60){ const h=Math.floor(v/60), m=Math.round(v%60); return h+'h '+m+'m'; }
  return Math.round(v)+'m';
}
function fmtHHMM(v){
  if(v===undefined||v===null||isNaN(v)) return '0:00';
  const total = Math.round(v);
  const h = Math.floor(total/60), m = total%60;
  return h+':'+String(m).padStart(2,'0');
}
function monthsInRange(){ const s=new Set(); for(let i=fromIdx;i<=toIdx;i++) s.add(i); return s; }

function renderTabs(){
  const wrap=document.getElementById('modTabs');
  wrap.innerHTML = MODS.map(m=>`<button data-mod="${m.code}" style="padding:6px 14px; font-size:13px; border-radius:8px; border:0.5px solid ${m.code===currentMod?'var(--brand-color)':'var(--border-strong)'}; background:${m.code===currentMod?'var(--brand-bg)':'var(--surface-2)'}; color:${m.code===currentMod?'var(--brand-color)':'var(--text-primary)'}; cursor:pointer;">${m.name}</button>`).join('');
  wrap.querySelectorAll('button').forEach(b=>b.addEventListener('click',()=>{ currentMod=b.dataset.mod; sortKey='totalAssigned'; sortDir=-1; renderAll(); }));
}

function renderPeriodSelectors(){
  const fSel=document.getElementById('fromMonth'), tSel=document.getElementById('toMonth');
  if(!fSel.options.length){
    RAW.months.forEach((m,i)=>{
      fSel.innerHTML += `<option value="${i}" ${i===fromIdx?'selected':''}>${m}</option>`;
      tSel.innerHTML += `<option value="${i}" ${i===toIdx?'selected':''}>${m}</option>`;
    });
    fSel.addEventListener('change', ()=>{ fromIdx=parseInt(fSel.value); if(fromIdx>toIdx){toIdx=fromIdx; tSel.value=toIdx;} renderAll(); });
    tSel.addEventListener('change', ()=>{ toIdx=parseInt(tSel.value); if(toIdx<fromIdx){fromIdx=toIdx; fSel.value=fromIdx;} renderAll(); });
  }
}

function computeOperatorStats(){
  const months = monthsInRange();
  const byOp = {};
  RAW.tatAgg.forEach(([opIdx,mod,moIdx,n,sumTat,sumWait,sumService,medianTat])=>{
    if(mod!==currentMod || !months.has(moIdx)) return;
    if(!byOp[opIdx]) byOp[opIdx] = {n:0,sumTat:0,sumWait:0,sumService:0,medWeighted:0,C:0,P:0,S:0,V:0,N:0,E:0};
    const o=byOp[opIdx];
    o.n+=n; o.sumTat+=sumTat; o.sumWait+=sumWait; o.sumService+=sumService; o.medWeighted += medianTat*n;
  });
  RAW.statusAgg.forEach(([opIdx,mod,moIdx,C,P,S,V,N,E])=>{
    if(mod!==currentMod || !months.has(moIdx)) return;
    if(!byOp[opIdx]) byOp[opIdx] = {n:0,sumTat:0,sumWait:0,sumService:0,medWeighted:0,C:0,P:0,S:0,V:0,N:0,E:0};
    const o=byOp[opIdx];
    o.C+=C; o.P+=P; o.S+=S; o.V+=V; o.N+=N; o.E+=E;
  });
  return Object.keys(byOp).map(opIdx=>{
    const o=byOp[opIdx];
    const pendingTotal=o.P+o.S+o.V+o.N+o.E;
    const totalAssigned=o.C+pendingTotal;
    return {
      operator: RAW.operators[opIdx],
      completedCount:o.n, totalAssigned, pendingTotal, noshow:o.N,
      completionRate: totalAssigned? Math.round(1000*o.C/totalAssigned)/10:0,
      noshowRate: totalAssigned? Math.round(1000*o.N/totalAssigned)/10:0,
      avgTat: o.n? o.sumTat/o.n:0, medianTat: o.n? o.medWeighted/o.n:0,
      avgWait: o.n? o.sumWait/o.n:0, avgService: o.n? o.sumService/o.n:0
    };
  });
}

function renderKpis(rows){
  const totalCompleted = rows.reduce((a,r)=>a+r.completedCount,0);
  const totalPending = rows.reduce((a,r)=>a+r.pendingTotal,0);
  const avgTat = totalCompleted? rows.reduce((a,r)=>a+r.avgTat*r.completedCount,0)/totalCompleted:0;
  const avgWait = totalCompleted? rows.reduce((a,r)=>a+r.avgWait*r.completedCount,0)/totalCompleted:0;
  const avgService = totalCompleted? rows.reduce((a,r)=>a+r.avgService*r.completedCount,0)/totalCompleted:0;
  const cards=[
    {label:'Completed tokens', value:totalCompleted.toLocaleString()},
    {label:'Pending tokens', value:totalPending.toLocaleString()},
    {label:'Avg imaging-service TAT', value:fmtMin(avgTat)},
    {label:'Avg wait time', value:fmtMin(avgWait)},
    {label:'Avg service time', value:fmtMin(avgService)}
  ];
  document.getElementById('kpiRow').innerHTML = cards.map(c=>`
    <div class="kpi-card">
      <div class="kpi-label">${c.label}</div>
      <div class="kpi-value">${c.value}</div>
    </div>`).join('');
  document.getElementById('summaryLabel').textContent = RAW.months[fromIdx]+' to '+RAW.months[toIdx]+' \u00b7 '+totalCompleted.toLocaleString()+' completed \u00b7 '+totalPending.toLocaleString()+' pending';
}

const labelPlugin = {
  id:'valueLabels',
  afterDatasetsDraw(chart){
    const {ctx} = chart;
    ctx.save(); ctx.font='11px -apple-system, sans-serif'; ctx.fillStyle='#52514e';
    const isOpChart = chart.canvas.id === 'opChart';
    chart.data.datasets.forEach((ds,dsIndex)=>{
      const meta = chart.getDatasetMeta(dsIndex);
      meta.data.forEach((el,i)=>{
        const val = ds.data[i];
        if(val===undefined||val===null) return;
        const pos = el.tooltipPosition ? el.tooltipPosition() : el.getProps(['x','y'],true);
        if(chart.config.type==='bar' && chart.options.indexAxis==='y'){ ctx.textAlign='left'; ctx.textBaseline='middle'; ctx.fillText(isOpChart? fmtHHMM(val) : Math.round(val), pos.x+6, pos.y); }
        else if(chart.config.type==='bar'){ ctx.textAlign='center'; ctx.textBaseline='bottom'; ctx.fillText(val, pos.x, pos.y-4); }
      });
    });
    ctx.restore();
  }
};

function renderOpChart(rows){
  const ops = rows.filter(r=>r.completedCount>=5).sort((a,b)=>b.avgTat-a.avgTat);
  document.getElementById('opChartWrap').style.height = Math.max(220, ops.length*32+60)+'px';
  const ctx=document.getElementById('opChart');
  if(opChart) opChart.destroy();
  opChart = new Chart(ctx, {
    type:'bar',
    data:{ labels: ops.map(o=>o.operator), datasets:[{ data: ops.map(o=>Math.round(o.avgTat)), backgroundColor: ops.map((o,i)=>CAT_COLORS[i%CAT_COLORS.length]), borderRadius:4, maxBarThickness:20 }] },
    options:{ indexAxis:'y', responsive:true, maintainAspectRatio:false, layout:{padding:{right:36}},
      plugins:{ legend:{display:false}, tooltip:{callbacks:{label:(c)=> fmtMin(c.raw)+' avg TAT \u00b7 '+ops[c.dataIndex].completedCount+' completed'}} },
      scales:{ x:{ title:{display:true,text:'time (h:mm)',color:'#898781'}, ticks:{color:'#898781', callback:(v)=>fmtHHMM(v)}, grid:{color:'#e1e0d9'} },
                y:{ title:{display:true,text:'operator',color:'#898781'}, ticks:{color:'#52514e',font:{size:11}}, grid:{display:false} } } },
    plugins:[labelPlugin]
  });
}

function renderTrendChart(){
  const months = monthsInRange();
  const labels=[];
  for(let i=fromIdx;i<=toIdx;i++) labels.push(RAW.months[i]);

  const byMonth = {};
  RAW.tatAgg.forEach(([opIdx,mod,moIdx,n,sumTat])=>{
    if(mod!==currentMod || !months.has(moIdx)) return;
    if(!byMonth[moIdx]) byMonth[moIdx]={n:0,sumTat:0};
    byMonth[moIdx].n+=n; byMonth[moIdx].sumTat+=sumTat;
  });
  const data=[];
  for(let i=fromIdx;i<=toIdx;i++){ const b=byMonth[i]; data.push(b&&b.n? Math.round(b.sumTat/b.n):null); }
  const datasets = [{ label:MODS.find(m=>m.code===currentMod).name, data, borderColor:MOD_COLOR[currentMod], backgroundColor:MOD_COLOR[currentMod]+'1A', borderWidth:2, pointRadius:3, fill:true, tension:0.25, spanGaps:true }];

  document.getElementById('trendLegend').innerHTML = '';

  const ctx=document.getElementById('trendChart');
  if(trendChart) trendChart.destroy();
  trendChart = new Chart(ctx, {
    type:'line',
    data:{ labels, datasets },
    options:{ responsive:true, maintainAspectRatio:false,
      plugins:{ legend:{display:false}, tooltip:{callbacks:{label:(c)=> c.dataset.label+': '+fmtHHMM(c.raw)}} },
      scales:{ x:{ title:{display:true,text:'month',color:'#898781'}, ticks:{color:'#898781',font:{size:10}}, grid:{display:false} },
                y:{ title:{display:true,text:'time (h:mm)',color:'#898781'}, ticks:{color:'#898781', callback:(v)=>fmtHHMM(v)}, grid:{color:'#e1e0d9'} } } }
  });
}

function hourLabel(h){
  if(h===0) return '12am'; if(h===12) return '12pm';
  return h<12 ? h+'am' : (h-12)+'pm';
}

function renderDistChart(){
  document.getElementById('distChart').parentElement.innerHTML = '<canvas id="distChart" role="img" aria-label="Bar chart of token volume by hour of day, 6am to 8pm, showing token count per hour; hover a bar for the average TAT breakdown"></canvas>';
  const months = monthsInRange();
  const hourIdxs = RAW.hours.map((h,i)=>i).filter(i=>RAW.hours[i]<=20);
  const labels = hourIdxs.map(i=>hourLabel(RAW.hours[i]));
  const counts = new Array(hourIdxs.length).fill(0);
  const sums = new Array(hourIdxs.length).fill(0);
  const posByHourIdx = {}; hourIdxs.forEach((hi,pos)=>posByHourIdx[hi]=pos);
  RAW.hourAgg.forEach(([mod,moIdx,hourIdx,n,sumTat])=>{
    if(mod!==currentMod || !months.has(moIdx)) return;
    if(!(hourIdx in posByHourIdx)) return;
    const pos = posByHourIdx[hourIdx];
    counts[pos]+=n; sums[pos]+=sumTat;
  });
  const avgTat = counts.map((n,i)=> n? sums[i]/n : null);
  const ctx=document.getElementById('distChart');
  if(distChart) distChart.destroy();
  distChart = new Chart(ctx, {
    type:'bar',
    data:{ labels, datasets:[{ data:counts, backgroundColor: MOD_COLOR[currentMod], borderRadius:4, maxBarThickness:28 }] },
    options:{ responsive:true, maintainAspectRatio:false, layout:{padding:{top:22}},
      plugins:{ legend:{display:false}, tooltip:{callbacks:{
        label:(c)=> c.raw+' tokens',
        afterLabel:(c)=> avgTat[c.dataIndex]!==null ? 'Avg TAT: '+fmtHHMM(avgTat[c.dataIndex]) : 'No completed tokens'
      }} },
      scales:{ x:{ title:{display:true,text:'hour issued',color:'#898781'}, ticks:{color:'#898781',font:{size:10},autoSkip:false,maxRotation:45}, grid:{display:false} },
                y:{ title:{display:true,text:'tokens',color:'#898781'}, ticks:{color:'#898781'}, grid:{color:'#e1e0d9'} } } },
    plugins:[{
      id:'hourCountLabels',
      afterDatasetsDraw(chart){
        const {ctx}=chart;
        ctx.save(); ctx.font='10px -apple-system, sans-serif'; ctx.fillStyle='#52514e'; ctx.textAlign='center'; ctx.textBaseline='bottom';
        const meta = chart.getDatasetMeta(0);
        meta.data.forEach((el,i)=>{
          if(!counts[i]) return;
          ctx.fillText(counts[i], el.x, el.y-4);
        });
        ctx.restore();
      }
    }]
  });
}

const COLS=[
  {key:'operator', label:'Operator', fmt:v=>v, align:'left'},
  {key:'totalAssigned', label:'Assigned', fmt:v=>v.toLocaleString()},
  {key:'completedCount', label:'Completed', fmt:v=>v.toLocaleString()},
  {key:'pendingTotal', label:'Pending', fmt:v=>v.toLocaleString()},
  {key:'completionRate', label:'Completion', fmt:v=>v+'%'},
  {key:'avgWait', label:'Avg wait', fmt:v=>fmtMin(v)},
  {key:'avgService', label:'Avg service', fmt:v=>fmtMin(v)},
  {key:'avgTat', label:'Avg TAT', fmt:v=>fmtMin(v)},
  {key:'medianTat', label:'Median TAT', fmt:v=>fmtMin(v)},
  {key:'noshowRate', label:'No-show', fmt:v=>v+'%'}
];

function renderTable(rows){
  const head=document.getElementById('opTableHead');
  head.innerHTML = COLS.map(c=>`<th data-key="${c.key}" style="text-align:${c.align||'right'};">${c.label}${sortKey===c.key?(sortDir===1?' \u25b2':' \u25bc'):''}</th>`).join('');
  head.querySelectorAll('th').forEach(th=>th.addEventListener('click',()=>{ const k=th.dataset.key; if(sortKey===k) sortDir*=-1; else {sortKey=k; sortDir=-1;} renderTable(rows); }));
  let ops = rows.filter(o=>o.totalAssigned>0).sort((a,b)=>(a[sortKey]<b[sortKey]?-1:a[sortKey]>b[sortKey]?1:0)*sortDir);
  document.getElementById('opTableBody').innerHTML = ops.map(o=>`
    <tr>
      ${COLS.map(c=>`<td style="text-align:${c.align||'right'};${c.key==='operator'?'font-weight:600;':''}">${c.fmt(o[c.key])}</td>`).join('')}
    </tr>`).join('');
}

function renderAll(){
  renderTabs();
  renderPeriodSelectors();
  const rows = computeOperatorStats();
  renderKpis(rows);
  renderOpChart(rows);
  renderTrendChart();
  renderDistChart();
  renderTable(rows);
}
renderAll();

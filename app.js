const {indexData, analyze, regionChanges, signed, number} = globalThis.GrainCalculations;

const $ = selector => document.querySelector(selector);
let index, changes, selected = 'CN', showAllRegions = false;
let revealStep = 0, guess = null, revealTimer = null;
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');

const rowFor = (code, year) => year === 2024 ? index.a.get(code) : index.b.get(code);
const infoFor = code => analyze(index.a.get(code), index.b.get(code));
const wheatMark = () => `<svg class="wheat-mark" viewBox="0 0 100 180" fill="none" aria-hidden="true"><path d="M50 10V178" stroke="currentColor" stroke-width="2"/>${[0,27,54,81,108].map(y=>`<g transform="translate(0 ${y})"><path d="M50 39C24 37 16 22 15 8C37 8 50 21 50 39Z" fill="currentColor" fill-opacity=".1" stroke="currentColor"/><path d="M50 39C76 37 84 22 85 8C63 8 50 21 50 39Z" fill="currentColor" fill-opacity=".1" stroke="currentColor"/></g>`).join('')}</svg>`;

function initSelectors() {
  const options = [...index.a.values()].filter(x => x.code !== 'CN');
  for (const id of ['breakdown-region', 'compare-a', 'compare-b']) {
    const select = $('#' + id);
    select.innerHTML = (id === 'breakdown-region' ? '<option value="CN">全国总计</option>' : '') + options.map(x => `<option value="${x.code}">${x.name}</option>`).join('');
  }
  $('#compare-a').value = 'HL';
  $('#compare-b').value = 'HA';
  $('#breakdown-region').addEventListener('change', e => selectRegion(e.target.value));
  $('#compare-a').addEventListener('change', renderCompare);
  $('#compare-b').addEventListener('change', renderCompare);
  $('#swap-regions').addEventListener('click', () => {const a=$('#compare-a'),b=$('#compare-b');[a.value,b.value]=[b.value,a.value];renderCompare();});
  $('#reset-region').addEventListener('click', () => selectRegion('CN'));
  $('#toggle-regions').addEventListener('click', () => {showAllRegions = !showAllRegions; renderLedger();});
  $('#reveal-next').addEventListener('click', () => {stopReveal(); if(revealStep===3) revealStep=0; else revealStep++; updateReveal();});
  $('#reveal-play').addEventListener('click', () => {if(revealTimer) stopReveal(); else playReveal();});
  $('#reveal-all').addEventListener('click', () => {stopReveal();revealStep=3;updateReveal();});
  $('#reveal-national').addEventListener('click', () => {selectRegion('CN');playReveal();});
  const menu=$('.nav-toggle'), nav=$('#chapter-nav');
  const closeMenu=()=>{menu.setAttribute('aria-expanded','false');nav.classList.remove('is-open');};
  menu.addEventListener('click',()=>{const open=menu.getAttribute('aria-expanded')!=='true';menu.setAttribute('aria-expanded',String(open));nav.classList.toggle('is-open',open);});
  nav.querySelectorAll('a').forEach(a=>a.addEventListener('click',closeMenu));
  document.addEventListener('click',e=>{if(!e.target.closest('.topbar')) closeMenu();});
  document.addEventListener('keydown',e=>{if(e.key==='Escape' && menu.getAttribute('aria-expanded')==='true'){closeMenu();menu.focus();}});
  matchMedia('(max-width:760px)').addEventListener('change',closeMenu);
  document.querySelectorAll('[data-guess]').forEach(button => button.addEventListener('click', () => {
    guess=button.dataset.guess;
    document.querySelectorAll('[data-guess]').forEach(x => {x.classList.toggle('is-selected', x===button);x.setAttribute('aria-pressed',String(x===button));});
    $('#guess-result').textContent = `已记录你的猜想：${guess==='area'?'面积':'单产'}变化对应的贡献更大。先看地区的增与减，再到第二幕揭晓。`;
    updateReveal();
  }));
}

function summaryCard(label, value, note, tone) {
  return `<div class="summary-card"><span class="tiny-label">${label}</span><strong class="${tone}">${value}</strong><p>${note}</p></div>`;
}

function renderLedger() {
  const positive = changes.filter(x => x.official > 0).sort((a,b) => b.official-a.official);
  const negative = changes.filter(x => x.official < 0).sort((a,b) => b.official-a.official);
  const posSum = positive.reduce((sum,x) => sum+x.official,0);
  const negSum = negative.reduce((sum,x) => sum+x.official,0);
  const official = infoFor('CN').official;
  const gap = official - posSum - negSum;
  $('#harvest-flow').innerHTML = `<div><span>2024 全国</span><strong>${number(rowFor('CN',2024).production_10k_t)}</strong><small>万吨</small></div><i>→</i><div><span>增产地区</span><strong class="positive">${signed(posSum)}</strong><small>万吨</small></div><i>−</i><div><span>减产抵消</span><strong class="negative">${number(Math.abs(negSum))}</strong><small>万吨</small></div><i>−</i><div><span>舍入差额调整</span><strong>${number(Math.abs(gap))}</strong><small>万吨</small></div><i>→</i><div><span>2025 全国</span><strong>${number(rowFor('CN',2025).production_10k_t)}</strong><small>万吨</small></div>`;
  $('#ledger-summary').innerHTML = summaryCard('增产地区合计', `${signed(posSum,1)} 万吨`, `${positive.length}个地区的公布值变化之和`, 'positive') + summaryCard('减产地区合计', `${signed(negSum,1)} 万吨`, `${negative.length}个地区的公布值变化之和`, 'negative') + summaryCard('全国官方净增量', `${signed(official,1)} 万吨`, `全国行与分省变化之和相差 ${number(Math.abs(gap),1)} 万吨（四舍五入）`, 'gold');
  $('#ledger-takeaway').textContent = `${positive.length}个地区增产，合计 ${signed(posSum,1)} 万吨；${negative.length}个地区减产，合计 ${signed(negSum,1)} 万吨。相互抵消后，全国官方净增 ${signed(official,1)} 万吨。`;
  const selectedPositive = positive.find(x => x.code === selected);
  const extraSelected = !showAllRegions && selectedPositive && !positive.slice(0,8).some(x => x.code === selected);
  const visiblePositive = showAllRegions ? positive : extraSelected ? [...positive.slice(0,7),selectedPositive].sort((a,b)=>b.official-a.official) : positive.slice(0,8);
  const visible = [...visiblePositive,...negative];
  $('#ledger-view-label').textContent = showAllRegions ? '全部31个地区 · 按变化值排序' : extraSelected ? '增产前7名、当前所选地区与全部减产地区' : '增产前8名与全部减产地区';
  const toggle = $('#toggle-regions');
  toggle.textContent = showAllRegions ? '收起代表地区 ↑' : '展开全部31个地区 ↓';
  toggle.setAttribute('aria-expanded', String(showAllRegions));
  const max = Math.max(...changes.map(x => Math.abs(x.official)));
  $('#region-list').innerHTML = visible.map(x => {
    const tone = x.official < 0 ? 'negative' : 'positive';
    const width = (Math.abs(x.official)/max*91).toFixed(3);
    return `<button class="region-row ${tone} ${selected === x.code ? 'is-selected' : ''}" type="button" data-code="${x.code}" aria-pressed="${selected === x.code}" aria-label="${x.name}，${signed(x.official,1)}万吨，选择查看详情" style="--bar-width:${width}%"><span class="region-name">${x.name}</span><span class="region-track" aria-hidden="true"><span class="region-zero"></span><span class="region-fill"></span></span><span class="region-value">${signed(x.official,1)}</span></button>`;
  }).join('');
  document.querySelectorAll('.region-row').forEach(button => button.addEventListener('click', () => selectRegion(button.dataset.code)));
  $('#ledger-offset').innerHTML = `<div><span class="tiny-label">减产抵消 / 2个地区</span><strong>${signed(negSum,1)} 万吨</strong><p>${negative.map(x=>`${x.name} ${signed(x.official,1)} 万吨`).join('，')}。按分省公布值汇总的净增量为 ${signed(posSum+negSum,1)} 万吨，与全国官方行相差 ${number(Math.abs(gap),1)} 万吨。</p></div>`;
  const a = rowFor(selected,2024), b = rowFor(selected,2025), d = infoFor(selected);
  $('#selected-region').innerHTML = `<h3>${a.name}</h3><div class="selected-metrics"><span>2024年产量<strong>${number(a.production_10k_t)} 万吨</strong></span><span>2025年产量<strong>${number(b.production_10k_t)} 万吨</strong></span><span>变化<strong style="color:${d.official >= 0 ? 'var(--positive)' : 'var(--negative)'}">${signed(d.official)} 万吨</strong></span></div>`;
}

function selectRegion(code) {
  if (!index.a.has(code)) return;
  const focusedCode=document.activeElement?.classList.contains('region-row') ? document.activeElement.dataset.code : null;
  stopReveal();revealStep=0;
  selected = code;
  $('#breakdown-region').value = code;
  renderLedger();
  renderBreakdown();
  if(focusedCode) document.querySelector(`.region-row[data-code="${focusedCode}"]`)?.focus({preventScroll:true});
}

function metricCard(title, a, b, unit) {
  return `<div class="metric-card"><header>${title}</header><div class="metric-years"><div><span>2024</span><strong>${number(a)}</strong></div><b>→</b><div><span>2025</span><strong>${number(b)}</strong></div></div><p class="metric-delta">变化 <strong>${signed(b-a)}</strong> ${unit}</p></div>`;
}

function renderBreakdown() {
  const a=rowFor(selected,2024), b=rowFor(selected,2025), d=infoFor(selected);
  $('#breakdown-region-title').textContent = a.name;
  $('#metric-grid').innerHTML = metricCard('播种面积 / 千公顷',a.area_kha,b.area_kha,'千公顷') + metricCard('单位面积产量 / 公斤/公顷',a.yield_kg_ha,b.yield_kg_ha,'公斤/公顷') + metricCard('总产量 / 万吨',a.production_10k_t,b.production_10k_t,'万吨');
  const max = Math.max(Math.abs(d.area),Math.abs(d.yieldPart),Math.abs(d.modelChange),0.001);
  $('#balance-scale').innerHTML=`<span>${signed(-max,1)}</span><b>0 · 万吨</b><span>${signed(max,1)}</span>`;
  $('#contribution-chart').innerHTML = [['面积变化贡献',d.area],['单产变化贡献',d.yieldPart],['两项相加 · 模型变化',d.modelChange]].map(([name,value],i)=>`<div class="balance-row ${value<0?'is-negative':''} ${i===2?'is-total':''}" data-reveal="${i+1}" style="--balance-width:${(Math.abs(value)/max*45).toFixed(4)}%"><div class="balance-label"><span>${name}</span><strong class="balance-value" data-value="${signed(value,2)}">待揭晓</strong></div><div class="balance-track" aria-hidden="true"><i></i><span class="balance-fill"></span></div></div>`).join('');
  $('#harvest-composer').innerHTML=`<div class="composer-caption"><span class="tiny-label">丰收合成 / 两项汇成一个变化</span><span>${a.name} · 万吨</span></div><div class="composer-grid"><article class="compose-part ${d.area<0?'negative':'positive'}" data-compose="1"><span>面积变化贡献</span><strong class="compose-value" data-value="${signed(d.area,2)}">待揭晓</strong><small>${d.area<0?'负向对应':'正向对应'}</small></article><span class="compose-link" aria-hidden="true">→</span><article class="compose-net" data-compose="3"><div class="compose-kernel"><div><span>模型变化</span><strong class="compose-value" data-value="${signed(d.modelChange,2)}">待合成</strong><small>两项贡献相加</small></div></div></article><span class="compose-link" aria-hidden="true">←</span><article class="compose-part ${d.yieldPart<0?'negative':'positive'}" data-compose="2"><span>单产变化贡献</span><strong class="compose-value" data-value="${signed(d.yieldPart,2)}">待揭晓</strong><small>${d.yieldPart<0?'负向对应':'正向对应'}</small></article></div><p class="composer-note">麦粒与连线表达合成关系，不表示数值比例；下方共用零轴图保留真实数量刻度。</p>`;
  updateReveal();
}

function stopReveal(){clearTimeout(revealTimer);revealTimer=null;$('#reveal-play').textContent='自动播放 ▷';}

function playReveal(){
  stopReveal();
  if(reducedMotion.matches){revealStep=3;updateReveal();return;}
  revealStep=0;updateReveal();
  const advance=()=>{revealStep++;updateReveal();if(revealStep<3){revealTimer=setTimeout(advance,1100);$('#reveal-play').textContent='暂停播放 Ⅱ';}else stopReveal();};
  revealTimer=setTimeout(advance,200);$('#reveal-play').textContent='暂停播放 Ⅱ';
}

function updateReveal(){
  if(!index || !$('#contribution-chart .balance-row')) return;
  const d=infoFor(selected), name=rowFor(selected,2024).name;
  document.querySelectorAll('[data-reveal]').forEach(row=>{const shown=Number(row.dataset.reveal)<=revealStep;row.classList.toggle('is-revealed',shown);const value=row.querySelector('.balance-value');value.textContent=shown?value.dataset.value:'待揭晓';});
  document.querySelectorAll('[data-compose]').forEach(part=>{const shown=Number(part.dataset.compose)<=revealStep;part.classList.toggle('is-ready',shown);const value=part.querySelector('.compose-value');value.textContent=shown?value.dataset.value:Number(part.dataset.compose)===3?'待合成':'待揭晓';});
  document.querySelectorAll('.reveal-steps [data-step]').forEach(step=>step.classList.toggle('is-complete',Number(step.dataset.step)<=revealStep));
  $('#reveal-next').textContent=['01 揭晓面积贡献 →','02 揭晓单产贡献 →','03 合成模型变化 →','重新拆解 ↺'][revealStep];
  $('#official-change').textContent=revealStep===3?signed(d.official,1):'等待合成';
  $('#residual-note').textContent=revealStep===3?`模型变化 ${signed(d.modelChange,3)} 万吨；舍入余差 ${signed(d.residual,3)} 万吨。模型变化 + 余差 = 官方变化。`:'第三步会同时展示模型变化、官方变化和舍入余差。';
  const opposing=d.area*d.yieldPart<0;
  $('#reveal-conclusion').textContent=revealStep===3?`${name}：面积贡献 ${signed(d.area,2)} 万吨 ${d.yieldPart<0?'−':'+'} 单产贡献幅度 ${number(Math.abs(d.yieldPart),2)} 万吨 ≈ 模型变化 ${signed(d.modelChange,2)} 万吨。${opposing?'两个方向相互抵消。':'两项按各自正负方向相加。'}展示值保留两位小数；这是数量分解，不是因果判断。`:revealStep===2?'两项贡献都已出现。它们是在同一方向叠加，还是向相反方向抵消？再按一次，查看合成结果。':revealStep===1?'先看面积变化对应的数量。接下来揭晓单产贡献，观察它的方向与大小。':'先拆面积，再拆单产。按第一步开始，也可以直接查看全部结果。';
  if(guess && selected==='CN' && revealStep===3){
    const correct=Math.abs(d.yieldPart)>Math.abs(d.area)?'yield':'area';
    $('#guess-feedback').textContent=`${guess===correct?'你的猜想与结果一致。':'结果与你的猜想不同。'}全国的对称分解中，面积变化对应 ${number(d.area,1)} 万吨，单产变化对应 ${number(d.yieldPart,1)} 万吨。`;
  }else $('#guess-feedback').textContent=guess?`你的全国猜想：${guess==='area'?'面积':'单产'}贡献更大。${selected==='CN'?'完成第三步，核对你的判断。':'当前查看地区数据；按右侧按钮回到全国揭晓。'}`:'从面积开始，再看单产，最后让两项变化相加。';
}

function compareMetric(title,key,unit,a0,a1,b0,b1) {
  const values=[a0[key],a1[key],b0[key],b1[key]], max=Math.max(...values);
  const col=(name,oldRow,newRow)=>`<div class="compare-column"><h4>${name}</h4>${[[2024,oldRow],[2025,newRow]].map(([year,row])=>`<div class="compare-barline ${year===2025?'is-current':''}"><span>${year}</span><span class="compare-track"><span class="compare-fill" style="width:${(row[key]/max*100).toFixed(2)}%"></span></span><strong>${number(row[key])}</strong></div>`).join('')}</div>`;
  return `<div class="compare-metric"><h3>${title}<span>${unit} · 两地共用刻度</span></h3><div class="compare-columns">${col(a0.name,a0,a1)}${col(b0.name,b0,b1)}</div></div>`;
}

function renderCompare() {
  const ac=$('#compare-a').value, bc=$('#compare-b').value;
  if (ac === bc) {$('#compare-error').textContent='请选择两个不同地区。';$('#compare-charts').innerHTML='';$('#compare-deltas').innerHTML='';$('#compare-paths').innerHTML='';$('#compare-summary').textContent='';return;}
  $('#compare-error').textContent='';
  const a0=rowFor(ac,2024),a1=rowFor(ac,2025),b0=rowFor(bc,2024),b1=rowFor(bc,2025),ad=infoFor(ac),bd=infoFor(bc);
  $('#compare-charts').innerHTML=compareMetric('总产量','production_10k_t','万吨',a0,a1,b0,b1)+compareMetric('播种面积','area_kha','千公顷',a0,a1,b0,b1)+compareMetric('单位面积产量','yield_kg_ha','公斤/公顷',a0,a1,b0,b1);
  const metrics=[['总产量变化','production_10k_t','万吨'],['播种面积变化','area_kha','千公顷'],['单位面积产量变化','yield_kg_ha','公斤/公顷']];
  $('#compare-deltas').innerHTML=`<div class="delta-heading"><h3>一年之间，变了多少？</h3><span>2025 − 2024</span></div><div class="delta-grid">${metrics.map(([title,key,unit])=>`<article class="delta-card"><h4>${title}</h4>${[[a0,a1],[b0,b1]].map(([oldRow,newRow])=>{const delta=newRow[key]-oldRow[key];return `<div><span>${newRow.name}</span><strong class="${delta<0?'negative':'positive'}">${signed(delta,1)}</strong></div>`;}).join('')}<small>${unit}</small></article>`).join('')}</div>`;
  const movement = (row,d) => `${row.name}产量${d.official>0?'增加':d.official<0?'减少':'持平'}${d.official===0?'':number(Math.abs(d.official))+'万吨'}`;
  const direction=(x)=>x>0?'增加':x<0?'减少':'不变';
  const pattern=(oldRow,newRow)=>`${newRow.name}的面积${direction(newRow.area_kha-oldRow.area_kha)}、单产${direction(newRow.yield_kg_ha-oldRow.yield_kg_ha)}`;
  const relation=ad.official>0&&bd.official>0?'两地都增产，幅度各有不同。':ad.official<0&&bd.official<0?'两地都减产，变化结构值得分别观察。':ad.official*bd.official<0?'两地一增一减，全国净变化中同时存在这两种方向。':'两地的产量变化方向不同。';
  $('#compare-summary').textContent = `${relation}${movement(a1,ad)}，${movement(b1,bd)}。${pattern(a0,a1)}；${pattern(b0,b1)}。这些方向是统计描述，具体的数量分解可回到第二幕查看。`;
  $('#compare-paths').innerHTML=[[a1,ad],[b1,bd]].map(([row,d])=>{
    const areaLarger=Math.abs(d.area)>Math.abs(d.yieldPart), dominant=areaLarger?'面积':'单产', opposite=d.area*d.yieldPart<0;
    const equal=Math.abs(Math.abs(d.area)-Math.abs(d.yieldPart))<1e-7;
    const title=opposite?(d.modelChange>0?'有抵消，模型仍增加':d.modelChange<0?'有抵消，模型仍减少':'正负贡献相互抵消'):(d.modelChange>0?'两项同向增加':d.modelChange<0?'两项同向减少':'模型变化接近零');
    const insight=`对称分解中，面积变化对应 ${signed(d.area,2)} 万吨，单产变化对应 ${signed(d.yieldPart,2)} 万吨。${equal?'两项贡献幅度相当':`${dominant}贡献的绝对幅度较大`}，相加得到模型变化 ${signed(d.modelChange,2)} 万吨。`;
    return `<article class="path-card">${wheatMark()}<span class="tiny-label">${row.name} / 数量路径</span><h4>${title}</h4><p>${insight}</p><small>官方产量变化 ${signed(d.official,1)} 万吨；舍入余差 ${signed(d.residual,3)} 万吨。分解描述数量关系，不判断原因。</small></article>`;
  }).join('');
}

function renderEnding(){
  const national=infoFor('CN'), up=changes.filter(x=>x.official>0).length, down=changes.filter(x=>x.official<0).length;
  const leading=Math.abs(national.yieldPart)>Math.abs(national.area)?'单产':'面积';
  $('#ending-summary').textContent=`2025年，全国粮食产量增加约${number(Math.round(national.official),0)}万吨。${up}个地区增产、${down}个地区减产；在全国的对称分解中，${leading}变化对应的贡献更大。`;
  $('#ending-findings').innerHTML=`<article><span>看见增减</span><strong>${up} <i>/</i> ${down}</strong><p>增产与减产地区<br>共同形成全国净变化</p></article><article><span>读懂数量</span><strong>${number(national.area,1)}</strong><p>万吨 · 面积变化对应<br>对称分解的模型贡献</p></article><article><span>重新认识丰收</span><strong>${number(national.yieldPart,1)}</strong><p>万吨 · 单产变化对应<br>对称分解的模型贡献</p></article>`;
  $('#poster-wheat').innerHTML=wheatMark();
}

function start() {
  try {
    if (!globalThis.GRAIN_DATA) throw new Error('地区数据文件未载入');
    index=indexData(globalThis.GRAIN_DATA);
    changes=regionChanges(index);
    if (Math.abs(infoFor('CN').official-837.7)>1e-7) throw new Error('全国数值校验失败');
    initSelectors();renderLedger();renderBreakdown();renderCompare();renderEnding();
    document.querySelectorAll('.chapter-heading .section-index').forEach(label=>label.insertAdjacentHTML('afterbegin',wheatMark()));
  } catch (error) {
    console.error(error);
    const message = `数据无法载入：${error.message}。请确认 data/grain-data.js 与 index.html 在同一作品文件夹内，然后重新打开网页。`;
    $('#ledger-summary').innerHTML=`<div class="summary-card"><strong>数据无法载入</strong><p>${message}</p></div>`;
    $('#breakdown-region').innerHTML='<option>地区数据未载入</option>';
    $('#breakdown-region').disabled=true;
    $('#compare-a').disabled=true;
    $('#compare-b').disabled=true;
    $('#compare-error').textContent=message;
  }
}
start();

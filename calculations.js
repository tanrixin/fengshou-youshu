(() => {
const round = (n, digits = 1) => Number(n.toFixed(digits));
const signed = (n, digits = 1) => `${n >= 0 ? '+' : '−'}${Math.abs(n).toLocaleString('zh-CN', {minimumFractionDigits:digits, maximumFractionDigits:digits})}`;
const number = (n, digits = 1) => n.toLocaleString('zh-CN', {minimumFractionDigits:digits, maximumFractionDigits:digits});

function indexData(data) {
  const a = new Map(data.years['2024'].map(row => [row.code, row]));
  const b = new Map(data.years['2025'].map(row => [row.code, row]));
  if (a.size !== 32 || b.size !== 32 || [...a.keys()].some(code => !b.has(code))) throw new Error('地区数据不完整');
  return {a, b};
}

function analyze(a, b) {
  const model0 = a.area_kha * a.yield_kg_ha / 10000;
  const model1 = b.area_kha * b.yield_kg_ha / 10000;
  const area = (b.area_kha - a.area_kha) * (a.yield_kg_ha + b.yield_kg_ha) / 20000;
  const yieldPart = (b.yield_kg_ha - a.yield_kg_ha) * (a.area_kha + b.area_kha) / 20000;
  const official = b.production_10k_t - a.production_10k_t;
  const modelChange = model1 - model0;
  return {area, yieldPart, official, modelChange, residual: official - area - yieldPart};
}

function regionChanges(index) {
  return [...index.a.keys()].filter(code => code !== 'CN').map(code => ({code, name:index.a.get(code).name, ...analyze(index.a.get(code), index.b.get(code))}));
}

globalThis.GrainCalculations = {round, signed, number, indexData, analyze, regionChanges};
})();

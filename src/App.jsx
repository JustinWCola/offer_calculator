import React, { useEffect, useRef, useState } from 'react';
import { calculate, cityPresets } from './calculator.js';
import { scoreFactors } from './scoring.js';

const STORAGE_KEY = 'offer-deck:v1';
const MAX_OFFERS = 4;
const cities = { beijing: '北京', shanghai: '上海', shenzhen: '深圳', guangzhou: '广州', hangzhou: '杭州', chengdu: '成都', nanjing: '南京', wuhan: '武汉', custom: '自定义' };
const suits = ['♠', '♥', '♣', '♦'];
const newId = () => globalThis.crypto?.randomUUID?.() ?? `offer-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
const money = value => new Intl.NumberFormat('zh-CN', { style: 'currency', currency: 'CNY', maximumFractionDigits: 0 }).format(value);
const wan = value => `${(value / 10000).toFixed(1)} 万`;
const scoreNumber = (value, precision = 1) => Math.abs(value) >= 1000000 ? value.toExponential(1) : value.toLocaleString('en-US', { maximumFractionDigits: precision });
const defaults = {
  city: 'beijing', monthlyBase: 28000, salaryMonths: 13, monthlyAllowance: 0, allowanceMonths: 12,
  annualBonus: 30000, bonusFactor: 1, bonusTax: 'separate', signOn: 0, signFactor: 1, signTax: 'comprehensive',
  stock: 0, stockFactor: 1, stockTax: 'equity', option: 0, optionFactor: 0.3, optionTax: 'equity',
  otherCash: 0, otherFactor: 1, otherTax: 'comprehensive', benefits: 0, benefitFactor: 0.5,
  baseMode: 'salary', socialBase: 28000, fundBase: 28000, contribMonths: 12,
  specialDeduction: 0, otherDeduction: 0, weekdayDays: 5, weekdayHours: 8, weekendDays: 0, weekendHours: 0,
  growth: 1, locationFactor: 1,
};
const labels = {
  monthlyBase: '税前月薪', salaryMonths: '发薪月数', monthlyAllowance: '每月补贴', allowanceMonths: '补贴月数',
  annualBonus: '额外年终奖', bonusFactor: '奖金兑现系数', signOn: '签字费', signFactor: '签字费兑现系数',
  stock: '本年归属股票', stockFactor: '股票兑现系数', option: '本年可实现期权', optionFactor: '期权兑现系数',
  otherCash: '其他现金', otherFactor: '其他现金兑现系数', benefits: '非现金福利', benefitFactor: '福利折算系数',
  socialBase: '社保缴费基数', fundBase: '公积金缴费基数', contribMonths: '缴纳月数',
  pensionRate: '养老比例', medicalRate: '医疗比例', unemploymentRate: '失业比例', otherSocialRate: '其他社保比例', fundRate: '公积金比例',
  medicalFixed: '每月医疗固定费用', socialMin: '社保基数下限', socialMax: '社保基数上限', fundMin: '公积金基数下限', fundMax: '公积金基数上限',
  specialDeduction: '全年专项附加扣除', otherDeduction: '全年其他税前扣除',
  weekdayDays: '每周工作日', weekdayHours: '工作日每天工时', weekendDays: '每周加班日', weekendHours: '周末每天工时', growth: '成长系数', locationFactor: '生活偏好系数',
};

function presetFields(city) {
  const p = cityPresets[city];
  return { pensionRate: p.p, medicalRate: p.m, unemploymentRate: p.u, otherSocialRate: p.o, fundRate: p.f,
    socialMin: p.socialMin, socialMax: p.socialMax, fundMin: p.fundMin, fundMax: p.fundMax, medicalFixed: p.medicalFixed };
}
function makeOffer(name, overrides = {}) {
  const input = { ...defaults, ...overrides };
  return { id: newId(), name, input: { ...input, ...presetFields(input.city) } };
}
function exampleOffers() {
  return [makeOffer('稳稳的幸福'), makeOffer('冲一把未来', { city: 'shanghai', monthlyBase: 34000, salaryMonths: 14,
    annualBonus: 0, stock: 80000, stockFactor: 0.8, weekdayHours: 10, growth: 1.15 })];
}
function loadOffers() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (Array.isArray(saved) && saved.length > 0 && saved.length <= MAX_OFFERS && saved.every(o =>
      typeof o.id === 'string' && typeof o.name === 'string' && o.input && Object.keys(cities).includes(o.input.city)) &&
      new Set(saved.map(o => o.id)).size === saved.length) {
      return saved.map(o => ({ id: o.id, name: o.name.slice(0, 32), input: { ...defaults, ...presetFields(o.input.city),
        ...Object.fromEntries(Object.entries(o.input).filter(([key, value]) =>
          (Object.hasOwn(defaults, key) || Object.hasOwn(labels, key)) && ['number', 'string'].includes(typeof value))) } }));
    }
  } catch { /* A blocked or damaged local store falls back to editable examples. */ }
  return exampleOffers();
}
function evaluate(offer) {
  try { return { ...offer, result: calculate(offer.input), error: null }; }
  catch (error) {
    let message = error.message;
    for (const [key, label] of Object.entries(labels).sort((a, b) => b[0].length - a[0].length)) message = message.replaceAll(key, label);
    return { ...offer, result: null, error: message };
  }
}

function NumberField({ offer, field, update, unit = '元', min = 0, max, step = 'any', wide = false, cap = false, disabled = false }) {
  const id = `${offer.id}-${field}`;
  return <div className={`field ${wide ? 'field-wide' : ''}`}>
    <label className="field-label" htmlFor={id}>{labels[field]}</label>
    <div className="input-wrap">
      <input id={id} type="number" min={min} max={max} step={step} disabled={disabled}
        value={cap && Number(offer.input[field]) === Number.MAX_SAFE_INTEGER ? '' : offer.input[field]}
        placeholder={cap ? '未设上限' : '请输入'}
        onChange={e => update(field, cap && e.target.value === '' ? Number.MAX_SAFE_INTEGER : e.target.value)} />
      <span className="input-suffix">{unit}</span>
    </div>
  </div>;
}
function SelectField({ offer, field, label, options, update, wide = false }) {
  const id = `${offer.id}-${field}`;
  return <div className={`field ${wide ? 'field-wide' : ''}`}>
    <label className="field-label" htmlFor={id}>{label || labels[field]}</label>
    <select id={id} value={offer.input[field]} onChange={e => update(field, e.target.value)}>
      {options.map(([value, title]) => <option key={value} value={value}>{title}</option>)}
    </select>
  </div>;
}
const taxOptions = [['comprehensive', '并入综合所得'], ['none', '本年不计税']];
const equityOptions = [['equity', '符合条件股权单独计税'], ...taxOptions];

function OfferCard({ offer, index, isBest, isActive, maxHourly, onUpdate, onRemove, onDuplicate, onPlay, canDuplicate, canRemove }) {
  const { result: r, error } = offer;
  const update = (field, value) => onUpdate(offer.id, field, value);
  const number = (field, options = {}) => <NumberField key={field} offer={offer} field={field} update={update} {...options} />;
  const select = (field, options, label) => <SelectField key={field} offer={offer} field={field} update={update} options={options} label={label} />;
  return <article className={`offer-card ${isBest ? 'is-best' : ''} ${isActive ? 'is-active' : ''}`} aria-label={`Offer ${index + 1}：${offer.name}`}>
    <div className="card-header">
      <div className={`card-suit ${index % 2 ? 'red' : ''}`} aria-hidden="true">{suits[index]}<small>{String(index + 1).padStart(2, '0')}</small></div>
      <div className="card-heading">
        <label className="sr-only" htmlFor={`${offer.id}-name`}>Offer {index + 1} 名称</label>
        <input className="card-title" id={`${offer.id}-name`} value={offer.name} maxLength={32}
          onChange={e => onUpdate(offer.id, 'name', e.target.value)} />
        <div className="card-meta">{isBest ? '★ 当前最优手牌' : `OFFER #${String(index + 1).padStart(2, '0')}`} · {cities[offer.input.city]}</div>
      </div>
      <div className="card-actions">
        <button className="card-action" onClick={() => onDuplicate(offer.id)} disabled={!canDuplicate} title="复制这份 Offer" aria-label={`复制 Offer ${index + 1}`}>⧉</button>
        <button className="card-action" onClick={() => onRemove(offer.id)} disabled={!canRemove} title="移除这份 Offer" aria-label={`移除 Offer ${index + 1}`}>×</button>
      </div>
    </div>

    <div className="section-label"><span>01</span> 筹码 · 收入</div>
    <div className="field-grid">
      {number('monthlyBase', { step: 500 })}
      {number('salaryMonths', { unit: '月', step: 0.5 })}
      {number('annualBonus', { step: 1000 })}
      {select('city', Object.entries(cities), '工作城市')}
    </div>
    <p className="field-help">年终奖只填额外奖金，避免与多薪重复计入。</p>
    <div className="section-label"><span>02</span> 回合 · 时间</div>
    <div className="field-grid">
      {number('weekdayHours', { unit: '小时', max: 24, step: 0.5 })}
      {number('weekdayDays', { unit: '天', max: 5, step: 0.5 })}
    </div>

    <details className="advanced-settings">
      <summary>加上你的「小丑牌」<span>奖金、股权、税费、偏好</span></summary>
      <div className="advanced-content">
        <div className="section-label">浮动收入与兑现比例</div>
        <div className="field-grid">
          {number('monthlyAllowance')}{number('allowanceMonths', { unit: '月', max: 12 })}
          {number('bonusFactor', { unit: '×', max: 1, step: 0.05 })}
          {select('bonusTax', [['separate', '全年一次性奖金单独计税'], ['comprehensive', '并入综合所得']], '奖金计税方式')}
          {number('signOn')}{number('signFactor', { unit: '×', max: 1, step: 0.05 })}
          {select('signTax', taxOptions, '签字费计税方式')}
          {number('stock')}{number('stockFactor', { unit: '×', max: 1, step: 0.05 })}
          {select('stockTax', equityOptions, '股票计税方式')}
          {number('option')}{number('optionFactor', { unit: '×', max: 1, step: 0.05 })}
          {select('optionTax', equityOptions, '期权计税方式')}
          {number('otherCash')}{number('otherFactor', { unit: '×', max: 1, step: 0.05 })}
          {select('otherTax', taxOptions, '其他现金计税方式')}
          {number('benefits')}{number('benefitFactor', { unit: '×', max: 1, step: 0.05 })}
        </div>
        <p className="field-help">股票只填本年归属价值；签字费只影响本年。税费按名义金额计算，兑现折扣只用于价值比较。</p>
        <div className="section-label">五险一金 · 个人承担部分</div>
        <div className="field-grid">
          {select('baseMode', [['salary', '按月薪估算并限额'], ['custom', '手动输入缴费基数']], '缴费基数模式')}
          {number('contribMonths', { unit: '月', max: 12 })}
          {offer.input.baseMode === 'custom' && <>{number('socialBase')}{number('fundBase')}</>}
          {['pensionRate', 'medicalRate', 'unemploymentRate', 'otherSocialRate', 'fundRate'].map(field => number(field, { unit: '%', max: 100, step: 0.1 }))}
          {number('medicalFixed')}
          {number('socialMin')}{number('socialMax', { cap: true })}{number('fundMin')}{number('fundMax', { cap: true })}
        </div>
        <p className="field-help">北京使用 2025–2026 历史参考参数，其他城市仅预填示例比例及零下限，不设上限。请按实际年度与公司口径调整。</p>
        <div className="section-label">税前扣除 · 全年金额</div>
        <div className="field-grid">{number('specialDeduction')}{number('otherDeduction')}</div>
        <div className="section-label">工时与个人偏好</div>
        <div className="field-grid">
          {number('weekendDays', { unit: '天', max: 2, step: 0.5 })}
          {number('weekendHours', { unit: '小时', max: 24, step: 0.5 })}
          {number('growth', { unit: '×', step: 0.05 })}{number('locationFactor', { unit: '×', step: 0.05 })}
        </div>
        <p className="field-help">1 为中性偏好。工作日超出 8 小时的部分按 1.5 倍、周末按 2 倍加权。</p>
      </div>
    </details>

    <div className="card-divider" />
    <button className="play-button" onClick={() => onPlay(offer.id)} disabled={Boolean(error)} aria-pressed={isActive}>
      {isActive ? '▶ 再次计分' : '▶ 打出这张牌'}<span>{isActive ? '当前计分手牌' : '查看底数 × 倍率'}</span>
    </button>
    {error ? <div className="input-error" role="alert"><strong>这张牌还没算好</strong><p>{error}</p></div> : <>
      <div className="score-row">
        <div><div className="score-caption">等效税后时薪</div><div className="score-value">{money(r.eqAfterHourly)}<small> / h</small></div></div>
        <span className={`rating-chip ${isBest ? 'top-rating' : ''}`}>{r.rating.label}</span>
      </div>
      <div className="meter" aria-hidden="true"><span style={{ width: `${Math.max(0, Math.min(100, r.eqAfterHourly / Math.max(maxHourly, 1) * 100))}%` }} /></div>
      <div className="breakdown">
        {[['名义税前总包', wan(r.nominalTC)], ['预计税后价值', wan(r.afterTaxValue)], ['税后 855 等效', wan(r.eqAfter)], ['实际 / 加权周工时', `${r.wh.actual.toFixed(1)} / ${r.wh.weighted.toFixed(1)} h`]].map(([label, value]) =>
          <div className="breakdown-row" key={label}><span>{label}</span><strong>{value}</strong></div>)}
      </div>
      <details className="result-details"><summary>展开收入与税费明细</summary><div className="breakdown">
        {[['固定工资', r.salary], ['固定补贴', r.allowance], ['额外奖金', r.bonus], ['签字费', r.sign], ['股票 / 期权', r.stock + r.option],
          ['其他现金 / 福利', r.other + r.benefits], ['价值折算总包', r.adjustedTC], ['综合所得个税', r.taxComp], ['奖金个税', r.taxBonus],
          ['股权个税', r.taxEquity], ['个税合计', r.taxTotal], ['养老保险', r.pension], ['医疗保险', r.medical], ['失业保险', r.unemployment],
          ['其他个人社保', r.otherSocial], ['个人公积金', r.fund], ['个人五险一金合计', r.socialTotal], ['月均税后价值', r.afterTaxValue / 12],
          ['实际社保月基数', r.appliedSocialBase], ['实际公积金月基数', r.appliedFundBase]].map(([label, value]) =>
            <div className="breakdown-row" key={label}><span>{label}</span><strong>{money(value)}</strong></div>)}
      </div></details>
    </>}
    <div className="card-bottom" aria-hidden="true">{suits[index]} <span>PLAY YOUR NEXT HAND</span> {suits[index]}</div>
  </article>;
}

function MethodDialog({ dialogRef }) {
  return <dialog className="method-dialog" aria-labelledby="rules-title" ref={dialogRef} onClick={e => { if (e.target === e.currentTarget) dialogRef.current.close(); }}>
    <div className="dialog-header"><div><span className="eyebrow">THE RULES</span><h2 id="rules-title">这副牌怎么算？</h2></div>
      <button className="dialog-close" aria-label="关闭计算规则" onClick={() => dialogRef.current.close()}>×</button></div>
    <div className="method-content">
      <h3>① 先数清筹码</h3><p>名义总包 = 月薪 × 发薪月数 + 补贴 + 奖金 + 签字费 + 本年归属股权 + 其他收入 + 福利。浮动收入再乘以各自的兑现系数，得到价值折算总包。</p>
      <h3>② 扣掉税费</h3><p>综合所得使用年度七级税率，扣除 60,000 元基本减除费用、个人五险一金及全年税前扣除。奖金可以单独计税，符合条件的股权可以单独按年度税率计税。税费按名义金额估算，税后价值包含折算后的权益与福利，不等于现金到账。</p>
      <h3>③ 让时间也有价格</h3><p>加权周工时 = 工作日正常工时 + 1.5 × 工作日超出 8 小时的工时 + 2 × 周末工时。</p>
      <div className="formula">税后 855 等效 = 税后价值 × 成长系数 × 生活偏好系数 × 40 ÷ 加权周工时<br /><br />等效税后时薪 = 税后 855 等效 ÷ 2,080</div>
      <p>855 指每天 8 小时、每周 5 天；全年按 52 周比较。加权工时是比较模型，不是加班工资核算，也不包含假期与通勤。</p>
      <div className="formula">蓝色底数 Chips = 税后价值 ÷ 2080<br />红色倍率 Mult = 40 ÷ 加权周工时 × 成长系数 × 生活偏好系数<br />Chips × Mult = 等效税后时薪</div>
      <p>牌桌计分只是同一公式的拆分展示。显示值经过取整，最终结果始终按未取整数值计算；税费和兑现折扣已经计入蓝色底数。</p>
      <h3>④ 看牌面，也看自己</h3><p>时薪 ≥200 为「夯」，≥120 为「顶级」，≥70 为「人上人」，≥35 为「NPC」，更低为「拉完了」。沿用参考项目的娱乐分档，仅说明当前假设下的回报；成长和生活偏好由你决定。</p>
      <p>城市缴费参数为历史示例，并非实时政策。北京参考 2025 年社保与 2025–2026 年度公积金，其他城市需自行设置基数上下限。股票单独计税有政策条件；请核对实际合同和适用政策。</p>
      <p className="source-credit">计算方法：<a href="https://sherry-roar.github.io/offer-calculate/" target="_blank" rel="noreferrer">sherry-roar / Offer 等效薪资计算器 ↗</a>（MIT）。界面为原创像素牌桌设计，灵感来自 Balatro。</p>
    </div>
  </dialog>;
}

function PixelArt({ kind }) {
  const drawings = {
    clock: <><path fill="#ead7a4" d="M12 4h24v4h4v4h4v24h-4v4h-4v4H12v-4H8v-4H4V12h4V8h4z" /><path fill="#374244" d="M20 10h6v14h12v6H20z" /><path fill="#fe5f55" d="M8 8h8v8H8zM32 32h8v8h-8z" /></>,
    growth: <><path fill="#4bc292" d="M4 28h8v16H4zM18 20h8v24h-8zM32 8h8v36h-8z" /><path fill="#ead7a4" d="M8 10h16V4h16v16h-6v-6h-8v6H12v6H6V16h2z" /></>,
    home: <><path fill="#fe5f55" d="M20 4h8v4h8v8h8v8H4v-8h8V8h8z" /><path fill="#ead7a4" d="M10 24h28v20H10z" /><path fill="#374244" d="M20 28h8v16h-8zM12 28h4v8h-4zM32 28h4v8h-4z" /></>,
    coin: <><path fill="#f3b958" d="M12 4h24v4h4v4h4v24h-4v4h-4v4H12v-4H8v-4H4V12h4V8h4z" /><path fill="#bb7437" d="M14 12h20v6H22v4h10v6H22v4h12v6H14v-6h4v-4h-4v-6h4v-4h-4z" /></>,
    joker: <><path fill="#009dff" d="M4 8h12v4h8v16H12V16H4z" /><path fill="#fe5f55" d="M32 4h12v16h-8v8H24V12h8z" /><path fill="#f3b958" d="M4 4h8v8H4zM36 0h8v8h-8z" /><path fill="#ead7a4" d="M12 24h24v16H12z" /><path fill="#374244" d="M16 28h4v4h-4zM28 28h4v4h-4zM20 36h8v4h-8z" /><path fill="#4bc292" d="M8 40h12v8H8zM28 40h12v8H28z" /></>,
  };
  return <svg viewBox="0 0 48 48" aria-hidden="true" shapeRendering="crispEdges">{drawings[kind] || drawings.joker}</svg>;
}

function Scoreboard({ offer, factors, turn }) {
  const r = offer?.result;
  return <section className="panel scoreboard" aria-label="底数乘倍率计分">
    <div className="panel-title"><span>本手计分</span><span className="hud-tag">CHIPS × MULT</span></div>
    <div className="score-hand-name">{offer?.name || '未命名 Offer'}</div>
    <div className="scoreboard-body" aria-live="polite" aria-atomic="true">
      <div className="score-equation" key={turn}>
        <div className="chip-box chips-blue"><span className="chip-label">底数 / Chips</span><strong data-testid="chips" className={factors && scoreNumber(factors.chips).length > 6 ? 'long-number' : ''}>{factors ? scoreNumber(factors.chips) : '—'}</strong><small>税后价值 ÷ 2080</small></div>
        <span className="multiply-sign" aria-label="乘以">×</span>
        <div className="chip-box mult-red"><span className="chip-label">倍率 / Mult</span><strong data-testid="mult" className={factors && scoreNumber(factors.mult, 3).length > 6 ? 'long-number' : ''}>{factors ? scoreNumber(factors.mult, 3) : '—'}</strong><small>时间 × 成长 × 生活</small></div>
      </div>
      <div className="score-total" key={`total-${turn}`}><span>本手得分</span><div className="summary-value" data-testid="hand-score">{r ? `¥${scoreNumber(r.eqAfterHourly)}` : '—'}<small> / h</small></div><p>等效税后时薪</p></div>
      <div className="hud-stats"><div><span>实际周工时</span><strong>{r ? r.wh.actual.toFixed(1) : '—'}<small> h</small></strong></div><div><span>855 等效 / 年</span><strong>{r ? wan(r.eqAfter) : '—'}</strong></div></div>
      {offer?.error && <p className="scoreboard-error">先修正这张牌的输入，才能计分。</p>}
    </div>
    <div className="scoreboard-caption">完整精度计算 · 选择手牌查看得分</div>
  </section>;
}

function JokerRack({ offer, factors, onEdit }) {
  const realized = offer?.result?.nominalTC > 0 ? offer.result.adjustedTC / offer.result.nominalTC : 1;
  const cards = [
    { kind: 'clock', name: '时间换算', value: factors ? `×${scoreNumber(factors.time, 3)}` : '—', note: '40 ÷ 加权周工时', field: 'weekendDays', color: 'blue' },
    { kind: 'growth', name: '成长空间', value: factors ? `×${scoreNumber(factors.growth, 3)}` : '—', note: '你的发展前景', field: 'growth', color: 'green' },
    { kind: 'home', name: '生活偏好', value: factors ? `×${scoreNumber(factors.location, 3)}` : '—', note: '城市与个人偏好', field: 'locationFactor', color: 'red' },
    { kind: 'coin', name: '兑现折算', value: offer?.result ? `${Math.round(realized * 100)}%` : '—', note: '已计入蓝色底数', field: 'stockFactor', color: 'gold' },
    { kind: 'joker', name: '税费结算', value: offer?.result ? wan(offer.result.taxTotal + offer.result.socialTotal) : '—', note: '已从蓝色底数扣除', field: 'specialDeduction', color: 'purple' },
  ];
  return <section className="joker-zone" aria-label="当前手牌的小丑牌系数"><div className="zone-label"><h2>你的小丑牌</h2><span>JOKERS 5 / 5 · 点击调整</span></div>
    <div className="joker-rack">{cards.map(card => <button key={card.kind} className={`joker-card joker-${card.color}`} onClick={() => onEdit(card.field)}>
      <span className="joker-card-top">{card.name}<small>JOKER</small></span><span className="joker-art"><PixelArt kind={card.kind} /></span>
      <strong>{card.value}</strong><span className="joker-note">{card.note}</span>
    </button>)}</div>
  </section>;
}

function downloadText(filename, content) {
  const url = URL.createObjectURL(new Blob([content], { type: 'text/plain;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function App() {
  const [offers, setOffers] = useState(loadOffers);
  const [saved, setSaved] = useState(true);
  const [toast, setToast] = useState('');
  const [activeId, setActiveId] = useState(null);
  const [scoreTurn, setScoreTurn] = useState(0);
  const dialogRef = useRef(null);
  const toastTimer = useRef(null);
  useEffect(() => { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(offers)); setSaved(true); } catch { setSaved(false); } }, [offers]);
  useEffect(() => () => clearTimeout(toastTimer.current), []);
  const notify = message => { setToast(message); clearTimeout(toastTimer.current); toastTimer.current = setTimeout(() => setToast(''), 2800); };
  const evaluated = offers.map(evaluate);
  const ranked = evaluated.filter(o => o.result).sort((a, b) => b.result.eqAfterHourly - a.result.eqAfterHourly);
  const best = ranked[0];
  const active = evaluated.find(o => o.id === activeId) || evaluated[0];
  const factors = active?.result ? scoreFactors(active.result, active.input) : null;
  const maxHourly = best?.result.eqAfterHourly ?? 0;
  function play(id) { setActiveId(id); setScoreTurn(current => current + 1); }
  function editJoker(field) {
    const input = document.getElementById(`${active.id}-${field}`);
    const details = input?.closest('details');
    if (details) details.open = true;
    input?.focus();
    input?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'center' });
  }

  function update(id, field, value) {
    setOffers(current => current.map(o => o.id !== id ? o : field === 'name' ? { ...o, name: value } :
      { ...o, input: { ...o.input, [field]: value, ...(field === 'city' && value !== 'custom' ? presetFields(value) : {}) } }));
  }
  function add() {
    if (offers.length >= MAX_OFFERS) return;
    setOffers(current => [...current, makeOffer(`新 Offer ${current.length + 1}`, { monthlyBase: 25000, annualBonus: 0 })]);
    notify('新手牌已入场，填入你的真实 Offer。');
  }
  function duplicate(id) {
    if (offers.length >= MAX_OFFERS) return;
    const original = offers.find(o => o.id === id);
    setOffers(current => [...current, { ...original, id: newId(), name: `${original.name.slice(0, 29)} 副本`, input: { ...original.input } }]);
    notify('已复制，试试另一组谈薪条件。');
  }
  function exportResults() {
    const text = ['OFFER 牌桌 · 比较结果', '', ...evaluated.flatMap(o => o.error ? [`${o.name}：输入未完善 — ${o.error}`, ''] :
      [`${o.name} · ${cities[o.input.city]}`, `名义税前总包：${money(o.result.nominalTC)}`, `价值折算总包：${money(o.result.adjustedTC)}`,
        `个人所得税：${money(o.result.taxTotal)}；个人五险一金：${money(o.result.socialTotal)}`, `预计税后价值：${money(o.result.afterTaxValue)}`,
        `实际 / 加权周工时：${o.result.wh.actual} / ${o.result.wh.weighted} 小时`, `税后 855 等效：${money(o.result.eqAfter)}`,
        `等效税后时薪：${money(o.result.eqAfterHourly)} / h · ${o.result.rating.label}`, '']),
      '基于当前输入及历史参考参数，仅用于 Offer 比较。税后价值包含折算后的权益与福利，不等于现金到账。',
      '计算方法：https://sherry-roar.github.io/offer-calculate/'];
    downloadText('Offer牌桌-比较结果.txt', text.join('\n'));
    notify('战绩已导出为文本。');
  }

  return <div className="app-shell">
    <header className="topbar">
      <a className="brand" href="#" aria-label="Offer 牌桌首页"><span className="brand-mark" aria-hidden="true">♠</span><span>OFFER<span className="brand-sub">牌桌 / THE DECK</span></span></a>
      <div className="topbar-right"><span className="status-pill"><span className="status-dot" />{saved ? '本地自动保存' : '仅当前会话'}</span>
        <button className="secondary-button rules-button" onClick={() => dialogRef.current.showModal()}>游戏规则 <span aria-hidden="true">↗</span></button></div>
    </header>

    <section className="hero-heading">
      <div><p className="eyebrow">CAREER RUN / 职业牌局</p><h1>你的下一手，<span>值多少？</span></h1></div>
      <div className="run-badge"><span>比较模式</span><strong>{offers.length} / 4</strong><small>手牌</small></div>
    </section>

    <main className="layout">
      <aside className="sidebar" aria-label="Offer 比较总览">
        <Scoreboard offer={active} factors={factors} turn={scoreTurn} />
        <section className="panel hand-panel">
          <div className="panel-title"><span>本局排名</span><span>{offers.length} / {MAX_OFFERS}</span></div>
          <div className="hand-list">{ranked.map((o, i) => <button className={`hand-row ${i === 0 ? 'winning' : ''} ${active.id === o.id ? 'selected' : ''}`} key={o.id} onClick={() => play(o.id)} aria-label={`选择 ${o.name || '未命名 Offer'}`} aria-pressed={active.id === o.id}>
            <span className="hand-rank">{i + 1}</span><span className="hand-name">{o.name || '未命名 Offer'}</span><strong>{money(o.result.eqAfterHourly)}</strong></button>)}
            {evaluated.filter(o => o.error).map(o => <div className="hand-row" key={o.id}><span>!</span><span className="hand-name">{o.name || '未命名 Offer'}</span><small>待完善</small></div>)}
          </div>
          <button className="primary-button add-button" onClick={add} disabled={offers.length >= MAX_OFFERS}>＋ 抽一张 Offer</button>
          <p className="panel-hint">最多 4 张，把选择摆上牌桌。</p>
        </section>
        <section className="tip-panel"><span className="tip-icon" aria-hidden="true">✦</span><div><h2>底数 × 倍率 = 回报</h2><p>好手牌，不能只看总包。<br />把时间和生活也算进去。</p></div></section>
        <button className="secondary-button export-button" onClick={exportResults} disabled={ranked.length === 0}>↓ 导出比较战绩</button>
        <button className="reset-button" onClick={() => { setOffers(exampleOffers()); notify('已恢复两张示例手牌。'); }}>↻ 恢复示例手牌</button>
      </aside>

      <section className="table-area" aria-label="编辑 Offer">
        <JokerRack offer={active} factors={factors} onEdit={editJoker} />
        <div className="section-heading"><div><span className="eyebrow">YOUR HAND</span><h2>打出你的 Offer</h2></div><span className="table-count">{String(offers.length).padStart(2, '0')} / 04</span></div>
        <div className="offer-grid">{evaluated.map((offer, index) => <OfferCard key={offer.id} offer={offer} index={index}
          isBest={best?.id === offer.id} isActive={active.id === offer.id} onPlay={play} maxHourly={maxHourly} onUpdate={update} onDuplicate={duplicate} canDuplicate={offers.length < MAX_OFFERS}
          onRemove={id => setOffers(current => current.length > 1 ? current.filter(o => o.id !== id) : current)} canRemove={offers.length > 1} />)}</div>
        <p className="disclaimer">✦ 起始手牌为虚构示例。参数可自行调整；税后价值含权益与福利，排名仅用于当前假设下的比较。</p>
      </section>
    </main>
    <footer className="footer"><span>OFFER 牌桌 <span aria-hidden="true">♠ ♥ ♣ ♦</span></span><span>少一点内耗，多一点底牌。</span><span>{saved ? '数据仅保存在此浏览器' : '浏览器存储不可用，离开后数据不会保留'}</span></footer>
    <MethodDialog dialogRef={dialogRef} />
    {toast && <div className="toast" role="status">{toast}</div>}
  </div>;
}

import React, { useEffect, useRef, useState } from 'react';
import Flame, { MotionContext } from './Flame.jsx';
import PixelSelect from './SelectField.jsx';
import { calculate, cityPresets } from './calculator.js';
import { scoreFactors } from './scoring.js';
import { SORT_OPTIONS, sortOffers, multiplierHeat, productValue } from './table-utils.js';

const STORAGE_KEY = 'offer-deck:v1';
const MAX_OFFERS = 6;
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
  city: '工作城市', baseMode: '缴费基数模式', bonusTax: '奖金计税方式', signTax: '签字费计税方式',
  stockTax: '股票计税方式', optionTax: '期权计税方式', otherTax: '其他现金计税方式',
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
    if (Array.isArray(saved) && saved.length >= 0 && saved.length <= MAX_OFFERS && saved.every(o =>
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
    return { ...offer, result: null, error: message, errorField: Object.keys(labels).sort((a, b) => b.length - a.length).find(key => error.message.includes(key)) };
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
  return <PixelSelect offer={offer} field={field} label={label || labels[field]} options={options} update={update} wide={wide} />;
}

const taxOptions = [['comprehensive', '并入综合所得'], ['none', '本年不计税']];
const equityOptions = [['equity', '符合条件股权单独计税'], ...taxOptions];

function MethodDialog({ dialogRef }) {
  return <dialog className="method-dialog" aria-labelledby="rules-title" ref={dialogRef} onClick={e => { if (e.target === e.currentTarget) dialogRef.current.close(); }}>
    <div className="dialog-header"><div><span className="eyebrow">THE RULES</span><h2 id="rules-title">这副牌怎么算？</h2></div>
      <button className="dialog-close" aria-label="关闭计算规则" onClick={() => dialogRef.current.close()}>×</button></div>
    <div className="method-content">
      <h3>使用牌桌</h3><p>点击顶部 Offer 卡牌选择要编辑的报价；选中的卡牌会向上抽出。使用排序菜单比较时薪、总包、月薪或工时。点击右侧抽牌堆新增报价，或将抽牌堆拖到牌槽；点击弃牌堆删除当前报价，也可以把任意 Offer 拖进弃牌堆。弃牌后可撤销。键盘用户可以用 Tab 和 Enter 完成同样的操作。</p><p>收入、工时、税费在编辑区并列展示；顶部结果始终可见。蓝色框是底数，红色框是倍率，结果使用完整精度计算。倍率超过该项的常规值，或刚被调高时，会出现分级火焰；火焰只表示数值变化，不代表报价更好。可以在左侧选项关闭动画。</p><h3>① 先数清筹码</h3><p>名义总包 = 月薪 × 发薪月数 + 补贴 + 奖金 + 签字费 + 本年归属股权 + 其他收入 + 福利。浮动收入再乘以各自的兑现系数，得到价值折算总包。</p>
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


const UI_KEY = 'offer-deck:table-ui:v3';
function loadUi() {
  try {
    const value = JSON.parse(localStorage.getItem(UI_KEY)) || {};
    return { activeId: typeof value.activeId === 'string' ? value.activeId : null, animations: value.animations !== false, notes: value.notes === true };
  } catch { return { activeId: null, animations: true, notes: false }; }
}
function ProductCounter({ offer, left, right, title, leftLabel, rightLabel, leftUnit = '元', rightUnit = '×',
  baseline = 1, leftMax, rightMax, leftStep = 'any', rightStep = 'any', format = money, update,
  leftValue, rightValue, resultOverride, readOnly = false, notes = false, explanation }) {
  const a = readOnly ? leftValue : offer.input[left], b = readOnly ? rightValue : offer.input[right];
  const result = readOnly && Number.isFinite(resultOverride) ? resultOverride : productValue(a, b, leftMax, rightMax);
  const mult = result === null ? null : Number(b);
  const previous = useRef(mult);
  const [flare, setFlare] = useState(0);
  useEffect(() => {
    let timer;
    if (mult !== null && previous.current !== null && mult > previous.current) {
      setFlare(Math.max(1, multiplierHeat(mult, Math.max(previous.current, .01))));
      timer = setTimeout(() => setFlare(0), 950);
    } else setFlare(0);
    previous.current = mult;
    return () => clearTimeout(timer);
  }, [mult]);
  const heat = Math.max(multiplierHeat(mult ?? NaN, baseline), flare);
  const operand = (field, value, label, unit, color, max, step) => <div className={'operand ' + color + (color === 'mult-operand' ? ' heat-' + heat : '')} data-heat={color === 'mult-operand' ? heat : undefined}>
    {color === 'mult-operand' && heat > 0 && <Flame level={heat} />}
    {readOnly ? <><span className="operand-label">{label}</span><div className="readonly-operand">{Number.isFinite(value) ? scoreNumber(value, color === 'mult-operand' ? 3 : 1) : '—'}<small>{unit}</small></div></> :
      <><label className="operand-label" htmlFor={offer.id + '-' + field}>{label}</label><div className="operand-input">
        <input id={offer.id + '-' + field} type="number" min="0" max={max} step={step} value={value}
          onChange={e => update(field, e.target.value)} /><span>{unit}</span>
      </div></>}
  </div>;
  return <section className="product-counter" aria-label={title + '乘法'} data-product={left || title}>
    <div className="product-title"><h3>{title}</h3>{heat > 0 && <span className="heat-indicator" aria-label={'火焰等级 ' + heat}>倍率升温 {heat}</span>}</div>
    <div className="product-equation">
      {operand(left, a, leftLabel || labels[left], leftUnit, 'chips-operand', leftMax, leftStep)}
      <span className="equation-sign" aria-label="乘以">×</span>
      {operand(right, b, rightLabel || labels[right], rightUnit, 'mult-operand', rightMax, rightStep)}
      <span className="equals-sign" aria-hidden="true">=</span>
      <output className="product-result" aria-live="polite" data-testid={'product-' + (left || title)}>{result === null ? '—' : format(result)}</output>
    </div>
    {notes && explanation && <p className="product-note">{explanation}</p>}
  </section>;
}

function OfferEditor({ offer, update, duplicate, canDuplicate, notes, requestFocus }) {
  const r = offer.result, factors = r ? scoreFactors(r, offer.input) : null;
  const number = (field, options = {}) => <NumberField key={field} offer={offer} field={field} update={update} {...options} />;
  const select = (field, choices, label) => <SelectField key={field} offer={offer} field={field} update={update} options={choices} label={label} />;
  const product = (left, right, title, options = {}) => <ProductCounter key={offer.id + '-' + left} offer={offer} left={left} right={right} title={title} update={update} notes={notes} {...options} />;
  return <section className="offer-editor" aria-label="当前 Offer 编辑区">
    <div className={'result-shelf ' + (r ? '' : 'results-invalid')} aria-live="polite">
      <div className="main-result"><span>等效税后时薪</span><strong data-testid="hourly-score">{r ? money(r.eqAfterHourly) : '—'}<small> / h</small></strong></div>
      <div><span>税前总包</span><strong data-testid="nominal-package">{r ? wan(r.nominalTC) : '—'}</strong></div>
      <div><span>税后价值 / 年</span><strong>{r ? wan(r.afterTaxValue) : '—'}</strong></div>
    </div>
    <div className="editor-heading">
      <div className="editor-name"><label className="sr-only" htmlFor={offer.id + '-name'}>Offer 名称</label>
        <input id={offer.id + '-name'} value={offer.name} maxLength={32} onChange={e => update('name', e.target.value)} placeholder="为这份 Offer 命名" />
        <span>{cities[offer.input.city]} · {r ? '即时计算' : '输入待完善'}</span></div>
      <button className="icon-button duplicate-offer" onClick={duplicate} disabled={!canDuplicate} aria-label="复制当前 Offer" title="复制当前 Offer">⧉</button>
    </div>
    {offer.error && <div className="input-error" role="alert"><span>{offer.error}</span>{offer.errorField && <button onClick={() => requestFocus(offer.errorField)}>定位输入 ↗</button>}</div>}
    <div className="editor-scroll" key={offer.id}><div className="editor-columns">
      <section className="editor-column income-column" aria-labelledby="income-heading"><h2 id="income-heading" className="column-heading">01 <span>收入</span></h2>
        {product('monthlyBase', 'salaryMonths', '固定工资', { leftUnit: '元 / 月', rightUnit: '月', baseline: 12, leftStep: 500, rightStep: .5, format: value => money(value) + ' / 年', explanation: '税前月薪 × 发薪月数。超出 12 薪时倍率持续升温。' })}
        {product('annualBonus', 'bonusFactor', '额外奖金', { rightMax: 1, rightStep: .05, format: value => money(value) + ' / 年', explanation: '只填没有计入发薪月数的额外奖金，避免重复。个税仍按名义奖金计算。' })}
        <div className="field-grid compact-fields">{select('city', Object.entries(cities), '工作城市')}{select('bonusTax', [['separate', '奖金单独计税'], ['comprehensive', '并入综合所得']], '奖金计税方式')}</div>
        <details className="advanced-settings"><summary>补贴、签字费与股权<span>展开</span></summary><div className="advanced-content">
          {product('monthlyAllowance', 'allowanceMonths', '固定补贴', { leftUnit: '元 / 月', rightUnit: '月', baseline: 12, rightMax: 12, format: value => money(value) + ' / 年' })}
          {product('signOn', 'signFactor', '签字费兑现', { rightMax: 1, rightStep: .05 })}{select('signTax', taxOptions, '签字费计税方式')}
          {product('stock', 'stockFactor', '股票兑现', { rightMax: 1, rightStep: .05 })}{select('stockTax', equityOptions, '股票计税方式')}
          {product('option', 'optionFactor', '期权兑现', { rightMax: 1, rightStep: .05 })}{select('optionTax', equityOptions, '期权计税方式')}
          {product('otherCash', 'otherFactor', '其他现金兑现', { rightMax: 1, rightStep: .05 })}{select('otherTax', taxOptions, '其他现金计税方式')}
          {product('benefits', 'benefitFactor', '福利折算', { rightMax: 1, rightStep: .05 })}
          <p className="field-help">股票填本年归属价值，签字费只计本年。兑现折算影响比较价值，税费按名义收入估算。</p>
        </div></details>
      </section>
      <section className="editor-column time-column" aria-labelledby="time-heading"><h2 id="time-heading" className="column-heading">02 <span>工时</span></h2>
        {product('weekdayHours', 'weekdayDays', '工作日工时', { leftUnit: '小时 / 天', rightUnit: '天 / 周', leftMax: 24, rightMax: 5, leftStep: .5, rightStep: .5, baseline: 5, format: value => scoreNumber(value) + ' h / 周', explanation: '每天实际工时 × 每周工作天数；增加工作天数会触发一次升温反馈。' })}
        {product('weekendHours', 'weekendDays', '周末加班', { leftUnit: '小时 / 天', rightUnit: '天 / 周', leftMax: 24, rightMax: 2, leftStep: .5, rightStep: .5, baseline: 1, format: value => scoreNumber(value) + ' h / 周' })}
        {product('growth', 'locationFactor', '个人偏好', { leftUnit: '×', rightUnit: '×', leftStep: .05, rightStep: .05, format: value => '×' + scoreNumber(value, 3), explanation: '成长与生活偏好均以 1 为中性值。火焰只表示倍率大小，不代表加班或报价更值得选择。' })}
        <p className="field-help">工作日超过 8 小时的部分按 1.5 倍、周末按 2 倍加权。实际 / 加权周工时：{r ? r.wh.actual.toFixed(1) + ' / ' + r.wh.weighted.toFixed(1) + ' h' : '—'}。</p>
      </section>
      <section className="editor-column fees-column" aria-labelledby="fees-heading"><h2 id="fees-heading" className="column-heading">03 <span>税费</span></h2>
        <div className="field-grid">{select('baseMode', [['salary', '按月薪估算并限额'], ['custom', '手动输入基数']], '缴费基数')}{number('contribMonths', { unit: '月', max: 12 })}
          {offer.input.baseMode === 'custom' && <>{number('socialBase')}{number('fundBase')}</>}
          {['pensionRate', 'medicalRate', 'unemploymentRate', 'otherSocialRate', 'fundRate'].map(field => number(field, { unit: '%', max: 100, step: .1 }))}
          {number('medicalFixed')}
        </div>
        <details className="advanced-settings mini-calculations"><summary>缴费乘法明细<span>展开</span></summary><div className="advanced-content">
          {[['养老', r?.appliedSocialBase, Number(offer.input.pensionRate) / 100, .08], ['医疗按比例', r?.appliedSocialBase, Number(offer.input.medicalRate) / 100, .02], ['失业', r?.appliedSocialBase, Number(offer.input.unemploymentRate) / 100, .005], ['其他社保', r?.appliedSocialBase, Number(offer.input.otherSocialRate) / 100, 1], ['公积金', r?.appliedFundBase, Number(offer.input.fundRate) / 100, .12]].map(([name, base, rate, baseline]) => <ProductCounter key={name} title={name + '月缴费'} leftLabel="实际月基数" rightLabel="个人比例" leftValue={base} rightValue={rate} resultOverride={r ? base * rate : undefined} readOnly baseline={baseline} format={money} notes={notes} />)}
          <p className="field-help">医疗固定费用另行加到每月缴费中，再参与全年合计。</p>
          <ProductCounter title="个人全年缴费" leftLabel="每月个人缴费" rightLabel="缴纳月数" leftValue={r ? r.appliedSocialBase * (Number(offer.input.pensionRate) + Number(offer.input.medicalRate) + Number(offer.input.unemploymentRate) + Number(offer.input.otherSocialRate)) / 100 + Number(offer.input.medicalFixed) + r.appliedFundBase * Number(offer.input.fundRate) / 100 : undefined} rightValue={Number(offer.input.contribMonths)} resultOverride={r?.socialTotal} rightUnit="月" readOnly baseline={12} format={money} />
        </div></details>
        <details className="advanced-settings"><summary>缴费上下限与税前扣除<span>展开</span></summary><div className="advanced-content">
          <div className="field-grid">{number('socialMin')}{number('socialMax', { cap: true })}{number('fundMin')}{number('fundMax', { cap: true })}{number('specialDeduction')}{number('otherDeduction')}</div>
          <p className="field-help">北京为 2025–2026 历史参数；其他城市比例为示例，请按实际年度与公司口径调整。上下限留空表示未设上限。</p>
        </div></details>
      </section>
    </div>
    <details className="result-details"><summary>结果明细与时薪换算</summary><div className="result-detail-body">
      <ProductCounter title="等效时薪" leftLabel="税后价值 ÷ 2080" rightLabel="工时与偏好倍率" leftValue={factors?.chips} rightValue={factors?.mult} resultOverride={factors?.total} readOnly format={value => money(value) + ' / h'} />
      <div className="breakdown">{[['价值折算总包', r?.adjustedTC], ['个人所得税', r?.taxTotal], ['个人五险一金', r?.socialTotal], ['综合所得个税', r?.taxComp], ['奖金个税', r?.taxBonus], ['股权个税', r?.taxEquity]].map(([label, value]) => <div className="breakdown-row" key={label}><span>{label}</span><strong>{r ? money(value) : '—'}</strong></div>)}</div>
    </div></details>
    </div>
  </section>;
}

function OfferSlot({ offer, index, selected, select, dragHandlers, isDragging }) {
  return <button className={'offer-slot ' + (selected ? 'is-selected ' : '') + (isDragging ? 'is-dragging' : '')}
    aria-label={'选择 ' + (offer.name || '未命名 Offer')} aria-pressed={selected} onClick={select} {...dragHandlers}>
    <span className={'slot-corner ' + (index % 2 ? 'red-suit' : '')}>{suits[index % suits.length]}<small>{index + 1}</small></span>
    <span className="slot-art" aria-hidden="true"><svg viewBox="0 0 48 48" shapeRendering="crispEdges"><path fill="#009dff" d="M4 8h12v4h8v16H12V16H4z" /><path fill="#fe5f55" d="M32 4h12v16h-8v8H24V12h8z" /><path fill="#f3b958" d="M4 4h8v8H4zM36 0h8v8h-8z" /><path fill="#ead7a4" d="M12 24h24v16H12z" /><path fill="#374244" d="M16 28h4v4h-4zM28 28h4v4h-4zM20 36h8v4h-8z" /><path fill="#4bc292" d="M8 40h12v8H8zM28 40h12v8H28z" /></svg></span>
    <strong className="slot-name">{offer.name || '未命名 Offer'}</strong><span className="slot-score">{offer.result ? money(offer.result.eqAfterHourly) + ' / h' : '待完善'}</span>
  </button>;
}

function SortControl({ onSort }) {
  const [open, setOpen] = useState(false);
  const [direction, setDirection] = useState('desc');
  const container = useRef(null);
  useEffect(() => {
    if (!open) return;
    const close = e => { if (!container.current?.contains(e.target)) setOpen(false); };
    const escape = e => { if (e.key === 'Escape') { setOpen(false); container.current?.querySelector('.sort-trigger')?.focus(); } };
    document.addEventListener('pointerdown', close); document.addEventListener('keydown', escape);
    return () => { document.removeEventListener('pointerdown', close); document.removeEventListener('keydown', escape); };
  }, [open]);
  return <div className="sort-control" ref={container}>
    <button className="sort-trigger" onClick={() => setOpen(!open)} aria-expanded={open} aria-controls="sort-options">排序 ⇅</button>
    {open && <div className="sort-popover" id="sort-options" aria-label="排序选项"><div className="sort-direction">
      {['desc', 'asc'].map(value => <button key={value} aria-pressed={direction === value} onClick={() => setDirection(value)}>{value === 'desc' ? '降序 ↓' : '升序 ↑'}</button>)}
    </div><div className="sort-criteria">{SORT_OPTIONS.map(([value, label]) => <button key={value} onClick={() => { onSort(value, direction); setOpen(false); }}>按{label}</button>)}</div></div>}
  </div>;
}

function downloadText(filename, content) {
  const url = URL.createObjectURL(new Blob([content], { type: 'text/plain;charset=utf-8' }));
  const a = document.createElement('a'); a.href = url; a.download = filename; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function App() {
  const [offers, setOffers] = useState(loadOffers);
  const [ui, setUi] = useState(loadUi);
  const [saved, setSaved] = useState(true);
  const [toast, setToast] = useState('');
  const [discarded, setDiscarded] = useState([]);
  const [pendingFocus, setPendingFocus] = useState(null);
  const [drag, setDrag] = useState(null);
  const dragSession = useRef(null), suppressClick = useRef(false), clickTimer = useRef(null);
  const dialogRef = useRef(null), toastTimer = useRef(null);
  const evaluated = offers.map(evaluate);
  const active = evaluated.find(o => o.id === ui.activeId) || evaluated[0];
  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(offers)); localStorage.setItem(UI_KEY, JSON.stringify(ui)); setSaved(true); }
    catch { setSaved(false); }
  }, [offers, ui]);
  useEffect(() => () => { clearTimeout(toastTimer.current); clearTimeout(clickTimer.current); }, []);
  useEffect(() => {
    if (!pendingFocus || !active) return;
    const input = document.getElementById(active.id + '-' + pendingFocus);
    const details = input?.closest('details');
    if (details) details.open = true;
    input?.focus(); setPendingFocus(null);
  }, [pendingFocus, active?.id]);
  const notify = message => { setToast(message); clearTimeout(toastTimer.current); toastTimer.current = setTimeout(() => setToast(''), 6000); };
  const select = id => { if (!suppressClick.current) setUi(current => ({ ...current, activeId: id })); };
  const update = (field, value) => setOffers(current => current.map(o => o.id !== active.id ? o : field === 'name' ? { ...o, name: value } :
    { ...o, input: { ...o.input, [field]: value, ...(field === 'city' && value !== 'custom' ? presetFields(value) : {}) } }));
  function requestFocus(field) { setPendingFocus(field); }
  function add() {
    if (offers.length >= MAX_OFFERS) return notify('牌槽已满，先弃置一张再抽牌。');
    let index = 1; while (offers.some(o => o.name === '新 Offer ' + index)) index++;
    const fresh = makeOffer('新 Offer ' + index, { monthlyBase: 25000, salaryMonths: 12, annualBonus: 0 });
    setOffers(current => current.length < MAX_OFFERS ? [...current, fresh] : current);
    setUi(current => ({ ...current, activeId: fresh.id })); notify('已抽取一份新 Offer。');
  }
  function duplicate() {
    if (!active || offers.length >= MAX_OFFERS) return;
    const fresh = { id: newId(), name: active.name.slice(0, 29) + ' 副本', input: { ...active.input } };
    setOffers(current => [...current, fresh]); setUi(current => ({ ...current, activeId: fresh.id })); notify('已复制当前 Offer。');
  }
  function discard(id = active?.id) {
    const index = offers.findIndex(o => o.id === id);
    if (index < 0) return;
    const item = offers[index], next = offers[index + 1] || offers[index - 1];
    setDiscarded(current => [...current, { offer: item, index }]);
    setOffers(current => current.filter(o => o.id !== id));
    if (active?.id === id) setUi(current => ({ ...current, activeId: next?.id || null }));
    notify('已弃置「' + (item.name || '未命名 Offer') + '」。');
  }
  function undo() {
    const item = discarded.at(-1);
    if (!item || offers.length >= MAX_OFFERS) return;
    setOffers(current => { const next = [...current]; next.splice(Math.min(item.index, current.length), 0, item.offer); return next; });
    setDiscarded(current => current.slice(0, -1)); setUi(current => ({ ...current, activeId: item.offer.id })); notify('已恢复这份 Offer。');
  }
  function applySort(criterion, direction) {
    setOffers(current => sortOffers(current.map(evaluate), criterion, direction).map(o => current.find(original => original.id === o.id)));
    notify('已按' + SORT_OPTIONS.find(([key]) => key === criterion)[1] + (direction === 'desc' ? '降序' : '升序') + '排序。');
  }
  function exportResults() {
    const content = ['OFFER 牌桌 · 比较结果', '', ...evaluated.flatMap(o => o.error ? [o.name + '：' + o.error, ''] :
      [o.name + ' · ' + cities[o.input.city], '税前总包：' + money(o.result.nominalTC), '税后价值：' + money(o.result.afterTaxValue),
       '实际 / 加权周工时：' + o.result.wh.actual + ' / ' + o.result.wh.weighted + ' h', '等效税后时薪：' + money(o.result.eqAfterHourly) + ' / h', '']),
      '税后价值包含权益与福利。缴费预设为历史参考；请核对实际合同与政策。'];
    downloadText('Offer牌桌-比较结果.txt', content.join('\n')); notify('比较结果已导出。');
  }
  const targetAt = (x, y, item) => {
    const zone = document.elementFromPoint(x, y)?.closest('[data-drop-zone]')?.dataset.dropZone;
    return item.kind === 'draw' ? (['hand', 'editor'].includes(zone) ? zone : null) : (['discard', 'hand', 'editor'].includes(zone) ? zone : null);
  };
  function dragHandlers(item) {
    return {
      onPointerDown: e => {
        if (e.button !== 0 || dragSession.current || (item.kind === 'draw' && offers.length >= MAX_OFFERS)) return;
        e.currentTarget.setPointerCapture(e.pointerId);
        dragSession.current = { ...item, pointerId: e.pointerId, x: e.clientX, y: e.clientY, moved: false };
      },
      onPointerMove: e => {
        const session = dragSession.current;
        if (!session || session.pointerId !== e.pointerId) return;
        if (!session.moved && Math.hypot(e.clientX - session.x, e.clientY - session.y) < 9) return;
        session.moved = true;
        const target = targetAt(e.clientX, e.clientY, session);
        setDrag({ ...session, currentX: e.clientX, currentY: e.clientY, target });
        if (!target && e.pointerType !== 'mouse') {
          const scroll = document.querySelector('.editor-scroll'), bounds = scroll?.getBoundingClientRect();
          if (bounds && e.clientY > bounds.top && e.clientY < bounds.bottom) {
            if (e.clientY < bounds.top + 35) scroll.scrollBy(0, -12);
            else if (e.clientY > bounds.bottom - 35) scroll.scrollBy(0, 12);
          }
        }
      },
      onPointerUp: e => {
        const session = dragSession.current;
        if (!session || session.pointerId !== e.pointerId) return;
        if (session.moved) {
          suppressClick.current = true; clearTimeout(clickTimer.current);
          clickTimer.current = setTimeout(() => { suppressClick.current = false; }, 160);
          const target = targetAt(e.clientX, e.clientY, session);
          if (session.kind === 'draw' && target) add();
          else if (session.kind === 'offer' && target === 'discard') discard(session.id);
          else if (session.kind === 'offer' && target) setUi(current => ({ ...current, activeId: session.id }));
        }
        dragSession.current = null; setDrag(null);
        if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
      },
      onPointerCancel: () => { dragSession.current = null; setDrag(null); },
      onLostPointerCapture: () => { dragSession.current = null; setDrag(null); },
    };
  }
  const clicked = action => { if (!suppressClick.current) action(); };
  const lastDiscard = discarded.at(-1)?.offer;

  return <MotionContext.Provider value={ui.animations}><div className={'app-shell table-layout ' + (!ui.animations ? 'motion-off' : '')}>
    <aside className="sidebar" aria-label="标题、帮助与选项">
      <div className="sidebar-brand"><span className="brand-mark" aria-hidden="true">♠</span><div><h1>Offer 牌桌</h1><span>THE OFFER DECK</span></div></div>
      <p className="side-intro">把选择放上牌桌。<br />一张一张，算清回报。</p>
      <button className="sidebar-button help-button" onClick={() => dialogRef.current.showModal()}>? 帮助与计算方法</button>
      <details className="side-options"><summary>选项 <span>⚙</span></summary><div>
        <label><input type="checkbox" checked={ui.animations} onChange={e => setUi(current => ({ ...current, animations: e.target.checked }))} />计分与火焰动效</label>
        <label><input type="checkbox" checked={ui.notes} onChange={e => setUi(current => ({ ...current, notes: e.target.checked }))} />显示公式说明</label>
        <button onClick={exportResults} disabled={offers.length === 0}>↓ 导出比较结果</button>
        <button onClick={() => { setOffers(exampleOffers()); setDiscarded([]); setUi(current => ({ ...current, activeId: null })); notify('已恢复两份示例。'); }}>↻ 恢复示例</button>
      </div></details>
      <div className="side-bottom"><span className="save-indicator"><i />{saved ? '自动保存在此浏览器' : '存储不可用，仅当前会话'}</span><small>示例与缴费预设仅作参考</small></div>
    </aside>
    <main className="playing-table" aria-label="Offer 牌桌">
      <section className={'hand-zone ' + (drag?.target === 'hand' ? 'drop-ready' : '')} data-drop-zone="hand" aria-label="Offer 牌槽">
        <div className="hand-heading"><div><h2>你的 Offer</h2><span>{offers.length} / {MAX_OFFERS} 张手牌</span></div><SortControl onSort={applySort} /></div>
        <div className="offer-hand">{evaluated.map((offer, index) => <OfferSlot key={offer.id} offer={offer} index={index}
          selected={active?.id === offer.id} select={() => select(offer.id)} dragHandlers={dragHandlers({ kind: 'offer', id: offer.id })}
          isDragging={drag?.id === offer.id} />)}
          {offers.length === 0 && <div className="hand-empty">还没有手牌。点击抽牌堆，或拖一张进来。</div>}
        </div>
        <p className="hand-hint">点击选牌 · 拖到弃牌堆可删除</p>
      </section>
      <div className={'editor-drop-zone ' + (drag?.target === 'editor' ? 'drop-ready' : '')} data-drop-zone="editor">
        {active ? <OfferEditor key={active.id} offer={active} update={update} duplicate={duplicate} canDuplicate={offers.length < MAX_OFFERS} notes={ui.notes} requestFocus={requestFocus} /> :
          <div className="empty-editor"><span aria-hidden="true">♠</span><h2>下一份 Offer，从抽牌开始。</h2><p>抽一张手牌，填入薪资与工时，即可比较。</p><button className="primary-button" onClick={add}>抽一张 Offer</button></div>}
      </div>
    </main>
    <aside className="deck-rail" aria-label="抽牌与弃牌">
      <div className={'pile discard-pile ' + (drag?.target === 'discard' ? 'drop-ready' : '')} data-drop-zone="discard">
        <button className="deck-action discard-action" disabled={offers.length === 0} onClick={() => clicked(() => discard())} aria-label="弃置当前 Offer">
          <span className="deck-face"><span className="deck-symbol" aria-hidden="true">×</span><strong>弃牌堆</strong><small>{lastDiscard ? lastDiscard.name : '点击弃置当前牌'}</small></span>
        </button><span className="pile-caption">或将手牌拖到这里</span>
        {discarded.length > 0 && <button className="undo-discard" onClick={undo} disabled={offers.length >= MAX_OFFERS}>↶ 撤销弃牌</button>}
      </div>
      <div className="pile draw-pile">
        <button className="deck-action draw-action" disabled={offers.length >= MAX_OFFERS} onClick={() => clicked(add)} {...dragHandlers({ kind: 'draw' })} aria-label="抽取新 Offer">
          <span className="deck-face"><span className="deck-symbol" aria-hidden="true">♠</span><strong>抽牌堆</strong><small>{offers.length >= MAX_OFFERS ? '牌槽已满' : '+ 新 Offer'}</small></span>
        </button><span className="pile-caption">点击或拖进牌槽</span>
      </div>
    </aside>
    <MethodDialog dialogRef={dialogRef} />
    {toast && <div className="toast" role="status"><span>{toast}</span>{toast.startsWith('已弃置') && <button onClick={undo} disabled={offers.length >= MAX_OFFERS}>撤销</button>}<button className="toast-close" aria-label="关闭提示" onClick={() => setToast('')}>×</button></div>}
    {drag && <div className="drag-preview" style={{ left: drag.currentX, top: drag.currentY }} aria-hidden="true"><span>{drag.kind === 'draw' ? '♠' : 'J'}</span><strong>{drag.kind === 'draw' ? '新 Offer' : offers.find(o => o.id === drag.id)?.name}</strong></div>}
  </div></MotionContext.Provider>;
}

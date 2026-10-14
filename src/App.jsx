import { migrateBeijingLimits } from './policy-presets.js';
import HelpDialog from './HelpDialog.jsx';
import React, { useEffect, useRef, useState } from 'react';
import { NEW_OFFER_INPUT, REFERENCE_INPUT } from './offer-defaults.js';
import SurfaceEffects from './SurfaceEffects.jsx';
import Flame, { MotionContext } from './Flame.jsx';
import PixelSelect from './SelectField.jsx';
import { calculate, cityPresets } from './calculator.js';
import NumericInput from './NumericInput.jsx';
import ActionButton from './ActionButton.jsx';
import { SORT_OPTIONS, productHeat, productValue, displayedOffers, orderByIds, moveOffer, configureSorting, migrateManualOrder, incomeTotals } from './table-utils.js';

const STORAGE_KEY = 'offer-deck:v1';
const MAX_OFFERS = 10;
const cities = { beijing: '北京', shanghai: '上海', shenzhen: '深圳', guangzhou: '广州', hangzhou: '杭州', chengdu: '成都', nanjing: '南京', wuhan: '武汉', custom: '自定义' };
const newId = () => globalThis.crypto?.randomUUID?.() ?? `offer-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
const money = value => new Intl.NumberFormat('zh-CN', { style: 'currency', currency: 'CNY', maximumFractionDigits: 0 }).format(value);
const scaledMoney = (value, compact, kind = 'annual') => compact && kind !== 'hourly' ? new Intl.NumberFormat('zh-CN', { maximumFractionDigits: 2 }).format(value / (kind === 'monthly' ? 1000 : 10000)) + (kind === 'monthly' ? ' 千元' : ' 万元') : money(value);
function cardMetric(offer, criterion, compact) {
  if (criterion === 'name') return cities[offer.input.city];
  if (criterion === 'monthly' && String(offer.input.monthlyBase ?? '').trim() === '') return '待完善';
  const value = criterion === 'monthly' ? Number(offer.input.monthlyBase) : criterion === 'hours' ? offer.result?.wh.actual : offer.result?.[{ hourly: 'eqAfterHourly', net: 'afterTaxValue', package: 'nominalTC' }[criterion]];
  if (!Number.isFinite(value)) return '待完善';
  return criterion === 'hours' ? value + ' h / 周' : scaledMoney(value, compact, criterion === 'monthly' ? 'monthly' : criterion === 'hourly' ? 'hourly' : 'annual') + (criterion === 'hourly' ? ' / h' : '');
}
const scoreNumber = (value, precision = 1) => Math.abs(value) >= 1000000 ? value.toExponential(1) : value.toLocaleString('en-US', { maximumFractionDigits: precision });
const defaults = NEW_OFFER_INPUT;
const labels = {
  annualLeave: '带薪年假', publicHolidays: '法定假日', paidSickLeave: '带薪病假', city: '工作城市', baseMode: '缴费基数模式', bonusTax: '奖金计税方式', signTax: '签字费计税方式',
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
  const input = { ...defaults, annualLeave: 5, publicHolidays: 13, paidSickLeave: 3, ...overrides };
  return { id: newId(), name, input: { ...input, ...presetFields(input.city) } };
}
function exampleOffers() {
  return [makeOffer('参考 Offer', REFERENCE_INPUT)];
}
function loadOffers() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (Array.isArray(saved) && saved.length >= 0 && saved.length <= MAX_OFFERS && saved.every(o =>
      typeof o.id === 'string' && typeof o.name === 'string' && o.input && Object.keys(cities).includes(o.input.city)) &&
      new Set(saved.map(o => o.id)).size === saved.length) {
      const restored = saved.map(o => ({ id: o.id, name: o.name.slice(0, 32), input: { ...defaults, ...presetFields(o.input.city),
        ...Object.fromEntries(Object.entries(o.input).filter(([key, value]) =>
          (Object.hasOwn(defaults, key) || Object.hasOwn(labels, key)) && ['number', 'string'].includes(typeof value))) } }));
      let previousSort;
      try { previousSort = JSON.parse(localStorage.getItem(UI_KEY))?.sort; } catch { /* Preserve valid offers if UI storage is damaged. */ }
      return migrateManualOrder(restored.map(o => ({ ...o, input: migrateBeijingLimits(o.input) })), previousSort);
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
      <NumericInput id={id} label={labels[field]} min={min} max={max} step={step} disabled={disabled}
        value={cap && Number(offer.input[field]) === Number.MAX_SAFE_INTEGER ? '' : offer.input[field]}
        placeholder={cap ? '未设上限' : '请输入'}
        onChange={value => update(field, cap && value === '' ? Number.MAX_SAFE_INTEGER : value)} />
      <span className="input-suffix">{unit}</span>
    </div>
  </div>;
}
function SelectField({ offer, field, label, options, update, wide = false }) {
  return <PixelSelect offer={offer} field={field} label={label || labels[field]} options={options} update={update} wide={wide} />;
}

const taxOptions = [['comprehensive', '并入综合所得'], ['none', '本年不计税']];
const equityOptions = [['equity', '符合条件股权单独计税'], ...taxOptions];


const UI_KEY = 'offer-deck:table-ui:v3';
const defaultSort = { criterion: 'custom', direction: 'desc', automatic: false, manualOrder: [], lastCriterion: 'hourly' };
function loadUi() {
  try {
    const value = JSON.parse(localStorage.getItem(UI_KEY)) || {}, raw = value.sort || {};
    const previousCriterion = SORT_OPTIONS.some(([key]) => key === raw.criterion) ? raw.criterion : 'hourly';
    const criterion = raw.automatic === true && raw.criterion !== 'custom' ? previousCriterion : 'custom';
    let activeId = typeof value.activeId === 'string' ? value.activeId : null;
    if (!activeId && raw.criterion !== 'custom' && raw.automatic === false && Array.isArray(raw.manualOrder)) {
      try { const first = JSON.parse(localStorage.getItem(STORAGE_KEY))?.[0]; if (typeof first?.id === 'string') activeId = first.id; } catch { /* Leave damaged storage to the normal offer loader. */ }
    }
    return { activeId, animations: value.animations !== false, compactMoney: value.compactMoney === true, backgroundEffect: value.backgroundEffect !== false, crtEffect: value.crtEffect !== false,
      sort: { criterion, lastCriterion: SORT_OPTIONS.some(([key]) => key === raw.lastCriterion) ? raw.lastCriterion : previousCriterion, direction: raw.direction === 'asc' ? 'asc' : 'desc', automatic: criterion !== 'custom' && raw.automatic === true,
        manualOrder: Array.isArray(raw.manualOrder) ? raw.manualOrder.filter(id => typeof id === 'string') : [] } };
  } catch { return { activeId: null, animations: true, compactMoney: false, backgroundEffect: true, crtEffect: true, sort: defaultSort }; }
}
function ProductCounter({ offer, left, right, title, leftLabel, rightLabel, leftUnit = '元', rightUnit = '×',
  leftMax, rightMax, leftStep = 100, rightStep = .05, format = money, update, tableMode = false, tax, compactMoney = false }) {
  const a = offer.input[left], b = offer.input[right], result = productValue(a, b, leftMax, rightMax);
  const heat = productHeat(result, left === 'weekendHours' && !(productValue(offer.input.weekdayHours, offer.input.weekdayDays, 24, 5) > 0) ? 'invalid' : left);
  const operand = (field, value, label, unit, color, max, step) => <div className="operand-stack">
    <label className={tableMode ? 'sr-only' : 'operand-caption'} htmlFor={offer.id + '-' + field}>{label}<span>{unit}</span></label>
    <div className={'operand ' + color + ' heat-' + heat} data-heat={heat}>
      {heat > 0 && <Flame level={heat} color={color === 'chips-operand' ? 'blue' : 'red'} />}
      <NumericInput id={offer.id + '-' + field} label={labels[field]} value={value} max={max} step={step} scale={compactMoney && tableMode && field === left ? (left === 'monthlyBase' || left === 'monthlyAllowance' ? 1000 : 10000) : 1} onChange={value => update(field, value)} />
    </div>
  </div>;
  if (tableMode) return <tr className="income-row" data-product={left}>
    <th scope="row"><div className="income-item-name"><span className="income-item-title">{title}</span><div className="income-item-total">{tax || <span className="tax-symbol tax-symbol-static" title="并入综合所得">综</span>}<output data-testid={'product-' + left}>{result === null ? '—' : format(result)}</output></div></div></th>
    <td>{operand(left, a, leftLabel || labels[left], leftUnit, 'chips-operand', leftMax, leftStep)}</td>
    <td className="income-operator-cell"><span className="row-multiply" aria-hidden="true">×</span></td><td className="income-mult-cell">{operand(right, b, rightLabel || labels[right], rightUnit, 'mult-operand', rightMax, rightStep)}</td>
  </tr>;
  return <section className="product-counter" aria-label={title + '乘法'} data-product={left}>
    <div className="product-title"><h3>{title}</h3><output className="product-result" aria-live="polite" data-testid={'product-' + left}>{result === null ? '—' : format(result)}</output></div>
    <div className="product-equation">
      {operand(left, a, leftLabel || labels[left], leftUnit, 'chips-operand', leftMax, leftStep)}
      <span className="equation-sign" aria-label="乘以">×</span>
      {operand(right, b, rightLabel || labels[right], rightUnit, 'mult-operand', rightMax, rightStep)}
    </div>
  </section>;
}

function FoldSection({ id, label, className, children }) {
  const [open, setOpen] = useState(false);
  return <section className={className}>
    <div className="fold-content" id={id} hidden={!open}>{children}</div>
    <ActionButton className="income-expand fold-toggle" aria-controls={id} aria-expanded={open} onClick={() => setOpen(value => !value)}><span className="fold-sign">{open ? '−' : '+'}</span>{' '}<span className="fold-label">{label}</span></ActionButton>
  </section>;
}

function TextResults({ rows, className = '' }) {
  return <dl className={'text-results ' + className}>{rows.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>;
}

function coefficientOptions(current, choices) {
  const value = String(current), options = choices.map(([number, title]) => [String(number), title]);
  if (!options.some(([number]) => Number(number) === Number(current))) options.unshift([value, '保留当前值 ' + (value || '未填写')]);
  else if (!options.some(([number]) => number === value)) options.unshift([value, '当前 ' + value]);
  return options;
}

function OfferEditor({ offer, update, duplicate, canDuplicate, requestFocus, discard, compactMoney, reset }) {
  const r = offer.result, totals = incomeTotals(offer.input), amount = value => r ? scaledMoney(value, compactMoney) : '—';
  const [monthlyExpanded, setMonthlyExpanded] = useState(false), [annualExpanded, setAnnualExpanded] = useState(false);
  const number = (field, options = {}) => <NumberField key={field} offer={offer} field={field} update={update} {...options} />;
  const select = (field, choices, label, compact = false) => <PixelSelect key={field} offer={offer} field={field} update={update} options={choices} label={label || labels[field]} compact={compact} />;
  const product = (left, right, title, options = {}) => <ProductCounter key={offer.id + '-' + left} offer={offer} left={left} right={right} title={title} update={update} compactMoney={compactMoney} format={value => scaledMoney(value, compactMoney)} {...options} />;
  const annualIncomeRows = [
    ['signOn', 'signFactor', '签字费', 'signTax', taxOptions], ['stock', 'stockFactor', '股票', 'stockTax', equityOptions],
    ['option', 'optionFactor', '期权', 'optionTax', equityOptions], ['otherCash', 'otherFactor', '其他现金', 'otherTax', taxOptions],
    ['benefits', 'benefitFactor', '非现金福利'],
  ];
  return <section className="offer-editor" aria-label="当前 Offer 编辑区">
    <header className="offer-summary">
      <div className="summary-identity"><div className="editor-name" style={{ '--name-width': Math.min(280, Math.max(90, [...offer.name].reduce((width, char) => width + (char.codePointAt(0) > 255 ? 19 : 11), 0) + 14)) + 'px' }}><label className="sr-only" htmlFor={offer.id + '-name'}>Offer 名称</label>
        <input id={offer.id + '-name'} value={offer.name} maxLength={32} onChange={e => update('name', e.target.value)} placeholder="为这份 Offer 命名" />
        {r && <RatingSeal result={r} />}</div>
        <div className="summary-actions"><ActionButton className="icon-button delete-offer" onClick={discard} aria-label="删除当前 Offer" title="删除当前 Offer"><span aria-hidden="true">×</span><small>删除</small></ActionButton>
        <ActionButton className="icon-button duplicate-offer" onClick={duplicate} disabled={!canDuplicate} aria-label="复制当前 Offer" title="复制当前 Offer"><span aria-hidden="true">⧉</span><small>复制</small></ActionButton><ActionButton className="icon-button reset-offer" onClick={reset} aria-label="重置当前 Offer" title="重置当前 Offer"><span aria-hidden="true">↻</span><small>重置</small></ActionButton></div>
      </div>
      <div className="summary-metrics" aria-live="polite">
        {[["税后等效年收入", r?.eqAfter, 'equivalent-year'], ['等效税后时薪', r?.eqAfterHourly, 'hourly-score'], ['税前总包', r?.nominalTC, 'nominal-package'],
          ['个人所得税', r?.taxTotal, 'income-tax'], ['个人五险一金', r?.socialTotal, 'social-total'], ['税后总包（价值折算）', r?.afterTaxValue, 'after-tax-package']].map(([label, value, id]) =>
          <div className={id === 'hourly-score' || id === 'equivalent-year' ? 'main-result' : ''} key={id}><span>{label}</span><strong data-testid={id}>{id === 'hourly-score' ? (r ? money(value) : '—') : amount(value)}{id === 'hourly-score' && <small> / h</small>}</strong></div>)}
      </div>
    </header>
    {offer.error && <div className="input-error" role="alert"><span>{offer.error}</span>{offer.errorField && <button onClick={() => requestFocus(offer.errorField)}>定位输入 ↗</button>}</div>}
    <div className="editor-scroll" key={offer.id}><div className="editor-columns">
      <section className="editor-column income-column" aria-labelledby="income-heading"><h2 id="income-heading" className="column-heading">01 <span>收入</span></h2>
        <table className="shared-income-table monthly-income-table"><caption><span>固定收入</span><strong data-testid="monthly-income-total">{totals.recurringAnnual === null ? '—' : scaledMoney(totals.recurringAnnual, compactMoney)}</strong></caption>
          <thead><tr><th scope="col">项目 / 全年合计</th><th scope="col"><span className="income-heading-pair"><span>金额</span><span>{compactMoney ? '千元' : '元'} / 月</span></span></th><th scope="col" className="income-operator-heading"><span className="sr-only">乘以</span></th><th scope="col"><span className="income-heading-pair"><span>发放月数</span><span>月</span></span></th></tr></thead>
          <tbody>{product('monthlyBase', 'salaryMonths', '月基本工资', { tableMode: true, leftStep: 500, rightStep: .5 })}</tbody>
          <tbody id={offer.id + '-monthly-extra'} hidden={!monthlyExpanded} data-income-extra="monthly">
            {product('monthlyAllowance', 'allowanceMonths', '月现金补贴', { tableMode: true, rightMax: 12, rightStep: 1 })}
          </tbody>
          <tfoot><tr><td colSpan="4"><ActionButton className="income-expand" aria-expanded={monthlyExpanded} aria-controls={offer.id + '-monthly-extra'} onClick={() => setMonthlyExpanded(value => !value)}><span className="fold-sign">{monthlyExpanded ? '−' : '+'}</span>{' '}<span className="fold-label">月现金补贴</span></ActionButton></td></tr></tfoot>
        </table>
        <table className="shared-income-table annual-income-table"><caption><span>浮动收入</span><strong data-testid="annual-income-total">{totals.annual === null ? '—' : scaledMoney(totals.annual, compactMoney)}</strong></caption>
          <thead><tr><th scope="col">项目 / 折算价值</th><th scope="col"><span className="income-heading-pair"><span>名义金额</span><span>{compactMoney ? '万元' : '元'}</span></span></th><th scope="col" className="income-operator-heading"><span className="sr-only">乘以</span></th><th scope="col"><span className="income-heading-pair"><span>兑现系数</span><span>×</span></span></th></tr></thead>
          <tbody>{product('annualBonus', 'bonusFactor', '年终奖', { tableMode: true, rightMax: 1, rightStep: .05, tax: select('bonusTax', [['separate', '奖金单独计税'], ['comprehensive', '并入综合所得']], '年终奖计税方式', true) })}</tbody>
          <tbody id={offer.id + '-annual-extra'} hidden={!annualExpanded} data-income-extra="annual">
            {annualIncomeRows.map(([left, right, title, tax, choices]) => product(left, right, title, { tableMode: true, rightMax: 1, rightStep: .05, tax: tax ? select(tax, choices, labels[tax], true) : <span className="tax-symbol tax-symbol-static" title="非现金福利：不计现金个税" aria-label="非现金福利不计现金个税">免</span> }))}
          </tbody>
          <tfoot><tr><td colSpan="4"><ActionButton className="income-expand" aria-expanded={annualExpanded} aria-controls={offer.id + '-annual-extra'} onClick={() => setAnnualExpanded(value => !value)}><span className="fold-sign">{annualExpanded ? '−' : '+'}</span>{' '}<span className="fold-label">签字费、股票、期权等</span></ActionButton></td></tr></tfoot>
        </table>
      </section>
      <section className="editor-column time-column" aria-labelledby="time-heading"><h2 id="time-heading" className="column-heading">02 <span>工时</span></h2>
        {product('weekdayHours', 'weekdayDays', '工作日工时', { leftUnit: '小时 / 天', rightUnit: '天 / 周', leftMax: 24, rightMax: 5, leftStep: .5, rightStep: .5, format: value => scoreNumber(value) + ' h / 周' })}
        {product('weekendHours', 'weekendDays', '周末工时', { leftUnit: '小时 / 天', rightUnit: '天 / 周', leftMax: 24, rightMax: 2, leftStep: .5, rightStep: .5, format: value => scoreNumber(value) + ' h / 周' })}
        <section className="work-group" aria-label="年度假期"><div className="field-grid holiday-fields" aria-label="年度假期">{['annualLeave', 'publicHolidays', 'paidSickLeave'].map(field => number(field, { unit: '天 / 年', max: 366, step: 1 }))}</div></section>
        <FoldSection className="preference-settings" id={offer.id + '-preference-extra'} label="发展前景与个人偏好"><div className="field-grid preference-fields">
          {select('growth', coefficientOptions(offer.input.growth, [[1.3, '1.30 顶级成长'], [1.15, '1.15 良好成长'], [1, '1.00 普通'], [.9, '0.90 较弱'], [.8, '0.80 消耗型']]), '发展前景')}
          {select('locationFactor', coefficientOptions(offer.input.locationFactor, [[1.3, '1.30 非常喜欢'], [1.15, '1.15 比较喜欢'], [1, '1.00 中性'], [.9, '0.90 不太喜欢'], [.8, '0.80 较不适应']]), '个人偏好')}
        </div></FoldSection>
      </section>
      <section className="editor-column fees-column" aria-labelledby="fees-heading"><h2 id="fees-heading" className="column-heading">03 <span>税费</span></h2>
        <div className="field-grid fees-base-fields">{select('city', Object.entries(cities), '工作城市')}{select('baseMode', [['salary', '按月薪估算并限额'], ['custom', '手动输入基数']], '缴费基数')}
          {offer.input.baseMode === 'custom' && <>{number('socialBase')}{number('fundBase')}</>}
        </div>
        <div className="field-grid contribution-fields" aria-label="个人缴费参数">{number('contribMonths', { unit: '月', max: 12, step: 1 })}
          {['pensionRate', 'medicalRate', 'unemploymentRate', 'otherSocialRate', 'fundRate'].map(field => number(field, { unit: '%', max: 100, step: .1 }))}
        </div>
        <div className="field-grid deduction-fields" aria-label="税前扣除">{number('specialDeduction', { step: 1000 })}{number('otherDeduction', { step: 1000 })}</div>
        <FoldSection className="advanced-settings" id={offer.id + '-fee-extra'} label="缴费上下限与固定医疗费"><div className="advanced-content">
          <div className="field-grid">{number('socialMin', { step: 100 })}{number('socialMax', { cap: true, step: 100 })}{number('fundMin', { step: 100 })}{number('fundMax', { cap: true, step: 100 })}{number('medicalFixed', { step: 1 })}</div>
          {offer.input.city !== 'custom' && <ActionButton className="income-expand apply-city-preset" onClick={() => update('city', offer.input.city)}>应用当前城市预设</ActionButton>}
        </div></FoldSection>
      </section>
    </div>
    <FoldSection className="result-details" id={offer.id + '-result-extra'} label="完整结果与税费明细">
      <div className="detail-groups"><section className="detail-group" aria-label="计算结果"><h3 className="detail-heading">计算结果</h3>
      <TextResults rows={[["价值折算税前总包", amount(r?.adjustedTC)], ['税前 855 等效年收入', amount(r?.eqPretax)], ['税后 855 等效年收入', amount(r?.eqAfter)],
        ['等效税前时薪', r ? money(r.eqPretax / 2080) + ' / h' : '—'], ['等效税后时薪', r ? money(r.eqAfterHourly) + ' / h' : '—'], ['税前名义总包', amount(r?.nominalTC)],
        ['平均月税后价值', r ? scaledMoney(r.afterTaxValue / 12, compactMoney, 'monthly') : '—'], ['预计个人所得税', amount(r?.taxTotal)], ['个人五险一金', amount(r?.socialTotal)], ['税后现金 / 权益价值', amount(r?.afterTaxValue)],
        ['实际 / 加权周工时', r ? r.wh.actual.toFixed(1) + ' / ' + r.wh.weighted.toFixed(1) + ' h' : '—']]} />
      </section><section className="detail-group" aria-label="工时与假期"><h3 className="detail-heading">工时与假期</h3>
        <TextResults rows={[["实际周工时", r ? r.wh.actual.toFixed(1) + ' h' : '—'], ['加权周工时', r ? r.wh.weighted.toFixed(1) + ' h' : '—'], ['假期折算', r ? scoreNumber(r.wh.leaveDays) + ' 天' : '—'], ['全年工作日', r ? scoreNumber(r.wh.workingDays) + ' 天' : '—'], ['实际全年工时', r ? scoreNumber(r.wh.annualActual) + ' h' : '—'], ['加权全年工时', r ? scoreNumber(r.wh.annualWeighted) + ' h' : '—']]} />
      </section><section className="detail-group" aria-label="收入拆分"><h3 className="detail-heading">收入拆分（名义金额）</h3>
      <TextResults rows={[["固定工资", 'salary'], ['固定补贴', 'allowance'], ['年终奖', 'bonus'], ['签字费', 'sign'], ['股票 / RSU', 'stock'], ['期权', 'option'], ['其他现金', 'other'], ['非现金福利', 'benefits']].map(([label, key]) => [label, amount(r?.[key])])} />
      </section><section className="detail-group" aria-label="个人所得税"><h3 className="detail-heading">个人所得税</h3>
      <TextResults className="tax-breakdown" rows={[["综合所得应纳税所得额", amount(r?.taxableComp)], ['综合所得个税', amount(r?.taxComp)], ['奖金个税', amount(r?.taxBonus)], ['股权个税', amount(r?.taxEquity)], ['个人所得税合计', amount(r?.taxTotal)]]} />
      </section><section className="detail-group" aria-label="五险一金"><h3 className="detail-heading">个人五险一金</h3>
      <TextResults className="contribution-breakdown" rows={[["社保月基数", amount(r?.appliedSocialBase)], ['公积金月基数', amount(r?.appliedFundBase)], ...[['养老 / 年', 'pension'], ['医疗 / 年（含固定费）', 'medical'], ['失业 / 年', 'unemployment'], ['其他社保 / 年', 'otherSocial'], ['公积金 / 年', 'fund'], ['个人全年缴费', 'socialTotal']].map(([label, key]) => [label, amount(r?.[key])])]} />
      </section></div>
    </FoldSection>
    </div>
  </section>;
}

function RatingSeal({ result, card = false }) {
  if (!result) return null;
  const symbols = result.eqAfterHourly >= 200 ? '♠' : result.eqAfterHourly >= 120 ? '♥' : result.eqAfterHourly >= 70 ? '♦' : result.eqAfterHourly >= 35 ? '♣' : '×';
  const tier = result.eqAfterHourly >= 200 ? 'legend' : result.eqAfterHourly >= 120 ? 'top' : result.eqAfterHourly >= 70 ? 'good' : result.eqAfterHourly >= 35 ? 'normal' : 'low';
  return <span className={'rating-seal seal-' + tier + ' ' + (card ? 'card-seal' : 'editor-seal')} role="status" aria-label={'Offer 评价：' + result.rating.label} title={result.rating.comment}>
    <svg className="wax-shape" viewBox="0 0 80 80" aria-hidden="true" shapeRendering="crispEdges"><path className="wax-shadow" d="M34 7L43 5L51 10L60 11L65 20L72 25L72 34L76 42L72 50L70 60L61 64L56 72L46 73L38 77L30 72L20 71L15 63L7 57L8 47L4 39L8 30L9 20L18 16L23 8Z"/><path className="wax-body" d="M34 3L43 1L51 6L60 7L65 16L72 21L72 30L76 38L72 46L70 56L61 60L56 68L46 69L38 73L30 68L20 67L15 59L7 53L8 43L4 35L8 26L9 16L18 12L23 4Z"/><circle className="wax-rim" cx="40" cy="37" r="27"/><circle className="wax-indent" cx="40" cy="38" r="23"/><path className="wax-highlight" d="M17 28L21 20L30 14L39 12M11 33L10 39M50 64L60 57" fill="none" strokeWidth="3"/></svg>
    <span className="seal-icon" aria-hidden="true">{symbols}</span><strong>{result.rating.label}</strong>
  </span>;
}

function OfferSlot({ offer, selected, select, dragHandlers, isDragging, insertionBefore, move, metric, compactMoney }) {
  return <button className={'offer-slot ' + (selected ? 'is-selected ' : '') + (isDragging ? 'is-dragging ' : '') + (insertionBefore ? 'insert-before' : '')} data-offer-id={offer.id}
    aria-label={'选择 ' + (offer.name || '未命名 Offer')} aria-pressed={selected} onClick={select} onKeyDown={e => { if (e.altKey && ['ArrowLeft', 'ArrowRight'].includes(e.key)) { e.preventDefault(); move(e.key === 'ArrowLeft' ? -1 : 1); } }} {...dragHandlers}>
    <RatingSeal result={offer.result} card />
    <span className="slot-corner joker-mark" aria-hidden="true">J<span>O</span><span>K</span><span>E</span><span>R</span></span>
    <span className="slot-art" aria-hidden="true"><img src={import.meta.env.BASE_URL + 'joker.svg'} alt="" /></span>
    <strong className="slot-name">{offer.name || '未命名 Offer'}</strong><span className="slot-score">{cardMetric(offer, metric, compactMoney)}</span>
  </button>;
}

function SortControl({ settings, configure }) {
  const mode = settings.criterion === 'custom' ? 'custom' : 'automatic';
  return <section className="side-sorting" aria-labelledby="sorting-title"><h2 id="sorting-title">手牌排序</h2><div className="sort-settings">
    <div className="sort-modes" role="group" aria-label="排序模式">{[['custom', '自定义'], ['automatic', '自动']].map(([value, title]) =>
      <ActionButton key={value} aria-label={title + '排序'} aria-pressed={mode === value} onClick={() => configure({ mode: value })}>{title}</ActionButton>)}
    </div>
    <div className="sort-rule-list" role="group" aria-label="排序依据">{SORT_OPTIONS.map(([value, label]) => <ActionButton key={value} aria-pressed={mode !== 'custom' && settings.criterion === value} onClick={() => configure({ mode: 'automatic', criterion: value })}>{label}</ActionButton>)}</div>
    <div className="sort-direction" aria-label="排序方向">{[['desc', '降序 ↓'], ['asc', '升序 ↑']].map(([value, label]) => <ActionButton key={value} disabled={mode === 'custom'} aria-pressed={settings.direction === value} onClick={() => configure({ direction: value })}>{label}</ActionButton>)}</div>
  </div></section>;
}

function downloadText(filename, content) {
  const url = URL.createObjectURL(new Blob([content], { type: 'text/plain;charset=utf-8' }));
  const a = document.createElement('a'); a.href = url; a.download = filename; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function App() {
  const [resetBackup, setResetBackup] = useState(null);
  const [offers, setOffers] = useState(loadOffers);
  const [ui, setUi] = useState(loadUi);
  const [saved, setSaved] = useState(true);
  const [toast, setToast] = useState('');
  const [discarded, setDiscarded] = useState([]);
  const [pendingFocus, setPendingFocus] = useState(null);
  const [drag, setDrag] = useState(null);
  const dragSession = useRef(null), suppressClick = useRef(false), clickTimer = useRef(null);
  const dialogRef = useRef(null), optionsRef = useRef(null), optionsBackdrop = useRef(false), toastTimer = useRef(null);
  const evaluated = offers.map(evaluate);
  const displayed = displayedOffers(evaluated, ui.sort);
  const active = evaluated.find(o => o.id === ui.activeId) || evaluated[0];
  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(offers)); localStorage.setItem(UI_KEY, JSON.stringify(ui)); setSaved(true); }
    catch { setSaved(false); }
  }, [offers, ui]);
  useEffect(() => () => { clearTimeout(toastTimer.current); clearTimeout(clickTimer.current); }, []);
  useEffect(() => {
    if (!pendingFocus || !active) return;
    const input = document.getElementById(active.id + '-' + pendingFocus);
    for (let parent = input?.parentElement; parent && !parent.classList.contains('offer-editor'); parent = parent.parentElement) { if (parent.tagName === 'DETAILS') parent.open = true; }
    const hiddenRows = input?.closest('[hidden]');
    if (hiddenRows) [...document.querySelectorAll('[aria-controls]')].find(button => button.getAttribute('aria-controls') === hiddenRows.id)?.click();
    requestAnimationFrame(() => input?.focus()); setPendingFocus(null);
  }, [pendingFocus, active?.id]);
  const notify = message => { setToast(message); clearTimeout(toastTimer.current); toastTimer.current = setTimeout(() => setToast(''), 6000); };
  const select = id => { if (!suppressClick.current) setUi(current => ({ ...current, activeId: id })); };
  const update = (field, value) => setOffers(current => current.map(o => o.id !== active.id ? o : field === 'name' ? { ...o, name: value } :
    { ...o, input: { ...o.input, [field]: value, ...(field === 'city' && value !== 'custom' ? presetFields(value) : {}) } }));
  function requestFocus(field) {
    setPendingFocus(field);
  }
  function add() {
    if (offers.length >= MAX_OFFERS) return notify('牌槽已满，先弃置一张再抽牌。');
    let index = 1; while (offers.some(o => o.name === '新 Offer ' + index)) index++;
    const fresh = makeOffer('新 Offer ' + index, {});
    setOffers(current => current.length < MAX_OFFERS ? [...current, fresh] : current);
    setUi(current => ({ ...current, activeId: fresh.id })); notify('已抽取一份新 Offer。');
  }
  function duplicate() {
    if (!active || offers.length >= MAX_OFFERS) return;
    const fresh = { id: newId(), name: active.name.slice(0, 29) + ' 副本', input: { ...active.input } };
    setOffers(current => [...current, fresh]); setUi(current => ({ ...current, activeId: fresh.id })); notify('已复制当前 Offer。');
  }
  function resetCurrent() {
    if (!active) return;
    setResetBackup({ id: active.id, input: { ...active.input } });
    const fresh = makeOffer(active.name, { city: active.input.city });
    setOffers(current => current.map(o => o.id === active.id ? { ...o, input: fresh.input } : o));
    notify('已重置当前 Offer。');
  }
  function undoReset() {
    if (!resetBackup) return;
    setOffers(current => current.map(o => o.id === resetBackup.id ? { ...o, input: resetBackup.input } : o));
    setResetBackup(null); notify('已撤销重置。');
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
  function configureSort(patch) {
    setUi(current => ({ ...current, sort: configureSorting(evaluated, current.sort, patch) }));
  }
  function adoptCustomOrder(ids) {
    setOffers(current => orderByIds(current, ids));
    setUi(current => ({ ...current, sort: { ...current.sort, lastCriterion: current.sort.criterion === 'custom' ? current.sort.lastCriterion : current.sort.criterion, criterion: 'custom', automatic: false, manualOrder: [] } }));
  }
  function moveCard(id, delta) {
    const reordered = moveOffer(displayed, id, displayed.findIndex(offer => offer.id === id) + delta);
    adoptCustomOrder(reordered.map(offer => offer.id));
    notify('已调整自定义顺序。');
  }
  function exportResults() {
    const content = ['OFFER JOKER · 比较结果', '', ...evaluated.flatMap(o => o.error ? [o.name + '：' + o.error, ''] :
      [o.name + ' · ' + cities[o.input.city], '税前总包：' + money(o.result.nominalTC), '税后总包（价值折算）：' + money(o.result.afterTaxValue),
       '个人所得税：' + money(o.result.taxTotal), '个人五险一金：' + money(o.result.socialTotal), '税前等效年收入：' + money(o.result.eqPretax), '税后等效年收入：' + money(o.result.eqAfter),
       '实际 / 加权周工时：' + o.result.wh.actual + ' / ' + o.result.wh.weighted + ' h', '等效税后时薪：' + money(o.result.eqAfterHourly) + ' / h', '']),
      '税后价值包含权益与福利。缴费预设为历史参考；请核对实际合同与政策。'];
    downloadText('OfferJoker-比较结果.txt', content.join('\n')); notify('比较结果已导出。');
  }
  const targetAt = (x, y, item) => {
    const zone = document.elementFromPoint(x, y)?.closest('[data-drop-zone]')?.dataset.dropZone;
    return item.kind === 'draw' ? (['hand', 'editor'].includes(zone) ? zone : null) : (['deck', 'hand', 'editor'].includes(zone) ? zone : null);
  };
  function insertionAt(x, id) {
    const cards = [...document.querySelectorAll('.offer-slot')].filter(card => card.dataset.offerId !== id);
    const before = cards.find(card => { const rect = card.getBoundingClientRect(); return x < rect.x + rect.width / 2; });
    return { insertIndex: before ? cards.indexOf(before) : cards.length, insertBefore: before?.dataset.offerId || null };
  }
  function dragHandlers(item) {
    return {
      onPointerDown: e => {
        if (e.button !== 0 || dragSession.current || (item.kind === 'draw' && offers.length >= MAX_OFFERS)) return;
        e.currentTarget.setPointerCapture(e.pointerId);
        dragSession.current = { ...item, pointerId: e.pointerId, x: e.clientX, y: e.clientY, moved: false, order: displayed.map(offer => offer.id) };
      },
      onPointerMove: e => {
        const session = dragSession.current;
        if (!session || session.pointerId !== e.pointerId) return;
        if (!session.moved && Math.hypot(e.clientX - session.x, e.clientY - session.y) < 9) return;
        if (!session.moved && session.kind === 'offer') adoptCustomOrder(session.order);
        session.moved = true;
        const target = targetAt(e.clientX, e.clientY, session);
        setDrag({ ...session, currentX: e.clientX, currentY: e.clientY, target, ...(session.kind === 'offer' && target === 'hand' ? insertionAt(e.clientX, session.id) : {}) });
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
          else if (session.kind === 'offer' && target === 'deck') discard(session.id);
          else if (session.kind === 'offer' && target) {
            if (target === 'hand') {
              const { insertIndex } = insertionAt(e.clientX, session.id);
              setOffers(current => moveOffer(orderByIds(current, session.order), session.id, insertIndex));
            }
            setUi(current => ({ ...current, activeId: session.id }));
          }
        }
        dragSession.current = null; setDrag(null);
        if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
      },
      onPointerCancel: () => { dragSession.current = null; setDrag(null); },
      onLostPointerCapture: () => { dragSession.current = null; setDrag(null); },
    };
  }
  const clicked = action => { if (!suppressClick.current) action(); };

  const metric = ui.sort.criterion === 'custom' ? ui.sort.lastCriterion : ui.sort.criterion;
  return <MotionContext.Provider value={ui.animations}><SurfaceEffects background={ui.backgroundEffect} crt={ui.crtEffect} /><div className={'app-shell table-layout ' + (!ui.animations ? 'motion-off' : '')}>
    <aside className="sidebar" aria-label="标题、帮助与选项">
      <div className="sidebar-brand"><span className="brand-mark" aria-hidden="true"><img src={import.meta.env.BASE_URL + 'joker.svg'} alt="" /></span><div><h1><span>Offer</span> <span>Joker</span></h1></div></div>
      <div className="sidebar-links"><a href="https://github.com/JustinWCola/offer_joker" target="_blank" rel="noreferrer">GitHub ↗</a><a href="https://github.com/JustinWCola/offer_joker/blob/main/THIRD_PARTY_NOTICES.md" target="_blank" rel="noreferrer">Licenses ↗</a></div>
      <div className="sidebar-offer-count" aria-label="Offer 数量"><span>OFFER</span><strong>{offers.length}<small> / {MAX_OFFERS}</small></strong></div>
      <SortControl settings={ui.sort} configure={configureSort} />

      <div className="side-bottom"><span className="save-indicator"><i />{saved ? '自动保存在此浏览器' : '存储不可用，仅当前会话'}</span></div>

      <div className="sidebar-actions">
        <ActionButton className="sidebar-button help-button" onClick={() => dialogRef.current.showModal()}>? 帮助</ActionButton>
        <ActionButton className="sidebar-button options-button" onClick={() => optionsRef.current.showModal()}>⚙ 选项</ActionButton>
      </div>
    </aside>
    <main className="playing-table" aria-label="Offer Joker">
      <div className="hand-row"><section className={'hand-zone ' + (drag?.target === 'hand' ? 'drop-ready' : '')} data-drop-zone="hand" aria-label="Offer 牌槽">
        <div style={{ '--offer-count': offers.length }} className={'offer-hand ' + (offers.length >= 7 ? 'is-dense ' : '') + (drag?.kind === 'offer' && drag.target === 'hand' && !drag.insertBefore ? 'insert-end' : '')}>{displayed.map(offer => <OfferSlot key={offer.id} offer={offer}
          metric={metric} compactMoney={ui.compactMoney} selected={active?.id === offer.id} select={() => select(offer.id)} dragHandlers={dragHandlers({ kind: 'offer', id: offer.id })}
          isDragging={drag?.id === offer.id} insertionBefore={drag?.target === 'hand' && drag.insertBefore === offer.id} move={delta => moveCard(offer.id, delta)} />)}
          {offers.length === 0 && <div className="hand-empty">还没有手牌。点击抽牌堆，或拖一张进来。</div>}
        </div>
      </section>
        <aside className="deck-rail" aria-label="Offer 牌堆">
          <div className={'pile combined-pile ' + (drag?.kind === 'offer' ? 'delete-ready ' : '') + (drag?.target === 'deck' ? 'delete-hover' : '')} data-drop-zone="deck">
            <button className="deck-action draw-action" disabled={offers.length >= MAX_OFFERS} onClick={() => clicked(add)} {...dragHandlers({ kind: 'draw' })} aria-label="抽取新 Offer">
              <span className="deck-face"><span className="deck-symbol" aria-hidden="true">{drag?.kind === 'offer' ? '×' : '♠'}</span><strong>{drag?.kind === 'offer' ? (drag.target === 'deck' ? '松开删除' : '拖回删除') : '牌堆'}</strong><small>{drag?.kind === 'offer' ? offers.find(o => o.id === drag.id)?.name : offers.length >= MAX_OFFERS ? '手牌已满 · 可拖回删除' : '点击或拖出新增'}</small></span>
            </button>
            {discarded.length > 0 && <ActionButton className="undo-discard" onClick={undo} disabled={offers.length >= MAX_OFFERS}>↶ 撤销删除</ActionButton>}
          </div>
        </aside></div>
      <div className={'editor-drop-zone ' + (drag?.target === 'editor' ? 'drop-ready' : '')} data-drop-zone="editor">
        {active ? <OfferEditor key={active.id} offer={active} update={update} duplicate={duplicate} canDuplicate={offers.length < MAX_OFFERS} reset={resetCurrent} compactMoney={ui.compactMoney} requestFocus={requestFocus} discard={() => discard()} /> :
          <div className="empty-editor"><span aria-hidden="true">♠</span><h2>下一份 Offer，从抽牌开始。</h2><p>抽一张手牌，填入薪资与工时，即可比较。</p><button className="primary-button" onClick={add}>抽一张 Offer</button></div>}
      </div>
    </main>
    <HelpDialog dialogRef={dialogRef} />
    <dialog className="method-dialog options-dialog" aria-labelledby="options-title" ref={optionsRef} onPointerDown={e => { optionsBackdrop.current = e.target === e.currentTarget; }} onClick={e => { if (e.target === e.currentTarget && optionsBackdrop.current) optionsRef.current.close(); optionsBackdrop.current = false; }}>
      <div className="dialog-header"><h2 id="options-title">选项</h2><ActionButton className="dialog-close" aria-label="关闭选项" onClick={() => optionsRef.current.close()}>×</ActionButton></div>
      <div className="options-content">
        <label><input type="checkbox" checked={ui.animations} onChange={e => setUi(current => ({ ...current, animations: e.target.checked }))} />计分与火焰动效</label>
        <label><input type="checkbox" checked={ui.backgroundEffect} onChange={e => setUi(current => ({ ...current, backgroundEffect: e.target.checked }))} />流动背景效果</label>
        <label><input type="checkbox" checked={ui.crtEffect} onChange={e => setUi(current => ({ ...current, crtEffect: e.target.checked }))} />CRT 屏幕效果</label>

        <label><input type="checkbox" checked={ui.compactMoney} onChange={e => setUi(current => ({ ...current, compactMoney: e.target.checked }))} />紧凑金额单位（年度万元／月收入千元）</label>
        <ActionButton onClick={exportResults} disabled={offers.length === 0}>↓ 导出比较结果</ActionButton>
        <ActionButton onClick={() => { setOffers(exampleOffers()); setDiscarded([]); setUi(current => ({ ...current, activeId: null, sort: defaultSort })); optionsRef.current.close(); notify('已恢复参考示例。'); }}>↻ 恢复示例</ActionButton>
      </div>
    </dialog>
    {toast && <div className="toast" role="status"><span>{toast}</span>{toast.startsWith('已重置') && resetBackup && <ActionButton onClick={undoReset} disabled={!offers.some(o => o.id === resetBackup.id)}>撤销重置</ActionButton>}{toast.startsWith('已弃置') && <ActionButton onClick={undo} disabled={offers.length >= MAX_OFFERS}>撤销</ActionButton>}<button className="toast-close" aria-label="关闭提示" onClick={() => setToast('')}>×</button></div>}
    {drag && <div className="drag-preview" style={{ left: drag.currentX, top: drag.currentY }} aria-hidden="true"><span>{drag.kind === 'draw' ? '♠' : 'J'}</span><strong>{drag.kind === 'draw' ? '新 Offer' : offers.find(o => o.id === drag.id)?.name}</strong></div>}
  </div></MotionContext.Provider>;
}

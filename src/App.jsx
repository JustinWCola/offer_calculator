import React, { useEffect, useRef, useState } from 'react';
import Flame, { MotionContext } from './Flame.jsx';
import PixelSelect from './SelectField.jsx';
import { calculate, cityPresets } from './calculator.js';
import NumericInput from './NumericInput.jsx';
import ActionButton from './ActionButton.jsx';
import { SORT_OPTIONS, productHeat, productValue, displayedOffers, orderByIds, moveOffer, configureSorting, migrateManualOrder, incomeTotals } from './table-utils.js';

const STORAGE_KEY = 'offer-deck:v1';
const MAX_OFFERS = 10;
const cities = { beijing: '北京', shanghai: '上海', shenzhen: '深圳', guangzhou: '广州', hangzhou: '杭州', chengdu: '成都', nanjing: '南京', wuhan: '武汉', custom: '自定义' };
const suits = ['♠', '♥', '♣', '♦'];
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
      const restored = saved.map(o => ({ id: o.id, name: o.name.slice(0, 32), input: { ...defaults, ...presetFields(o.input.city),
        ...Object.fromEntries(Object.entries(o.input).filter(([key, value]) =>
          (Object.hasOwn(defaults, key) || Object.hasOwn(labels, key)) && ['number', 'string'].includes(typeof value))) } }));
      let previousSort;
      try { previousSort = JSON.parse(localStorage.getItem(UI_KEY))?.sort; } catch { /* Preserve valid offers if UI storage is damaged. */ }
      return migrateManualOrder(restored, previousSort);
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

function MethodDialog({ dialogRef }) {
  const backdropPressed = useRef(false);
  return <dialog className="method-dialog" aria-labelledby="rules-title" ref={dialogRef} onPointerDown={e => { backdropPressed.current = e.target === e.currentTarget; }} onClick={e => { if (e.target === e.currentTarget && backdropPressed.current) dialogRef.current.close(); backdropPressed.current = false; }}>
    <div className="dialog-header"><div><span className="eyebrow">THE RULES</span><h2 id="rules-title">这副牌怎么算？</h2></div>
      <button className="dialog-close" aria-label="关闭计算规则" onClick={() => dialogRef.current.close()}>×</button></div>
    <div className="method-content">
      <h3>使用牌桌</h3><p>点击顶部 Offer 卡牌选择要编辑的报价；选中的卡牌会向上抽出。左侧排序可选择自定义或自动。自动排序随输入变化更新；拖动手牌会采用当前顺序并切换到自定义，关闭自动排序。拖动手牌调整位置，键盘可按 Alt + 左右方向键移动。点击牌槽旁的牌堆新增报价，或将牌堆拖到牌槽；将任意 Offer 拖回牌堆即可删除，编辑区也提供删除按钮。删除后可撤销。键盘用户可以用 Tab 和 Enter 完成同样的操作。</p><p>收入、工时、税费在编辑区并列展示；顶部结果始终可见。蓝色框是底数，红色框是倍率，结果使用完整精度计算。两数相乘后的乘积达到升温范围时，会出现分级火焰；年度金额按 10 万、30 万、50 万分级，周工时按 40、50、60 小时分级。火焰只表示乘积大小，不代表报价更好。可以在左侧选项关闭动画。</p><h3>① 先数清筹码</h3><p>名义总包 = 月薪 × 发薪月数 + 补贴 + 奖金 + 签字费 + 本年归属股权 + 其他收入 + 福利。浮动收入再乘以各自的兑现系数，得到价值折算总包。</p>
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
    return { activeId, animations: value.animations !== false, notes: value.notes === true, compactMoney: value.compactMoney === true,
      sort: { criterion, lastCriterion: SORT_OPTIONS.some(([key]) => key === raw.lastCriterion) ? raw.lastCriterion : previousCriterion, direction: raw.direction === 'asc' ? 'asc' : 'desc', automatic: criterion !== 'custom' && raw.automatic === true,
        manualOrder: Array.isArray(raw.manualOrder) ? raw.manualOrder.filter(id => typeof id === 'string') : [] } };
  } catch { return { activeId: null, animations: true, notes: false, compactMoney: false, sort: defaultSort }; }
}
function ProductCounter({ offer, left, right, title, leftLabel, rightLabel, leftUnit = '元', rightUnit = '×',
  heatUnit = 'income', leftMax, rightMax, leftStep = 100, rightStep = .05, format = money, update, notes = false, explanation, tableMode = false, tax, compactMoney = false }) {
  const a = offer.input[left], b = offer.input[right], result = productValue(a, b, leftMax, rightMax);
  const heat = productHeat(result, heatUnit);
  const operand = (field, value, label, unit, color, max, step) => <div className="operand-stack">
    <label className={tableMode ? 'sr-only' : 'operand-caption'} htmlFor={offer.id + '-' + field}>{label}<span>{unit}</span></label>
    <div className={'operand ' + color + ' heat-' + heat} data-heat={heat}>
      {heat > 0 && <Flame level={heat} color={color === 'chips-operand' ? 'blue' : 'red'} />}
      <NumericInput id={offer.id + '-' + field} label={labels[field]} value={value} max={max} step={step} scale={compactMoney && tableMode && field === left ? (left === 'monthlyBase' || left === 'monthlyAllowance' ? 1000 : 10000) : 1} onChange={value => update(field, value)} />
    </div>
  </div>;
  if (tableMode) return <tr className="income-row" data-product={left}>
    <th scope="row"><div className="income-item-name">{tax || <span className="tax-symbol tax-symbol-static" title="并入综合所得">综</span>}<span>{title}</span></div><output data-testid={'product-' + left}>{result === null ? '—' : format(result)}</output></th>
    <td>{operand(left, a, leftLabel || labels[left], leftUnit, 'chips-operand', leftMax, leftStep)}</td>
    <td className="income-mult-cell"><span className="row-multiply" aria-hidden="true">×</span>{operand(right, b, rightLabel || labels[right], rightUnit, 'mult-operand', rightMax, rightStep)}</td>
  </tr>;
  return <section className="product-counter" aria-label={title + '乘法'} data-product={left}>
    <div className="product-title"><h3>{title}</h3><output className="product-result" aria-live="polite" data-testid={'product-' + left}>{result === null ? '—' : format(result)}</output></div>
    <div className="product-equation">
      {operand(left, a, leftLabel || labels[left], leftUnit, 'chips-operand', leftMax, leftStep)}
      <span className="equation-sign" aria-label="乘以">×</span>
      {operand(right, b, rightLabel || labels[right], rightUnit, 'mult-operand', rightMax, rightStep)}
    </div>
    {notes && explanation && <p className="product-note">{explanation}</p>}
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

function OfferEditor({ offer, update, duplicate, canDuplicate, notes, requestFocus, discard, compactMoney }) {
  const r = offer.result, totals = incomeTotals(offer.input), amount = value => r ? scaledMoney(value, compactMoney) : '—';
  const [monthlyExpanded, setMonthlyExpanded] = useState(false), [annualExpanded, setAnnualExpanded] = useState(false);
  const number = (field, options = {}) => <NumberField key={field} offer={offer} field={field} update={update} {...options} />;
  const select = (field, choices, label, compact = false) => <PixelSelect key={field} offer={offer} field={field} update={update} options={choices} label={label || labels[field]} compact={compact} />;
  const product = (left, right, title, options = {}) => <ProductCounter key={offer.id + '-' + left} offer={offer} left={left} right={right} title={title} update={update} notes={notes} compactMoney={compactMoney} format={value => scaledMoney(value, compactMoney)} {...options} />;
  const annualIncomeRows = [
    ['signOn', 'signFactor', '签字费', 'signTax', taxOptions], ['stock', 'stockFactor', '本年归属股票', 'stockTax', equityOptions],
    ['option', 'optionFactor', '本年可实现期权', 'optionTax', equityOptions], ['otherCash', 'otherFactor', '其他现金', 'otherTax', taxOptions],
    ['benefits', 'benefitFactor', '非现金福利'],
  ];
  return <section className="offer-editor" aria-label="当前 Offer 编辑区">
    <header className="offer-summary">
      <div className="summary-identity"><div className="editor-name"><label className="sr-only" htmlFor={offer.id + '-name'}>Offer 名称</label>
        <input id={offer.id + '-name'} value={offer.name} maxLength={32} onChange={e => update('name', e.target.value)} placeholder="为这份 Offer 命名" />
        <span>{cities[offer.input.city]}{!r && ' · 输入待完善'}</span></div>
        <div className="summary-actions">{r && <span className={'rating-stamp rating-' + (r.eqAfterHourly >= 200 ? 'legend' : r.eqAfterHourly >= 120 ? 'top' : r.eqAfterHourly >= 70 ? 'good' : r.eqAfterHourly >= 35 ? 'normal' : 'low')} role="status" aria-label={'Offer 评价：' + r.rating.label} title={r.rating.comment}><span>OFFER 评级</span><strong>{r.rating.label}</strong></span>}<button className="icon-button delete-offer" onClick={discard} aria-label="删除当前 Offer" title="删除当前 Offer">×</button>
        <button className="icon-button duplicate-offer" onClick={duplicate} disabled={!canDuplicate} aria-label="复制当前 Offer" title="复制当前 Offer">⧉</button></div>
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
        <table className="shared-income-table monthly-income-table"><caption><span>按月收入</span><strong data-testid="monthly-income-total">{totals.recurringAnnual === null ? '—' : scaledMoney(totals.recurringAnnual, compactMoney)}<small> / 年</small></strong></caption>
          <thead><tr><th scope="col">项目 / 全年合计</th><th scope="col">金额 · {compactMoney ? '千元' : '元'} / 月</th><th scope="col">发放月数</th></tr></thead>
          <tbody>{product('monthlyBase', 'salaryMonths', '月固定工资', { tableMode: true, leftStep: 500, rightStep: .5 })}</tbody>
          <tbody id={offer.id + '-monthly-extra'} hidden={!monthlyExpanded} data-income-extra="monthly">
            {product('monthlyAllowance', 'allowanceMonths', '月补贴', { tableMode: true, rightMax: 12, rightStep: 1 })}
          </tbody>
          <tfoot><tr><td colSpan="3"><ActionButton className="income-expand" aria-expanded={monthlyExpanded} aria-controls={offer.id + '-monthly-extra'} onClick={() => setMonthlyExpanded(value => !value)}>{monthlyExpanded ? '− 收起月补贴' : '+ 展开月补贴'}</ActionButton></td></tr></tfoot>
        </table>
        <table className="shared-income-table annual-income-table"><caption><span>一次性收入 / 本年实现价值</span><strong data-testid="annual-income-total">{totals.annual === null ? '—' : scaledMoney(totals.annual, compactMoney)}</strong></caption>
          <thead><tr><th scope="col">项目 / 折算价值</th><th scope="col">名义金额 · {compactMoney ? '万元' : '元'}</th><th scope="col">兑现系数</th></tr></thead>
          <tbody>{product('annualBonus', 'bonusFactor', '年终奖', { tableMode: true, rightMax: 1, rightStep: .05, tax: select('bonusTax', [['separate', '奖金单独计税'], ['comprehensive', '并入综合所得']], '年终奖计税方式', true) })}</tbody>
          <tbody id={offer.id + '-annual-extra'} hidden={!annualExpanded} data-income-extra="annual">
            {annualIncomeRows.map(([left, right, title, tax, choices]) => product(left, right, title, { tableMode: true, rightMax: 1, rightStep: .05, tax: tax ? select(tax, choices, labels[tax], true) : <span className="tax-symbol tax-symbol-static" title="非现金福利：不计现金个税" aria-label="非现金福利不计现金个税">免</span> }))}
          </tbody>
          <tfoot><tr><td colSpan="3"><ActionButton className="income-expand" aria-expanded={annualExpanded} aria-controls={offer.id + '-annual-extra'} onClick={() => setAnnualExpanded(value => !value)}>{annualExpanded ? '− 收起一次性补贴与权益' : '+ 展开一次性补贴与权益'}</ActionButton></td></tr></tfoot>
        </table>
        {notes && <p className="field-help">月收入按发放月数合计；年终奖只填未计入发薪月数的部分。一次性收入按本年金额与兑现系数折算，税费仍按名义金额估算。</p>}
      </section>
      <section className="editor-column time-column" aria-labelledby="time-heading"><h2 id="time-heading" className="column-heading">02 <span>工时</span></h2>
        {product('weekdayHours', 'weekdayDays', '工作日工时', { leftUnit: '小时 / 天', rightUnit: '天 / 周', leftMax: 24, rightMax: 5, leftStep: .5, rightStep: .5, heatUnit: 'hours', format: value => scoreNumber(value) + ' h / 周' })}
        {product('weekendHours', 'weekendDays', '周末加班', { leftUnit: '小时 / 天', rightUnit: '天 / 周', leftMax: 24, rightMax: 2, leftStep: .5, rightStep: .5, heatUnit: 'hours', format: value => scoreNumber(value) + ' h / 周' })}
        <div className="field-grid preference-fields">
          {select('growth', coefficientOptions(offer.input.growth, [[1.3, '1.30 顶级成长'], [1.15, '1.15 良好成长'], [1, '1.00 普通'], [.9, '0.90 较弱'], [.8, '0.80 消耗型']]), '发展前景')}
          {select('locationFactor', coefficientOptions(offer.input.locationFactor, [[1.3, '1.30 非常喜欢'], [1.15, '1.15 比较喜欢'], [1, '1.00 中性'], [.9, '0.90 不太喜欢'], [.8, '0.80 较不适应']]), '生活偏好')}
        </div>
        <TextResults rows={[["实际周工时", r ? r.wh.actual.toFixed(1) + ' h' : '—'], ['加权周工时', r ? r.wh.weighted.toFixed(1) + ' h' : '—']]} />
        <p className="field-help">工作日超出 8 小时按 1.5 倍、周末按 2 倍加权。成长与生活偏好以 1 为中性值。</p>
      </section>
      <section className="editor-column fees-column" aria-labelledby="fees-heading"><h2 id="fees-heading" className="column-heading">03 <span>税费</span></h2>
        <div className="field-grid fees-base-fields">{select('city', Object.entries(cities), '工作城市')}{select('baseMode', [['salary', '按月薪估算并限额'], ['custom', '手动输入基数']], '缴费基数')}
          {offer.input.baseMode === 'custom' && <>{number('socialBase')}{number('fundBase')}</>}
        </div>
        <div className="field-grid contribution-fields" aria-label="个人缴费参数">{number('contribMonths', { unit: '月', max: 12, step: 1 })}
          {['pensionRate', 'medicalRate', 'unemploymentRate', 'otherSocialRate', 'fundRate'].map(field => number(field, { unit: '%', max: 100, step: .1 }))}
        </div>
        <div className="field-grid deduction-fields" aria-label="税前扣除">{number('specialDeduction', { step: 1000 })}{number('otherDeduction', { step: 1000 })}</div>
        <details className="advanced-settings"><summary>缴费上下限与固定医疗费</summary><div className="advanced-content">
          <div className="field-grid">{number('socialMin', { step: 100 })}{number('socialMax', { cap: true, step: 100 })}{number('fundMin', { step: 100 })}{number('fundMax', { cap: true, step: 100 })}{number('medicalFixed', { step: 1 })}</div>
          <p className="field-help">缴费预设为历史示例，请按实际年度与公司口径调整；基数上限留空表示未设上限。</p>
        </div></details>
      </section>
    </div>
    <details className="result-details"><summary>完整结果与税费明细</summary>
      <TextResults rows={[["价值折算税前总包", amount(r?.adjustedTC)], ['税前 855 等效年收入', amount(r?.eqPretax)], ['税后 855 等效年收入', amount(r?.eqAfter)],
        ['等效税前时薪', r ? money(r.eqPretax / 2080) + ' / h' : '—'], ['等效税后时薪', r ? money(r.eqAfterHourly) + ' / h' : '—'], ['税前名义总包', amount(r?.nominalTC)],
        ['平均月税后价值', r ? scaledMoney(r.afterTaxValue / 12, compactMoney, 'monthly') : '—'], ['预计个人所得税', amount(r?.taxTotal)], ['个人五险一金', amount(r?.socialTotal)], ['税后现金 / 权益价值', amount(r?.afterTaxValue)],
        ['实际 / 加权周工时', r ? r.wh.actual.toFixed(1) + ' / ' + r.wh.weighted.toFixed(1) + ' h' : '—']]} />
      <h3 className="detail-heading">收入拆分（名义金额）</h3>
      <TextResults rows={[["固定工资", 'salary'], ['固定补贴', 'allowance'], ['年终奖', 'bonus'], ['签字费', 'sign'], ['股票 / RSU', 'stock'], ['期权', 'option'], ['其他现金', 'other'], ['非现金福利', 'benefits']].map(([label, key]) => [label, amount(r?.[key])])} />
      <h3 className="detail-heading">个税明细</h3>
      <TextResults className="tax-breakdown" rows={[["综合所得应纳税所得额", amount(r?.taxableComp)], ['综合所得个税', amount(r?.taxComp)], ['奖金个税', amount(r?.taxBonus)], ['股权个税', amount(r?.taxEquity)], ['个人所得税合计', amount(r?.taxTotal)]]} />
      <h3 className="detail-heading">个人五险一金明细</h3>
      <TextResults className="contribution-breakdown" rows={[["社保月基数", amount(r?.appliedSocialBase)], ['公积金月基数', amount(r?.appliedFundBase)], ...[['养老 / 年', 'pension'], ['医疗 / 年（含固定费）', 'medical'], ['失业 / 年', 'unemployment'], ['其他社保 / 年', 'otherSocial'], ['公积金 / 年', 'fund'], ['个人全年缴费', 'socialTotal']].map(([label, key]) => [label, amount(r?.[key])])]} />
      <p className="field-help">{r?.rating.comment} 税后总包包含折算后的权益与福利，不等同于现金到账。855 为每天 8 小时、每周 5 天；全年比较按 2080 小时。</p>
    </details>
    </div>
  </section>;
}

function OfferSlot({ offer, index, selected, select, dragHandlers, isDragging, insertionBefore, move, metric, compactMoney }) {
  return <button className={'offer-slot ' + (selected ? 'is-selected ' : '') + (isDragging ? 'is-dragging ' : '') + (insertionBefore ? 'insert-before' : '')} data-offer-id={offer.id}
    aria-label={'选择 ' + (offer.name || '未命名 Offer')} aria-pressed={selected} onClick={select} onKeyDown={e => { if (e.altKey && ['ArrowLeft', 'ArrowRight'].includes(e.key)) { e.preventDefault(); move(e.key === 'ArrowLeft' ? -1 : 1); } }} {...dragHandlers}>
    <span className={'slot-corner ' + (index % 2 ? 'red-suit' : '')}>{suits[index % suits.length]}<small>{index + 1}</small></span>
    <span className="slot-art" aria-hidden="true"><svg viewBox="0 0 48 48" shapeRendering="crispEdges"><path fill="#009dff" d="M4 8h12v4h8v16H12V16H4z" /><path fill="#fe5f55" d="M32 4h12v16h-8v8H24V12h8z" /><path fill="#f3b958" d="M4 4h8v8H4zM36 0h8v8h-8z" /><path fill="#ead7a4" d="M12 24h24v16H12z" /><path fill="#374244" d="M16 28h4v4h-4zM28 28h4v4h-4zM20 36h8v4h-8z" /><path fill="#4bc292" d="M8 40h12v8H8zM28 40h12v8H28z" /></svg></span>
    <strong className="slot-name">{offer.name || '未命名 Offer'}</strong><span className="slot-score">{cardMetric(offer, metric, compactMoney)}</span>
  </button>;
}

function SortControl({ settings, configure }) {
  const [open, setOpen] = useState(() => matchMedia('(min-width: 801px)').matches);
  useEffect(() => {
    const media = matchMedia('(min-width: 801px)'), change = () => setOpen(media.matches);
    media.addEventListener('change', change); return () => media.removeEventListener('change', change);
  }, []);
  const mode = settings.criterion === 'custom' ? 'custom' : 'automatic';
  return <details className="side-sorting" open={open} onToggle={e => setOpen(e.currentTarget.open)}><summary>手牌排序 <span>⇅</span></summary><div className="sort-settings">
    <div className="sort-modes" role="group" aria-label="排序模式">{[['custom', '自定义'], ['automatic', '自动']].map(([value, title]) =>
      <ActionButton key={value} aria-label={title + '排序'} aria-pressed={mode === value} onClick={() => configure({ mode: value })}>{title}</ActionButton>)}
    </div>
    {mode !== 'custom' && <>
      <PixelSelect offer={{ id: 'hand-sort', input: { criterion: settings.criterion } }} field="criterion" label="排序依据" options={SORT_OPTIONS} update={(_, value) => configure({ criterion: value })} />
      <div className="sort-direction" aria-label="排序方向">{[['desc', '降序 ↓'], ['asc', '升序 ↑']].map(([value, label]) => <ActionButton key={value} aria-pressed={settings.direction === value} onClick={() => configure({ direction: value })}>{label}</ActionButton>)}</div>
    </>}
  </div></details>;
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
    const hiddenRows = input?.closest('tbody[hidden]');
    if (hiddenRows) [...document.querySelectorAll('[aria-controls]')].find(button => button.getAttribute('aria-controls') === hiddenRows.id)?.click();
    requestAnimationFrame(() => input?.focus()); setPendingFocus(null);
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
  return <MotionContext.Provider value={ui.animations}><div className={'app-shell table-layout ' + (!ui.animations ? 'motion-off' : '')}>
    <aside className="sidebar" aria-label="标题、帮助与选项">
      <div className="sidebar-brand"><span className="brand-mark" aria-hidden="true">♠</span><div><h1><span>Offer</span> <span>Joker</span></h1></div></div>
      <div className="sidebar-offer-count" aria-label="Offer 数量"><span>OFFER</span><strong>{offers.length}<small> / {MAX_OFFERS}</small></strong></div>
      <SortControl settings={ui.sort} configure={configureSort} />
      <section className="sidebar-tools" aria-label="牌桌操作"><h2>牌桌操作</h2><ActionButton disabled={offers.length >= MAX_OFFERS} onClick={add}>＋ 新增 Offer</ActionButton><ActionButton disabled={!active || offers.length >= MAX_OFFERS} onClick={duplicate}>⧉ 复制当前</ActionButton><ActionButton disabled={!discarded.length || offers.length >= MAX_OFFERS} onClick={undo}>↶ 撤销删除</ActionButton></section>
      <div className="side-bottom"><span className="save-indicator"><i />{saved ? '自动保存在此浏览器' : '存储不可用，仅当前会话'}</span><small>示例与缴费预设仅作参考</small></div>
      <div className="sidebar-actions">
        <ActionButton className="sidebar-button help-button" onClick={() => dialogRef.current.showModal()}>? 帮助</ActionButton>
        <ActionButton className="sidebar-button options-button" onClick={() => optionsRef.current.showModal()}>⚙ 选项</ActionButton>
      </div>
    </aside>
    <main className="playing-table" aria-label="Offer Joker">
      <div className="hand-row"><section className={'hand-zone ' + (drag?.target === 'hand' ? 'drop-ready' : '')} data-drop-zone="hand" aria-label="Offer 牌槽">
        <div style={{ '--offer-count': offers.length }} className={'offer-hand ' + (offers.length >= 7 ? 'is-dense ' : '') + (drag?.kind === 'offer' && drag.target === 'hand' && !drag.insertBefore ? 'insert-end' : '')}>{displayed.map((offer, index) => <OfferSlot key={offer.id} offer={offer} index={index}
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
        {active ? <OfferEditor key={active.id} offer={active} update={update} duplicate={duplicate} canDuplicate={offers.length < MAX_OFFERS} notes={ui.notes} compactMoney={ui.compactMoney} requestFocus={requestFocus} discard={() => discard()} /> :
          <div className="empty-editor"><span aria-hidden="true">♠</span><h2>下一份 Offer，从抽牌开始。</h2><p>抽一张手牌，填入薪资与工时，即可比较。</p><button className="primary-button" onClick={add}>抽一张 Offer</button></div>}
      </div>
    </main>
    <MethodDialog dialogRef={dialogRef} />
    <dialog className="method-dialog options-dialog" aria-labelledby="options-title" ref={optionsRef} onPointerDown={e => { optionsBackdrop.current = e.target === e.currentTarget; }} onClick={e => { if (e.target === e.currentTarget && optionsBackdrop.current) optionsRef.current.close(); optionsBackdrop.current = false; }}>
      <div className="dialog-header"><h2 id="options-title">选项</h2><ActionButton className="dialog-close" aria-label="关闭选项" onClick={() => optionsRef.current.close()}>×</ActionButton></div>
      <div className="options-content">
        <label><input type="checkbox" checked={ui.animations} onChange={e => setUi(current => ({ ...current, animations: e.target.checked }))} />计分与火焰动效</label>
        <label><input type="checkbox" checked={ui.notes} onChange={e => setUi(current => ({ ...current, notes: e.target.checked }))} />显示公式说明</label>
        <label><input type="checkbox" checked={ui.compactMoney} onChange={e => setUi(current => ({ ...current, compactMoney: e.target.checked }))} />紧凑金额单位（年度万元／月收入千元）</label>
        <ActionButton onClick={exportResults} disabled={offers.length === 0}>↓ 导出比较结果</ActionButton>
        <ActionButton onClick={() => { setOffers(exampleOffers()); setDiscarded([]); setUi(current => ({ ...current, activeId: null, sort: defaultSort })); optionsRef.current.close(); notify('已恢复两份示例。'); }}>↻ 恢复示例</ActionButton>
      </div>
    </dialog>
    {toast && <div className="toast" role="status"><span>{toast}</span>{toast.startsWith('已弃置') && <ActionButton onClick={undo} disabled={offers.length >= MAX_OFFERS}>撤销</ActionButton>}<button className="toast-close" aria-label="关闭提示" onClick={() => setToast('')}>×</button></div>}
    {drag && <div className="drag-preview" style={{ left: drag.currentX, top: drag.currentY }} aria-hidden="true"><span>{drag.kind === 'draw' ? '♠' : 'J'}</span><strong>{drag.kind === 'draw' ? '新 Offer' : offers.find(o => o.id === drag.id)?.name}</strong></div>}
  </div></MotionContext.Provider>;
}

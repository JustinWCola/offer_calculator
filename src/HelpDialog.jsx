import React, { useRef } from 'react';
import { INCOME_HEAT_THRESHOLDS } from './table-utils.js';

const incomeItems = [['monthlyBase', '月基本工资全年合计'], ['monthlyAllowance', '月现金补贴全年合计'], ['annualBonus', '年终奖'], ['signOn', '签字费'], ['stock', '股票'], ['option', '期权'], ['otherCash', '其他现金'], ['benefits', '非现金福利']];
const sections = [['help-use', '操作'], ['help-income', '收入'], ['help-tax', '税费'], ['help-time', '工时与假期'], ['help-compare', '等效结果'], ['help-fire', '火焰与评级'], ['help-data', '保存与设置']];

export default function HelpDialog({ dialogRef }) {
  const backdropPressed = useRef(false);
  return <dialog className="method-dialog" aria-labelledby="rules-title" ref={dialogRef} onPointerDown={e => { backdropPressed.current = e.target === e.currentTarget; }} onClick={e => { if (e.target === e.currentTarget && backdropPressed.current) dialogRef.current.close(); backdropPressed.current = false; }}>
    <div className="dialog-header"><h2 id="rules-title">使用与计算方法</h2><button className="dialog-close" aria-label="关闭计算规则" onClick={() => dialogRef.current.close()}>×</button></div>
    <div className="method-content">
      <nav className="help-nav" aria-label="帮助目录">{sections.map(([id, title]) => <a key={id} href={'#' + id} onClick={e => { e.preventDefault(); document.getElementById(id)?.scrollIntoView({ block: 'start', behavior: 'instant' }); }}>{title}</a>)}</nav>
      <section id="help-use"><h3>操作</h3><ul>
        <li>点击 Offer 牌选择报价，编辑区只修改当前选中的 Offer。</li>
        <li>点击牌堆或将其拖入牌槽新增；将 Offer 拖回牌堆删除。删除可撤销，编辑区也有删除、复制和重置按钮。</li>
        <li>选择排序依据会开启自动排序。拖动牌或按 Alt + ← / → 进入自定义排序，并保留当前排列。</li>
        <li>蓝框与红框相乘得到该项结果；上下箭头可调整数值。完整结果与分类明细在编辑区底部展开。</li>
      </ul></section>
      <section id="help-income"><h3>收入</h3>
        <table className="help-table"><thead><tr><th>填写项</th><th>填写口径</th></tr></thead><tbody>
          <tr><td>月基本工资、月现金补贴</td><td>填写每月金额和各自发放月数，按相乘后的全年金额计算。</td></tr>
          <tr><td>年终奖</td><td>只填未计入发薪月数的额外奖金，避免重复计算。</td></tr>
          <tr><td>签字费、股票、期权等</td><td>填写本年金额。股票填本年归属的股票或 RSU，期权填本年可实现价值。</td></tr>
          <tr><td>兑现系数</td><td>名义金额乘系数得到比较价值；例如 0.8 表示按 80% 折算。税费仍按名义金额估算。</td></tr>
        </tbody></table>
        <dl className="help-formulas"><dt>税前总包（名义）</dt><dd>工资全年合计 + 补贴全年合计 + 各项浮动收入名义金额</dd><dt>价值折算税前总包</dt><dd>工资与补贴全年合计 + 各项浮动收入 × 各自兑现系数</dd><dt>税后价值</dt><dd>价值折算税前总包 − 个人所得税 − 个人五险一金</dd></dl>
        <p>税后价值包含折算后的权益与福利，不等同于现金到账。</p>
      </section>
      <section id="help-tax"><h3>税费</h3>
        <table className="help-table"><thead><tr><th>计税符号</th><th>含义</th></tr></thead><tbody>
          <tr><td>综</td><td>并入综合所得，使用年度七级税率。</td></tr>
          <tr><td>单</td><td>年终奖按全年一次性奖金单独计税规则估算。</td></tr>
          <tr><td>股</td><td>符合条件的股权激励单独按年度税率估算；需核对实际适用条件。</td></tr>
          <tr><td>免</td><td>本年不计现金个税。非现金福利也按此方式展示。</td></tr>
        </tbody></table>
        <dl className="help-formulas"><dt>综合所得应纳税所得额</dt><dd>并入综合所得的名义收入 − 60,000 元 − 个人五险一金 − 全年税前扣除；最低为 0。</dd></dl>
        <ul><li>个人缴费按缴费基数、各项比例和缴纳月数计算；固定医疗费另按月计入。</li><li>自动基数按月基本工资估算并应用上下限，也可手动填写。上限留空表示未设上限。</li><li>城市参数为历史示例。北京采用 2025 年社保及 2025–2026 年度公积金参数；请按实际年度和公司口径调整。</li></ul>
      </section>
      <section id="help-time"><h3>工时与假期</h3>
        <table className="help-table"><thead><tr><th>工时部分</th><th>权重</th></tr></thead><tbody><tr><td>工作日每天不超过 8 小时的部分</td><td>1 倍</td></tr><tr><td>工作日每天超过 8 小时的部分</td><td>1.5 倍</td></tr><tr><td>周末工时</td><td>2 倍</td></tr></tbody></table>
        <dl className="help-formulas"><dt>计划全年工作日</dt><dd>（每周工作日 + 每周周末加班日）× 52</dd><dt>假期折算</dt><dd>带薪年假 + 法定假日 + 带薪病假 × 0.6</dd><dt>全年工作日</dt><dd>计划全年工作日 − 假期折算；须大于 0。</dd><dt>实际／加权全年工时</dt><dd>对应周工时 × 52 × 全年工作日 ÷ 计划全年工作日</dd></dl>
        <p>假期按占用原计划工作日的天数填写，避免重复扣除；调休应计入实际工作安排。病假 0.6 系数沿用参考项目的实际代码。工时权重用于比较，不是加班工资核算；不计通勤。</p>
      </section>
      <section id="help-compare"><h3>等效结果</h3>
        <p>855 指每天 8 小时、每周 5 天，全年按 52 周共 2,080 小时比较。发展前景与个人偏好系数以 1 为中性值；其他系数由你选择。</p>
        <dl className="help-formulas"><dt>等效税后时薪</dt><dd>税后价值 × 发展前景系数 × 个人偏好系数 ÷ 加权全年工时</dd><dt>等效税后年收入</dt><dd>等效税后时薪 × 2,080</dd><dt>等效税前年收入／时薪</dt><dd>使用价值折算税前总包代替税后价值，按相同方式计算。</dd></dl>
        <p>结果按未取整值计算，显示时才取整或换算单位。</p>
      </section>
      <section id="help-fire"><h3>火焰与评级</h3>
        <p>蓝红两框同步燃烧。收入按相乘后的全年结果判断，达到以下门槛依次显示 1／2／3 级火焰：</p>
        <table className="help-table heat-threshold-table"><thead><tr><th>项目</th><th>1 级</th><th>2 级</th><th>3 级</th></tr></thead><tbody>{incomeItems.map(([field, title]) => <tr key={field}><td>{title}</td>{INCOME_HEAT_THRESHOLDS[field].map((value, i) => <td key={i}>{new Intl.NumberFormat('zh-CN', { maximumFractionDigits: 2 }).format(value / 10000)} 万</td>)}</tr>)}</tbody></table>
        <ul><li>工作日周工时 ≤50／40／32 小时依次进入 1／2／3 级；周末按 ≤10／5／2 小时分级，越少越旺。</li><li>有效工作安排中的零周末加班显示旺火；空值、非法输入和零工作日工时不触发。</li><li>火焰只影响展示，不改变计算结果。可在选项中关闭动效。</li></ul>
        <table className="help-table"><thead><tr><th>评级</th><th>等效税后时薪（元）</th></tr></thead><tbody>{[['夯', '≥200'], ['顶级', '≥120，低于 200'], ['人上人', '≥70，低于 120'], ['NPC', '≥35，低于 70'], ['拉完了', '低于 35']].map(([name, range]) => <tr key={name}><td>{name}</td><td>{range}</td></tr>)}</tbody></table>
        <p>评级沿用参考项目的娱乐分档，只反映当前填写的假设。</p>
      </section>
      <section id="help-data"><h3>保存与设置</h3><ul><li>数据只保存在当前浏览器，不上传服务器。新建 Offer 的薪资待填写；首次打开只有一个参考示例，恢复示例会替换当前报价。</li><li>紧凑单位使年度金额显示为万元、月收入输入为千元；实际计算、保存和导出仍使用元。</li><li>背景、CRT 和动效可分别关闭。删除和重置的撤销只在当前会话有效。</li></ul></section>
      <section className="help-sources"><h3>来源</h3><p>收入与税费：<a href="https://sherry-roar.github.io/offer-calculate/" target="_blank" rel="noreferrer">sherry-roar / offer-calculate ↗</a>（MIT）。假期：<a href="https://github.com/zippland/worth-calculator" target="_blank" rel="noreferrer">zippland / worth-calculator ↗</a>（MIT）。数字字体 M6X11：Daniel Linssen。完整声明见 <a href="https://github.com/JustinWCola/offer_joker/blob/main/THIRD_PARTY_NOTICES.md" target="_blank" rel="noreferrer">来源与许可 ↗</a>。</p></section>
    </div>
  </dialog>;
}

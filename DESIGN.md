# Balatro 界面参考与公式映射

## 检索与参考

2026-10-12 通过 GitHub Repository Search 检索 `balatro clone`、`balatro calculator` 和 `balatro web`，查看了以下项目的文档和界面实现：

- [EFHIII/balatro-calculator](https://github.com/EFHIII/balatro-calculator)（MIT）：实际运行并查看其界面；重点参考蓝色 Chips、红色 Mult、乘号、像素字体、灰色 HUD 和按钮的硬质阴影。
- [kleinfreund/balatrolator](https://github.com/kleinfreund/balatrolator)（MIT）：参考计分工具的颜色语义、确定性计算和浏览器保存方式。
- [swen128/balatro](https://github.com/swen128/balatro)：查看 React 游戏实现与玩法结构，未引入其代码或资产。

这些是第三方实现，不能把它们的开源许可理解为 Balatro 原版游戏图片、字体或音效的许可。本项目使用自行绘制的像素图标和背景，以及明确允许分发的 Cubic 11 字体；字体完整许可见 `public/fonts/Cubic11-LICENSE.txt`。

## 界面

用紧凑的职业牌局标题替换大面积营销标题。左侧为灰色游戏 HUD，核心是蓝底 Chips × 红底 Mult 和本手得分；右侧为五张可点击调整参数的系数牌，以及可编辑的 Offer 手牌。橙色按钮代表新增和当前手牌计分，蓝色按钮代表打出其他手牌。

选择 Offer 后同步更新计分器与系数牌；点击「再次计分」或「打出这张牌」依次播放底数、倍率和总分反馈。减少动画偏好会关闭这些效果。狭窄屏幕把计分器放在首屏，并使用单列 Offer 布局。

## 数值语义

```text
Chips（蓝色底数） = 预计税后价值 ÷ 2080
Mult（红色倍率） = 40 ÷ 加权周工时 × 成长系数 × 生活偏好系数
Chips × Mult = 等效税后时薪
```

以上是原有 855 等效公式的分解，没有改变个税、缴费或 Offer 排名方法。显示数值经过格式化，最终结果采用完整精度；分解的乘积与原始结果之间只可能存在浮点运算次序带来的极小误差，测试覆盖不同工时、偏好、零倍率和负价值情况。

时间、成长、生活三张牌组成红色倍率；兑现和税费两张牌已计入蓝色底数。后两张牌的说明明确这一点，避免重复扣除或重复相乘。

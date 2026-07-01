# 地块管理设计 QA

- Source visual truth: `参考要求/棉管家PRD V1.0（面向农民）.docx` 中 M1 地块管理示意图（image4）与 `参考要求/demo.html` 的 `fields`、`field-draw`、`field-info` 状态。
- Implementation screenshot: unavailable.
- Viewport: intended mobile viewport, 375 × 812 CSS px equivalent.
- State: 地块列表、管理模式、绘制边界、信息补充、地块详情、编辑弹层。

## Full-view comparison evidence

源设计已打开并检查；微信开发者工具已检测到全部地块页面文件变更并触发小程序重新编译，日志中未出现这些页面的模板或脚本编译错误。但无法取得模拟器截图，因此不能完成同视口并排比较。

## Focused region comparison evidence

未执行。需要模拟器截图后重点比较顶部棕金信息区、搜索筛选栏、地块卡片、地图绘制工具栏、底部统计操作区和详情数据中心。

## Findings

- [P1] 缺少实现截图，无法完成视觉一致性阻断验收。
  - Location: 微信开发者工具模拟器。
  - Evidence: 开发者工具 CLI 服务端口处于关闭状态；Windows 验收连接同时缺少运行时模块。
  - Impact: 字体、间距、原生地图层级、Skyline 圆角与固定操作栏仍无法基于可见结果确认。
  - Fix: 用户在微信开发者工具的“设置 → 安全设置”中手动开启服务端口后，重新截图并与 source visual truth 并排比较。

## Required fidelity surfaces

- Fonts and typography: 已按现有小程序系统字体、设计稿字号层级实现；待截图确认换行和字重。
- Spacing and layout rhythm: 已按设计稿重建顶部统计、筛选、卡片、地图和底部操作区；待截图确认 Skyline 实际布局。
- Colors and visual tokens: 使用棕金主色、米色背景、橙色关注态和绿色正常态；待截图采样核对。
- Image quality and asset fidelity: 地块缩略图与绘制页使用真实原生地图和多边形，不使用占位图；待模拟器确认地图渲染与裁切。
- Copy and content: 已覆盖搜索、筛选、绘制提示、完整基础信息、聚合入口、空/错/加载状态及删除说明。

## Patches made

- 重建地块列表视觉和搜索、状态/面积筛选、下拉刷新、空错加载状态。
- 增加管理模式、全选和批量删除。
- 完善真实地图打点、自动闭合、撤销、清空、面积和周长计算。
- 补全地块名称、品种、播种日期、灌溉、土壤、种植状态和备注。
- 重建详情页并聚合健康评分、快捷服务、基础信息和最近农事记录。
- 服务端改为按坐标复算面积/周长，增加参数校验、农户权限与批量删除。

## Implementation checklist

- 手动开启微信开发者工具服务端口。
- 捕获列表、绘制和详情三个同视口状态。
- 对照源设计修复所有 P0/P1/P2 视觉差异后更新本报告。

final result: blocked

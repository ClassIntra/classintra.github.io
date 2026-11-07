# 学元体系与账本（第三方接入）

ClassIntra 的虚拟经济（学元）建立在一套复式记账账本内核之上。本文面向想把应用接入学元体系的第三方开发者，讲清楚：资产模型、你能碰什么、怎么保证不重复扣款、限额与错误语义。

> 设计全文与实施记录见主仓 `docs/economy-design.md`（V 章）。

## 1. 三种资产与单位口径

| 资产 | 语义 | 可兑付 | 第三方可触碰 |
|------|------|:------:|:------------:|
| `CASH` | 充值学元（有真金背书） | ✅ 可提现 | ❌ 永远拿不到 |
| `GRANT` | 赠送学元（可支付不可提现） | ❌ | 仅经 `invest()` 通道 |
| `PRACTICE` | 练习金（沙盘封闭货币） | ❌ | ✅ 唯一默认通道 |

单位换算链（唯一真相源 `server/src/ledger/units.js`，任何代码不得自写魔法数字）：

```
1 学元 = 100 账本单位
1 元   = 1000 学元  ⇒  1 元 = 100000 账本单位
```

账本里所有 `*_cent / amount_cent / balance` 字段都是**整数账本单位**（`_cent` 是历史命名的误称）。前端展示学元时除以 100。

## 2. 分层：你能调用哪一层

```
apps/（系统应用）        → 直接调 server/src/ledger/*（全部资产）
market-apps/（第三方）   → 只能调 server/src/ledger/app-api.js
```

`app-api.js` 把第三方能力收窄成「练习金 + 自己域内的结算」：资产名写死、不暴露 asset 参数、每次调用都带 `appId` 并落审计。**第三方永远拿不到 CASH，也不能指定收款方。**

### app-api 接口一览

| 方法 | 用途 |
|------|------|
| `practiceAccount(appId, userId)` | 查练习金账户（可用 / 冻结） |
| `ensureTrader(appId, userId)` | 开户（幂等） |
| `reserve(appId, userId, amountCent, ref, memo)` | 冻结练习金（下单前） |
| `release(appId, userId, amountCent, ref, memo)` | 释放冻结（撤单） |
| `settleBuy(appId, { userId, holdCent, costCent, feeCent, ref, … })` | 买入结算（成本+手续费吃冻结，差额退回） |
| `settleSell(appId, userId, netCent, { ref, … })` | 卖出回款 |
| `issue(appId, userId, amountCent, ref, memo)` | 练习金发放（如证券月度补发，`ref` 幂等） |
| `invest(appId, userId, direction, amountCent, ref)` | **唯一** GRANT ⇄ PRACTICE 通道（本人账户、CASH 不参与） |
| `history(appId, userId, limit, beforeId)` | 域内流水 |

已登记应用白名单在 `app-api.js` 的 `APPS`（当前 `stock`）。**新增第三方应用必须在这里显式登记**，否则调用直接被拒。

## 3. 幂等：ref 是资金安全的根

- 每笔资金交易必须带 `ref`（幂等键）；同一 `ref` 重放返回原交易，**不会重复扣款**。
- HTTP 面（`/api/wallet`、`/api/ledger`）幂等键优先级：`Idempotency-Key` 请求头 > `body.ref` > 自动生成。**自动生成只挡双击，跨请求防重请务必显式传 ref**（建议格式 `app:<业务id>:<序号>`）。
- 练习金补发这类「按月发放」务必用带月份的 ref（如 `stock:practice:<月>`），重复执行天然幂等。

## 4. 限额（当前生效值）

| 项 | 值 | 位置 |
|----|----|------|
| 单笔投资进出 | 5 万学元（¥50） | `ledger/invest.js` |
| 账本单笔溢出保护 | 100 万学元（¥1000） | `ledger/ledger.js` |
| 小额充值 / 提现 | 20 元 / 笔 | `ledger/templates/recharge.js` |
| 班管单次发放 / 每日 | 0.5 元 / 2 元（可配 `maxGrantYuan` / `grantDailyCapYuan`） | `services/xueyuan.js` |
| 转出统一风控 | 支付密码 + 日额度（红包、跨班 pending 都计入） | `services/pay-guard.js` |

第三方发放走 `issue()` 时直接记 `kind='practice'` 账本交易、**不经发放模板配额**——额度与节奏由应用自己控制，所以 ref 幂等和补发上限必须自己设计好（参考证券的月度 ref）。

## 5. 错误语义与对账

- 路由层错误用中文关键词区分 400 / 500（如「不能超过」「必须是正整数」→ 400）。第三方应对非 2xx 做通用降级，不要解析文案。
- 账本内核每次写入做分组守恒断言；日终可用 `svc.invariants.check()` 全量对账（I1–I9），对账不过说明有绕过 `post()` 的写入，属于必须上报的 bug。
- `/api/xy` 的 `transfer / withdraw / recharge` 三个端点已 410 Gone：学生资金动作只保留 `/api/wallet` 一个入口（两套入口 = 两套风控，是真实事故来源）。红包同理只有 `services/yuanbao.js` 一个实现。

## 6. 已知取舍（如实披露）

- 支付密码日额度统计异常时 fail-open 放行但留痕（可用性优先）
- 红包过期退款依赖钱包访问触发懒清理
- 「故意亏光 → 平台补发 → 撤出」的组合套取路径未完全封死（见 `docs/economy-design.md` V.24 已知未决事项）

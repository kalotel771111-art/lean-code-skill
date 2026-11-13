# 15 种常见臃肿

一句判据：**删掉它，没有调用者会坏、没有测试会红 → 它就是候选。**

## 1. 单实现抽象

症状：interface + class + factory，只有一个实现。

```ts
// 肿
interface Notifier { send(m: string): void }
class EmailNotifier implements Notifier { send(m: string) { mail(m) } }
export const notifier = (): Notifier => new EmailNotifier()

// 简
export function notify(m: string) { mail(m) }
```

判据：实现类只有 1 个，也没有测试替身需求。
例外：第二个实现已经存在；公共库确实要扩展点。

## 2. 万能 utils 抽屉

症状：`utils.ts` 里塞格式化、日期、请求、权限、字符串，彼此无关。
判据：改一处要 import 整个抽屉；函数之间没有共同主题。
改法：按领域挪到使用方旁边；只 1 处用的直接内联。抽屉消失。
例外：真正的通用底座（`sleep`、`retry`）留一个小的。

## 3. 只有一个值的配置项

```ts
const config = { retries: 3, timeout: 5000 }   // 全项目没人改过
```

改法：常量放到使用处；真要外部可调时再抽。
例外：不同部署环境确实不同（且已有环境变量机制）。

## 4. 分层双胞胎

```ts
const dto = { ...user }          // UserDTO
const entity = mapToEntity(dto)  // 字段一模一样
```

改法：一个类型到底；只在真实边界（DB / 外部 API）做映射。
例外：外部契约与内部模型确实不同，且会独立演进。

## 5. 防御式 try/catch + 日志 + 重抛

```ts
try { await save(x) }
catch (e) { console.error(e); throw e }   // 没处理，只加噪音
```

改法：删掉，让上层统一处理；能恢复或能补语义时才 catch。
例外：补上下文（`throw new Error("save user", { cause: e })`）或清理资源。

## 6. 每层都校验

```ts
function createUser(input: UserInput) {
  if (!input.email) throw new Error("email required")  // 路由层已校验
  // ...
}
```

改法：边界校验一次，内部信任类型与契约。
例外：公共 API、跨进程边界、不可信输入。

## 7. 过度拆分

```ts
const isAdult = (u: User) => u.age >= 18
const canVote = (u: User) => isAdult(u)
const checkVoter = (u: User) => canVote(u)  // 三层同一个判断
```

判据：不到 5 行、只有 1 个调用者、名字只是换词。
改法：合并；保留有独立语义或测试价值的。
例外：为依赖注入、为 ≥2 个调用者复用。

## 8. 复制粘贴的平行分支

```ts
if (type === "a") return handleA(x)
if (type === "b") return handleB(x)
if (type === "c") return handleC(x)
```

改法：映射表 + 一次调用；分支体差异大时保留 switch。
例外：硬合并后更难读。

## 9. 注释复述 + 巨型 docstring

```py
def add(a, b):
    """Add a and b and return the sum."""
    return a + b
```

改法：删；注释只写 why——坑、单位、兼容原因、非显然算法。
例外：对外 API 的契约说明。

## 10. 死代码 / 兼容层 / 只走一条的开关

症状：feature flag 两个分支只有一个会执行；旧函数已经没人调。
改法：删。git 记得历史。
例外：灰度与回滚确实需要，且有下线日期。

## 11. 类型体操 / 过度泛型

症状：为「通用」叠 5 层泛型约束，实际只实例化一种类型。
改法：先写具体类型；第二次复用出现再泛化。
例外：库作者的公共 API。

## 12. 测试脚手架膨胀

症状：200 行 fixture / mock 测 5 行逻辑；每个依赖都 mock。
改法：测行为，用真实的小对象；只 mock 慢的与外部边界。
例外：集成测试、外部服务契约测试。

## 13. 无意义 async / wrapper

```ts
async function getName() { return this.name }        // 没有 await
const sleep = (ms) => new Promise(r => setTimeout(r, ms))  // 平台已有
```

改法：去掉 async；用平台 API。
例外：接口契约要求返回 Promise。

## 14. 空壳 Manager / Helper + 没人用的钩子

症状：`class UserManagerHelperService {}`；`onBeforeSave` 没有订阅者。
改法：删；需要时再加，加的时候知道谁在用。

## 15. 目录分层过深

症状：3 个接口的应用长出 domain / application / infrastructure 三层，每层一个 10 行文件。
判据：改一个功能要横跨 4 个目录；每层只有一个文件。
改法：先按功能扁平放；真需要隔离时再分层。
例外：模块确实独立演进、团队按层分工。

## 30 秒自查

- 新增了几个文件？每个都能一句话说清职责吗？
- 有没有「只有 1 个实现」的接口？
- 有没有「只有 1 个值」的配置？
- 有没有「只是转发」的函数？
- 删掉哪些行，不会有人发现？

# 资料

按这个顺序读，20 分钟够。

## 原则

1. **Ousterhout, _A Philosophy of Software Design_** — 复杂度 = 依赖 + 晦涩；深模块 = 小接口 + 深实现；错误尽量「消灭」而不是层层处理；把复杂度往下压。
   https://web.stanford.edu/~ouster/cgi-bin/book.php
2. **Sandi Metz, _The Wrong Abstraction_** — 重复比错误抽象便宜；先内联回重复，再重新抽。
   https://sandimetz.com/blog/2016/1/20/the-wrong-abstraction
3. **Fowler, _Yagni_** — 不为假设需求写代码。
   https://martinfowler.com/bliki/Yagni.html
4. **Hunt & Thomas, DRY** — 重复的是知识，不是文本；长得像但规则不同的两段代码不算 DRY 违规。
   （《程序员修炼之道》；摘要可搜 `DRY knowledge duplication`）
5. **Rich Hickey, _Simple Made Easy_** — 简单是「一个概念」，容易是「手边就有」；别把 complecting 当设计。
   https://www.infoq.com/presentations/Simple-Made-Easy/
6. **Rule of Three** — 第三次出现才抽象。
   https://en.wikipedia.org/wiki/Rule_of_three_(computer_programming)
7. **Google eng-practices, review 指南** — 审查先看设计与正确性，风格最后。
   https://google.github.io/eng-practices/
8. **Joel Spolsky, _Things You Should Never Do_** — 别推倒重写；最小改动。
   https://www.joelonsoftware.com/2000/04/06/things-you-should-never-do-part-i/

## 工具

- knip：https://knip.dev/
- jscpd：https://github.com/kucherenko/jscpd
- eslint-plugin-sonarjs：https://github.com/SonarSource/eslint-plugin-sonarjs
- radon：https://radon.readthedocs.io/en/latest/commandline.html
- vulture：https://github.com/jendrikseipp/vulture
- ast-grep：https://ast-grep.github.io/

链接于 2026-11 校验可访问。书只给入口，不搬运原文。

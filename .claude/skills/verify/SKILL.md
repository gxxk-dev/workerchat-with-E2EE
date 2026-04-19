---
name: verify
description: 运行 TypeScript 类型检查和 Prettier 格式检查，在提交或部署前验证代码质量
---

运行以下检查并报告结果：

1. TypeScript 类型检查：`npx tsc --noEmit`
2. Prettier 格式检查：`npx prettier --check .`

如有错误，列出具体问题并建议修复方式。格式问题可运行 `npx prettier --write .` 自动修复。

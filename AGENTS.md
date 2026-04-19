## 构建与部署命令

- 本地开发：`bun run dev`
- 部署：`bun run deploy`
- 生成 TS 类型：`bun run cf-typegen`
- 构建 CSS：`bun run build:css`
- 构建 vendor：`bun run build:vendor`

## 代码风格

Prettier：Tab 缩进、单引号、分号、行宽 140。

## 分支与提交

- 小改动直接在 main 上开发；较大功能使用 `feature/xxx` 分支
- 提交信息使用 Conventional Commits 格式

## 注意事项

- 修改 wrangler.jsonc 的 Durable Object 绑定后，需运行 `bun run cf-typegen` 并更新迁移标签
- 第三方库变更后需手动运行 `bun run build:vendor` 同步到 `public/vendor/`

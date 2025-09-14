This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## 智考公考伴侣 - 前端项目

本项目是智考公考伴侣的前端部分，基于 Next.js 15 + React 19 + TypeScript 构建。

## 快速启动

### 推荐方式：使用全栈启动脚本

在项目根目录使用以下脚本一键启动前后端：

```powershell
# 推荐：动态端口分配（自动处理端口占用）
.\dev-fullstack.ps1

# 固定端口开发（稀有端口，避免冲突）
D:\some\run-dev-rare-ports.ps1
```

### 单独启动前端（仅开发调试用）

如果需要单独启动前端进行调试，可以使用：

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

**注意**：单独启动前端时，需要确保后端服务已经在运行，否则前端将无法正常工作。

打开 [http://localhost:3000](http://localhost:3000) 查看结果。

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

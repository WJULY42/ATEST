import { defineConfig } from 'vite';

// GitHub Pages 项目页部署在 https://<user>.github.io/<repo>/ 子路径下，
// 构建产物的资源引用必须带上该 base 前缀，否则会 404。
// 仓库名与 Pages 环境由 Vite 自动推导：
//   - 本地 npm run dev / build：base = '/'
//   - GitHub Actions 的 pages workflow（带 GITHUB_REPOSITORY + RUNNER_TEMP）：
//     base 自动变为 '/<repo>/'，无需手动配置
export default defineConfig(({ mode }) => {
  const repo = process.env.GITHUB_REPOSITORY?.split('/')[1];
  const isPages = mode === 'production' && !!process.env.RUNNER_TEMP && !!repo;
  return {
    base: isPages ? `/${repo}/` : '/',
    build: { outDir: 'dist' },
  };
});

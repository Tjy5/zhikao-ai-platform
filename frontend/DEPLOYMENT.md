# 部署指南

本文档描述如何将成公前端应用部署到生产环境。

## 部署前检查清单

### 1. 环境配置

- [ ] 确认后端API地址（生产环境）
- [ ] 确认后端CORS配置包含前端域名
- [ ] 准备好环境变量配置

### 2. 代码质量检查

```bash
# 运行类型检查
npm run build

# 运行代码检查
npm run lint
```

确保没有错误后再部署。

### 3. 本地测试生产构建

```bash
# 构建生产版本
npm run build

# 预览生产构建
npm run preview
```

在 `http://localhost:4173` 测试：
- [ ] 所有页面正常加载
- [ ] 登录/注册流程正常
- [ ] AI配置保存正常
- [ ] 写作批改流程正常
- [ ] 历史记录查看正常
- [ ] 控制台无错误
- [ ] 网络请求正常（检查开发者工具）

## 部署步骤

### 方式一：静态托管服务（推荐）

适用于：Vercel, Netlify, CloudFlare Pages, GitHub Pages等

#### Vercel

1. 安装Vercel CLI（可选）：
```bash
npm install -g vercel
```

2. 在项目根目录（`frontend/`）运行：
```bash
vercel
```

3. 设置环境变量（Vercel Dashboard）：
   - `VITE_API_URL` = 生产环境后端地址（如 `https://api.example.com`）

4. 部署：
```bash
vercel --prod
```

**Vercel配置文件** (`vercel.json`):
```json
{
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "framework": "vite",
  "rewrites": [
    { "source": "/(.*)", "destination": "/index.html" }
  ]
}
```

#### Netlify

1. 在 `frontend/` 创建 `netlify.toml`：
```toml
[build]
  command = "npm run build"
  publish = "dist"

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
```

2. 在Netlify Dashboard设置环境变量：
   - `VITE_API_URL` = 生产环境后端地址

3. 连接Git仓库自动部署，或使用Netlify CLI：
```bash
npm install -g netlify-cli
netlify deploy --prod
```

### 方式二：Docker部署

1. 创建 `Dockerfile`（在 `frontend/` 目录）：

```dockerfile
# Build stage
FROM node:18-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL

RUN npm run build

# Production stage
FROM nginx:alpine

COPY --from=builder /app/dist /usr/share/nginx/html

# Copy custom nginx config
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
```

2. 创建 `nginx.conf`：

```nginx
server {
    listen 80;
    server_name _;

    root /usr/share/nginx/html;
    index index.html;

    # Gzip compression
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;

    # Cache static assets
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # SPA fallback
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
}
```

3. 构建Docker镜像：

```bash
docker build \
  --build-arg VITE_API_URL=https://api.example.com \
  -t zhikao-frontend:latest \
  .
```

4. 运行容器：

```bash
docker run -d \
  --name zhikao-frontend \
  -p 80:80 \
  zhikao-frontend:latest
```

### 方式三：传统服务器部署

1. 在本地构建：

```bash
# 设置环境变量
export VITE_API_URL=https://api.example.com

# 构建
npm run build
```

2. 将 `dist/` 目录上传到服务器：

```bash
# 使用rsync
rsync -avz --delete dist/ user@server:/var/www/zhikao-frontend/

# 或使用scp
scp -r dist/* user@server:/var/www/zhikao-frontend/
```

3. 配置Nginx（参考上面的 `nginx.conf`）

4. 重启Nginx：

```bash
sudo systemctl reload nginx
```

## 环境变量配置

### 必需的环境变量

| 变量名 | 说明 | 示例 |
|--------|------|------|
| `VITE_API_URL` | 后端API地址 | `https://api.example.com` |

### 设置方式

**本地开发**：创建 `.env` 文件
```bash
VITE_API_URL=http://localhost:8001
```

**生产环境**：
- Vercel/Netlify：在Dashboard设置
- Docker：使用 `--build-arg`
- 传统服务器：在构建时设置环境变量

⚠️ **重要**：Vite的环境变量在构建时被内联到代码中，修改环境变量后必须重新构建。

## 后端CORS配置

确保后端允许前端域名跨域请求。

### Spring Boot示例

```java
@Configuration
public class CorsConfig implements WebMvcConfigurer {
    @Override
    public void addCorsMappings(CorsRegistry registry) {
        registry.addMapping("/api/**")
                .allowedOrigins(
                    "http://localhost:5173",     // 开发环境
                    "http://localhost:5174",     // 备用端口
                    "https://yourdomain.com"     // 生产环境
                )
                .allowedMethods("GET", "POST", "PUT", "DELETE", "OPTIONS")
                .allowedHeaders("*")
                .allowCredentials(true);
    }
}
```

## 性能优化建议

### 1. CDN配置

将 `dist/assets/` 下的静态资源上传到CDN，修改 `vite.config.ts`：

```typescript
export default defineConfig({
  base: 'https://cdn.example.com/',
  build: {
    assetsDir: 'static',
  },
});
```

### 2. 启用Gzip/Brotli压缩

**Nginx配置**：
```nginx
gzip on;
gzip_comp_level 6;
gzip_types text/plain text/css application/json application/javascript text/xml application/xml;

# 如果有brotli模块
brotli on;
brotli_comp_level 6;
brotli_types text/plain text/css application/json application/javascript text/xml application/xml;
```

### 3. 设置缓存策略

- HTML文件：`no-cache`（始终验证）
- JS/CSS文件：长期缓存（文件名带hash）
- 图片/字体：长期缓存

Nginx示例：
```nginx
location /index.html {
    add_header Cache-Control "no-cache";
}

location ~* \.(js|css)$ {
    expires 1y;
    add_header Cache-Control "public, immutable";
}
```

### 4. HTTP/2 支持

启用HTTP/2可显著提升性能。Nginx配置：
```nginx
listen 443 ssl http2;
```

## 监控与日志

### 1. 错误监控

建议接入错误监控服务（如Sentry）：

```bash
npm install @sentry/react
```

在 `main.tsx` 中初始化：
```typescript
import * as Sentry from "@sentry/react";

Sentry.init({
  dsn: "YOUR_SENTRY_DSN",
  environment: import.meta.env.MODE,
  integrations: [Sentry.browserTracingIntegration()],
  tracesSampleRate: 1.0,
});
```

### 2. 访问日志

Nginx访问日志默认位置：`/var/log/nginx/access.log`

### 3. 性能监控

使用浏览器开发者工具的Lighthouse或Web Vitals监控：
- LCP (Largest Contentful Paint)
- FID (First Input Delay)
- CLS (Cumulative Layout Shift)

## 故障排查

### 问题：页面刷新后404

**原因**：服务器未配置SPA fallback

**解决**：配置服务器将所有路由请求重定向到 `index.html`（参考上面的Nginx配置）

### 问题：CORS错误

**原因**：后端未允许前端域名

**解决**：检查后端CORS配置，确保包含前端域名

### 问题：API请求失败

**原因**：`VITE_API_URL` 配置错误或后端不可达

**解决**：
1. 检查环境变量是否正确设置
2. 检查后端服务是否正常运行
3. 检查网络连接（防火墙、DNS等）

### 问题：白屏

**原因**：JavaScript加载失败或运行时错误

**解决**：
1. 打开浏览器控制台查看错误
2. 检查 `base` 配置是否正确（`vite.config.ts`）
3. 检查资源是否正确加载（Network标签）

## 回滚策略

### Vercel/Netlify

直接在Dashboard选择之前的部署版本回滚。

### Docker

保留之前的镜像版本：
```bash
# 标记当前版本
docker tag zhikao-frontend:latest zhikao-frontend:v1.0.0

# 回滚
docker stop zhikao-frontend
docker rm zhikao-frontend
docker run -d --name zhikao-frontend -p 80:80 zhikao-frontend:v0.9.0
```

### 传统服务器

保留之前的 `dist/` 目录副本：
```bash
# 部署前备份
cp -r /var/www/zhikao-frontend /var/www/zhikao-frontend.backup

# 回滚
rm -rf /var/www/zhikao-frontend
mv /var/www/zhikao-frontend.backup /var/www/zhikao-frontend
sudo systemctl reload nginx
```

## 安全建议

1. **HTTPS**: 始终使用HTTPS（Let's Encrypt免费证书）
2. **安全头**: 配置CSP、X-Frame-Options等（参考上面的Nginx配置）
3. **依赖更新**: 定期运行 `npm audit` 检查安全漏洞
4. **环境变量**: 不在代码中硬编码敏感信息
5. **访问控制**: 如需限制访问，在Nginx层配置IP白名单

## 更新部署

### 零停机部署

**使用Nginx**：
1. 在备用目录构建新版本
2. 测试新版本
3. 原子性切换软链接
4. 重载Nginx

```bash
# 构建到新目录
npm run build
rsync -avz dist/ /var/www/zhikao-frontend-new/

# 测试新版本
curl http://localhost/index.html

# 切换（原子操作）
ln -sfn /var/www/zhikao-frontend-new /var/www/zhikao-frontend

# 重载Nginx
sudo systemctl reload nginx
```

**使用Docker**：
1. 构建新镜像（不同标签）
2. 启动新容器
3. 健康检查通过后切换流量
4. 停止旧容器

```bash
# 构建新版本
docker build -t zhikao-frontend:v1.1.0 .

# 启动新容器（不同端口）
docker run -d --name zhikao-frontend-new -p 8080:80 zhikao-frontend:v1.1.0

# 健康检查
curl http://localhost:8080

# 更新负载均衡器或Nginx upstream配置

# 停止旧容器
docker stop zhikao-frontend
docker rm zhikao-frontend
```

## 联系与支持

如遇到部署问题，请联系开发团队。

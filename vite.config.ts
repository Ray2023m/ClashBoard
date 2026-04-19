import vue from '@vitejs/plugin-vue'
import vueJsx from '@vitejs/plugin-vue-jsx'
import { execSync } from 'child_process'
import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'
import { version } from './package.json'

const devProxyPort = Number.parseInt(
  process.env.ZASHBOARD_DEV_PROXY_PORT || process.env.PORT || '2048',
  10,
)
const resolvedDevProxyPort = Number.isFinite(devProxyPort) ? devProxyPort : 2048

const getAppVersionFromTag = (): string => {
  try {
    // 优先使用当前提交对应的 tag（如 v1.0.3 / 1.0.3）
    const tag = execSync('git describe --tags --exact-match', { encoding: 'utf8' }).trim()
    return tag.replace(/^v/i, '') || version
  } catch {
    try {
      // 非 tag 提交时，退化到最近 tag，便于开发阶段保持可追踪版本
      const latestTag = execSync('git describe --tags --abbrev=0', { encoding: 'utf8' }).trim()
      return latestTag.replace(/^v/i, '') || version
    } catch {
      // 最终兜底 package.json
      return version
    }
  }
}

const getGitCommitId = (): string => {
  try {
    const commitMessage = execSync('git log -1 --pretty=%B', { encoding: 'utf8' }).trim()

    if (commitMessage.includes('chore(main): release')) {
      return ''
    }

    return execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim()
  } catch (error) {
    console.warn('无法获取git commit ID:', error)
    return ''
  }
}

// https://vite.dev/config/
export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(getAppVersionFromTag()),
    __COMMIT_ID__: JSON.stringify(getGitCommitId()),
  },
  base: './',
  server: {
    proxy: {
      '/api': {
        target: `http://127.0.0.1:${resolvedDevProxyPort}`,
        changeOrigin: true,
      },
    },
  },
  plugins: [
    vue(),
    vueJsx(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'favicon-dark.svg'],
      manifest: {
        name: 'Dashboard',
        short_name: 'Dashboard',
        description: 'Dashboard - a dashboard for Clash API, Mihomo and sing-box',
        theme_color: '#000000',
        icons: [
          {
            src: './pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: './pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: './pwa-maskable-192x192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'maskable',
          },
          {
            src: './pwa-maskable-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
})

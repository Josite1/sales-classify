import type { Metadata } from 'next';
import { Inspector } from 'react-dev-inspector';
import { SupabaseConfigProvider } from '@/lib/supabase-config-inject';
import './globals.css';

export const metadata: Metadata = {
  title: 'SalesBoard — 售后数据分析看板',
  description: '智能售后数据分类、趋势分析与可视化看板。支持 Excel/JSON 导入、多维度分析、云端同步与分享。',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const isDev = process.env.COZE_PROJECT_ENV === 'DEV';

  return (
    // suppressHydrationWarning: 浏览器扩展（如沉浸式翻译）会往 <html> 注入
    // data-immersive-translate-page-theme 等属性，导致水合比对失败。仅作用于本元素自身。
    <html lang="zh-CN" suppressHydrationWarning>
      <body className="antialiased dot-grid-bg">
        <SupabaseConfigProvider>
          {isDev && <Inspector />}
          {children}
        </SupabaseConfigProvider>
      </body>
    </html>
  );
}

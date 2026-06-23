'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { getSupabaseBrowserClientWithRetry } from '@/lib/supabase-browser';
import { useSupabaseConfig } from '@/lib/supabase-config-inject';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Eye, EyeOff, Mail, Lock, ArrowLeft } from 'lucide-react';
import { BarChart3 } from 'lucide-react';

const APP_ICON = 'https://cdn.phototourl.com/free/2026-06-23-9d04aae5-38ec-4531-8e2d-5fd3883e2c89.gif';
const APP_NAME = '售后数据看板';

type PageMode = 'login' | 'register';

export default function LoginPage() {
  const router = useRouter();
  const { isLoading: configLoading, error: configError } = useSupabaseConfig();

  const [mode, setMode] = useState<PageMode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async () => {
    setError(null);
    if (!email.trim() || !password) {
      setError('请输入邮箱和密码');
      return;
    }

    setLoading(true);
    try {
      const supabase = await getSupabaseBrowserClientWithRetry();
      const { data, error: loginError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (loginError) {
        if (loginError.message.includes('Invalid login credentials')) {
          setError('邮箱或密码错误');
        } else {
          setError(loginError.message);
        }
        return;
      }

      if (data.session) {
        router.replace('/');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '登录失败');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async () => {
    setError(null);
    if (!email.trim() || !password || !confirmPassword) {
      setError('请填写所有字段');
      return;
    }
    if (password.length < 6) {
      setError('密码至少6位');
      return;
    }
    if (password !== confirmPassword) {
      setError('两次密码不一致');
      return;
    }

    setLoading(true);
    try {
      const supabase = await getSupabaseBrowserClientWithRetry();
      const { data, error: signUpError } = await supabase.auth.signUp({
        email: email.trim(),
        password,
      });

      if (signUpError) {
        if (signUpError.message.includes('already registered')) {
          setError('该邮箱已注册');
        } else {
          setError(signUpError.message);
        }
        return;
      }

      // mailer_auto_confirm is true, so registration auto-confirms and logs in
      if (data.session) {
        router.replace('/');
      } else {
        setMode('login');
        setError('注册成功，请登录');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '注册失败');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === 'login') {
      handleLogin();
    } else {
      handleRegister();
    }
  };

  if (configLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-muted-foreground text-sm">加载中...</div>
      </div>
    );
  }

  if (configError) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <p className="text-destructive text-sm mb-2">配置加载失败</p>
          <p className="text-muted-foreground text-xs">{configError}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4 dot-grid-bg">
      <div className="w-full max-w-sm">
        <Card className="border-border shadow-lg">
          <CardHeader className="text-center pb-2 pt-8">
            <div className="flex justify-center mb-3">
              <div className="relative w-16 h-16 rounded-2xl overflow-hidden shadow-md">
                <Image
                  src={APP_ICON}
                  alt={APP_NAME}
                  fill
                  sizes="64px"
                  className="object-cover"
                  priority
                />
              </div>
            </div>
            <h1 className="text-lg font-bold tracking-wide uppercase">{APP_NAME}</h1>
            <p className="text-xs text-muted-foreground mt-1">产品售后数量统计与周趋势分析</p>
          </CardHeader>

          <CardContent className="pt-4 pb-8 px-6">
            <form onSubmit={handleSubmit} className="space-y-4" autoComplete="off">
          <div className="space-y-2">
  <Label htmlFor="email" className="text-xs font-medium">
    邮箱
  </Label>
  <div className="relative">
    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
    <Input
      id="email"
      type="email"
      placeholder="your@email.com"
      value={email}
      onChange={(e) => setEmail(e.target.value)}
      className="!pl-10 h-10"  // 从 pl-9 改为 pl-10
      autoComplete="email"
    />
  </div>
</div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-xs font-medium">
                  密码
                </Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="输入密码"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="!pl-10 pr-10 h-10"
                    autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {mode === 'register' && (
                <div className="space-y-2">
                  <Label htmlFor="confirmPassword" className="text-xs font-medium">
                    确认密码
                  </Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="confirmPassword"
                      type={showConfirmPassword ? 'text' : 'password'}
                      placeholder="再次输入密码"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="!pl-10 pr-10 h-10"
                      autoComplete="new-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
              )}

              {error && (
                <div className="text-xs text-destructive bg-destructive/10 px-3 py-2 rounded-md">
                  {error}
                </div>
              )}

              <Button type="submit" className="w-full h-10" disabled={loading}>
                {loading ? '请稍候...' : mode === 'login' ? '登录' : '注册'}
              </Button>
            </form>

            <div className="mt-4 text-center text-xs text-muted-foreground">
              {mode === 'login' ? (
                <p>
                  还没有账号？{' '}
                  <button
                    type="button"
                    onClick={() => { setMode('register'); setError(null); }}
                    className="text-primary hover:underline font-medium"
                  >
                    去注册
                  </button>
                </p>
              ) : (
                <p>
                  已有账号？{' '}
                  <button
                    type="button"
                    onClick={() => { setMode('login'); setError(null); }}
                    className="text-primary hover:underline font-medium"
                  >
                    去登录
                  </button>
                </p>
              )}
            </div>

            <div className="mt-4 pt-4 border-t border-border">
              <button
                type="button"
                onClick={() => router.push('/')}
                className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors w-full"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                返回首页
              </button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

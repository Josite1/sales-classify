'use client';

import { useState, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Share2, Copy, Check, Lock, Trash2, Link2, Loader2, Eye, EyeOff, RefreshCw, Repeat } from 'lucide-react';
import { getAccessToken } from '@/lib/auth';
import type { AllRecords, ProductAliases } from '@/lib/types';

interface ShareRecord {
  id: string;
  share_code: string;
  title: string;
  created_at: string;
}

interface ShareDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  records: AllRecords;
  aliases: ProductAliases;
}

export function ShareDialog({ open, onOpenChange, records, aliases }: ShareDialogProps) {
  const [title, setTitle] = useState('');
  const [password, setPassword] = useState('');
  const [creating, setCreating] = useState(false);
  const [createdShare, setCreatedShare] = useState<ShareRecord | null>(null);
  const [copied, setCopied] = useState(false);
  const [shares, setShares] = useState<ShareRecord[]>([]);
  const [loadingShares, setLoadingShares] = useState(false);
  const [activeTab, setActiveTab] = useState<'create' | 'list'>('create');
  const [showCreatedPassword, setShowCreatedPassword] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [regeneratingId, setRegeneratingId] = useState<string | null>(null);

  const loadShares = useCallback(async () => {
    const token = await getAccessToken();
    if (!token) return;
    setLoadingShares(true);
    try {
      const res = await fetch('/api/share', {
        headers: { 'x-session': token },
      });
      const data = await res.json();
      if (data.shares) {
        setShares(data.shares);
      }
    } catch {
      // ignore
    } finally {
      setLoadingShares(false);
    }
  }, []);

  const handleOpenChange = (newOpen: boolean) => {
    if (newOpen) {
      setCreatedShare(null);
      setTitle('');
      setPassword('');
      setCopied(false);
      setShowCreatedPassword(false);
      setActiveTab('create');
      loadShares();
    }
    onOpenChange(newOpen);
  };

  const handleCreate = async () => {
    if (!title.trim() || !password) return;
    setCreating(true);
    try {
      const token = await getAccessToken();
      if (!token) return;

      const res = await fetch('/api/share', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-session': token,
        },
        body: JSON.stringify({
          title: title.trim(),
          data: records,
          aliases,
          password,
        }),
      });

      const result = await res.json();
      if (result.success) {
        setCreatedShare(result.record);
        loadShares();
      } else {
        alert(result.error || '分享失败');
      }
    } catch {
      alert('分享创建失败');
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id: string) => {
    const token = await getAccessToken();
    if (!token) return;
    try {
      await fetch(`/api/share?id=${id}`, {
        method: 'DELETE',
        headers: { 'x-session': token },
      });
      setShares((prev) => prev.filter((s) => s.id !== id));
    } catch {
      // ignore
    }
  };

  const handleUpdate = async (id: string) => {
    const token = await getAccessToken();
    if (!token) return;
    setUpdatingId(id);
    try {
      const res = await fetch('/api/share', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-session': token,
        },
        body: JSON.stringify({ id, data: records, aliases }),
      });
      const result = await res.json();
      if (!result.success) {
        alert(result.error || '更新失败');
      }
    } catch {
      alert('更新分享数据失败');
    } finally {
      setUpdatingId(null);
    }
  };

  const handleRegenerate = async (id: string) => {
    const token = await getAccessToken();
    if (!token) return;
    setRegeneratingId(id);
    try {
      const res = await fetch('/api/share', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-session': token,
        },
        body: JSON.stringify({ id }),
      });
      const result = await res.json();
      if (result.success) {
        // Update the share_code in the local list
        setShares((prev) =>
          prev.map((s) =>
            s.id === id ? { ...s, share_code: result.record.share_code } : s
          )
        );
      } else {
        alert(result.error || '重新生成失败');
      }
    } catch {
      alert('重新生成分享链接失败');
    } finally {
      setRegeneratingId(null);
    }
  };

  const handleCopy = (shareCode: string) => {
    const domain = process.env.NEXT_PUBLIC_COZE_PROJECT_DOMAIN_DEFAULT || window.location.host;
    const url = `${window.location.protocol}//${domain}/share/${shareCode}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getShareUrl = (shareCode: string) => {
    const domain = process.env.NEXT_PUBLIC_COZE_PROJECT_DOMAIN_DEFAULT || window.location.host;
    return `${window.location.protocol}//${domain}/share/${shareCode}`;
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Share2 className="h-5 w-5 text-primary" />
            分享数据
          </DialogTitle>
          <DialogDescription>
            将你的本地数据分享给其他人，对方需要输入密码才能查看
          </DialogDescription>
        </DialogHeader>

        {!createdShare ? (
          <>
            {/* Tab 切换 */}
            <div className="flex border-b border-border">
              <button
                type="button"
                onClick={() => setActiveTab('create')}
                className={`flex-1 py-2 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === 'create'
                    ? 'border-primary text-primary'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                创建分享
              </button>
              <button
                type="button"
                onClick={() => { setActiveTab('list'); loadShares(); }}
                className={`flex-1 py-2 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === 'list'
                    ? 'border-primary text-primary'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                我的分享
              </button>
            </div>

            {activeTab === 'create' ? (
              <div className="space-y-4 py-2">
                <div className="space-y-2">
                  <Label className="text-xs">分享标题</Label>
                  <Input
                    placeholder="例如：5月售后数据"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="h-9"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-xs">访问密码</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      type="password"
                      placeholder="至少4位密码"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="pl-9 h-9"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">对方需要输入此密码才能查看数据</p>
                </div>

                <div className="bg-muted/50 rounded-lg p-3">
                  <p className="text-xs text-muted-foreground">
                    将分享当前所有 <span className="font-bold text-foreground">{Object.keys(records).length}</span> 条日期记录和产品别名数据
                  </p>
                </div>

                <Button
                  onClick={handleCreate}
                  disabled={!title.trim() || password.length < 4 || creating}
                  className="w-full"
                >
                  {creating ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                      创建中...
                    </>
                  ) : (
                    <>
                      <Share2 className="h-4 w-4 mr-1.5" />
                      创建分享链接
                    </>
                  )}
                </Button>
              </div>
            ) : (
              <div className="py-2 space-y-2 max-h-60 overflow-y-auto">
                {loadingShares ? (
                  <div className="text-center py-4 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin mx-auto mb-2" />
                    加载中...
                  </div>
                ) : shares.length === 0 ? (
                  <div className="text-center py-6 text-sm text-muted-foreground">
                    暂无分享记录
                  </div>
                ) : (
                  shares.map((share) => (
                    <div
                      key={share.id}
                      className="flex items-center justify-between p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{share.title}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {new Date(share.created_at).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="flex items-center gap-1.5 ml-2">
                        <button
                          type="button"
                          onClick={() => handleCopy(share.share_code)}
                          className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                          title="复制链接"
                        >
                          <Copy className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRegenerate(share.id)}
                          disabled={regeneratingId === share.id}
                          className="p-1.5 rounded-md hover:bg-blue-500/10 text-muted-foreground hover:text-blue-500 transition-colors disabled:opacity-50"
                          title="重新生成分享链接"
                        >
                          {regeneratingId === share.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Repeat className="h-3.5 w-3.5" />
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleUpdate(share.id)}
                          disabled={updatingId === share.id}
                          className="p-1.5 rounded-md hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors disabled:opacity-50"
                          title="更新为当前数据"
                        >
                          {updatingId === share.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <RefreshCw className="h-3.5 w-3.5" />
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(share.id)}
                          className="p-1.5 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                          title="删除"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </>
        ) : (
          <div className="space-y-4 py-2">
            <div className="bg-primary/10 border border-primary/20 rounded-lg p-4 text-center">
              <Check className="h-8 w-8 text-primary mx-auto mb-2" />
              <p className="text-sm font-medium mb-1">分享创建成功</p>
              <p className="text-xs text-muted-foreground">
                将以下链接和密码发送给对方
              </p>
            </div>

            <div className="space-y-2">
              <Label className="text-xs">分享链接</Label>
              <div className="flex gap-2">
                <Input
                  readOnly
                  value={getShareUrl(createdShare.share_code)}
                  className="h-9 text-xs"
                />
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleCopy(createdShare.share_code)}
                  className="shrink-0"
                >
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-xs">访问密码</Label>
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="font-mono text-sm px-3 py-1">
                  {showCreatedPassword ? password : '•'.repeat(password.length)}
                </Badge>
                <button
                  type="button"
                  onClick={() => setShowCreatedPassword(!showCreatedPassword)}
                  className="p-1 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                  title={showCreatedPassword ? '隐藏密码' : '显示密码'}
                >
                  {showCreatedPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                </button>
              </div>
            </div>

            <div className="bg-muted/50 rounded-lg p-3">
              <p className="text-xs text-muted-foreground">
                <strong>注意：</strong>请妥善保管密码，点击眼睛图标可查看密码，分享链接 + 密码即可查看数据
              </p>
            </div>

            <Button
              onClick={() => onOpenChange(false)}
              className="w-full"
              variant="outline"
            >
              完成
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

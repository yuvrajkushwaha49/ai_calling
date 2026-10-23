'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Building, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ErrorMessage } from '@/components/common/error-message';
import { useLogin } from '@/hooks/use-api';
import { useAuthStore } from '@/stores/auth-store';
import { loginSchema, type LoginFormData } from '@/lib/validations';
import { ApiError } from '@/lib/api';

export default function LoginPage() {
  const router = useRouter();
  const { isAuthenticated } = useAuthStore();
  const login = useLogin();
  // Avoid hydration mismatch from password-manager extensions injecting attrs like fdprocessedid
  const [ready, setReady] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: 'admin@realestatecrm.com', password: 'password123' },
  });

  useEffect(() => {
    setReady(true);
  }, []);

  useEffect(() => {
    if (isAuthenticated) router.push('/dashboard');
  }, [isAuthenticated, router]);

  const onSubmit = async (data: LoginFormData) => {
    try {
      await login.mutateAsync(data);
      router.push('/dashboard');
    } catch {
      // error handled below
    }
  };

  return (
    <div className="flex min-h-screen">
      <div className="relative hidden w-1/2 overflow-hidden bg-[hsl(200_28%_10%)] lg:flex lg:flex-col lg:justify-between lg:p-12">
        <div
          className="pointer-events-none absolute inset-0 opacity-90"
          style={{
            backgroundImage:
              'radial-gradient(ellipse 70% 55% at 20% 20%, hsl(173 55% 32% / 0.45), transparent 60%), radial-gradient(ellipse 50% 40% at 90% 80%, hsl(168 40% 40% / 0.25), transparent 55%)',
          }}
        />
        <div className="relative z-10 flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Building className="h-7 w-7" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-white">RealEstate</h1>
            <p className="text-xs font-medium uppercase tracking-[0.12em] text-white/60">
              AI Calling CRM
            </p>
          </div>
        </div>
        <div className="relative z-10 max-w-lg">
          <h2 className="text-4xl font-semibold leading-tight tracking-tight text-white">
            Close more deals with AI-powered calling
          </h2>
          <p className="mt-4 text-base leading-relaxed text-white/70">
            Automate lead qualification, schedule site visits, and track every conversation
            in one powerful CRM.
          </p>
        </div>
        <p className="relative z-10 text-sm text-white/45">© 2026 RealEstate AI Calling CRM</p>
      </div>

      <div className="app-atmosphere flex flex-1 items-center justify-center p-6">
        <Card className="w-full max-w-md border-border/80 shadow-none">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-primary text-primary-foreground lg:hidden">
              <Building className="h-6 w-6" />
            </div>
            <CardTitle className="text-2xl tracking-tight">Welcome back</CardTitle>
            <CardDescription>Sign in to your account to continue</CardDescription>
          </CardHeader>
          <CardContent>
            {!ready ? (
              <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">
                Loading…
              </div>
            ) : (
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                {login.isError && (
                  <ErrorMessage
                    message={
                      login.error instanceof ApiError
                        ? login.error.message
                        : 'Invalid email or password'
                    }
                  />
                )}
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="you@company.com"
                    autoComplete="username"
                    data-1p-ignore
                    data-lpignore="true"
                    {...register('email')}
                  />
                  {errors.email && (
                    <p className="text-sm text-destructive">{errors.email.message}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="password">Password</Label>
                    <Link href="/forgot-password" className="text-sm text-primary hover:underline">
                      Forgot password?
                    </Link>
                  </div>
                  <Input
                    id="password"
                    type="password"
                    placeholder="••••••••"
                    autoComplete="current-password"
                    data-1p-ignore
                    data-lpignore="true"
                    {...register('password')}
                  />
                  {errors.password && (
                    <p className="text-sm text-destructive">{errors.password.message}</p>
                  )}
                </div>
                <Button
                  type="submit"
                  className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
                  disabled={login.isPending}
                >
                  {login.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Sign In
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

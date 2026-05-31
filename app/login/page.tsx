'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getSupabaseClient } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { ShieldCheck, Eye, EyeOff, Loader2, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default function LoginPage() {
  const router = useRouter();
  const supabase = getSupabaseClient();
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Check if user is already logged in
  useEffect(() => {
    async function checkUser() {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        router.push('/admin');
      }
    }
    checkUser();
  }, [router, supabase]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast.error('Preencha todos os campos!');
      return;
    }

    setIsLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        toast.error(`Falha no login: ${error.message}`);
      } else {
        // Verificar autorização do perfil nas configurações
        try {
          const { data: adminUsersSetting } = await supabase
            .from('settings')
            .select('*')
            .eq('key', 'admin_users')
            .single();

          const usersList = adminUsersSetting?.value || [];
          const profile = usersList.find((u: any) => u.email.toLowerCase() === email.toLowerCase());

          if (usersList.length > 0 && !profile) {
            await supabase.auth.signOut();
            toast.error('Acesso negado. Seu perfil de administrador não está cadastrado.');
            setIsLoading(false);
            return;
          }
        } catch (checkErr) {
          console.error('Erro ao validar permissões do perfil:', checkErr);
        }

        // Registrar log de auditoria de login
        try {
          await supabase.from('action_logs').insert({
            user_email: email,
            action: 'Login no Painel',
            details: `Usuário realizou login com sucesso no painel administrativo.`
          });
        } catch (logErr) {
          console.error('Erro ao gravar log de login:', logErr);
        }

        toast.success('Login realizado com sucesso! Redirecionando...');
        router.push('/admin');
      }
    } catch (err: any) {
      toast.error('Ocorreu um erro inesperado.');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center bg-black overflow-hidden font-sans">
      {/* Background decoration */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-indigo-900/20 via-zinc-950/50 to-black z-0 pointer-events-none" />
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-500/5 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-red-500/5 rounded-full blur-[120px] pointer-events-none" />

      <div className="relative z-10 w-full max-w-md p-4">
        {/* Back Link */}
        <Link 
          href="/" 
          className="inline-flex items-center gap-2 text-zinc-400 hover:text-white mb-6 text-sm transition-all hover:translate-x-[-4px]"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar para o site público
        </Link>

        <Card className="border-zinc-800 bg-zinc-950/80 backdrop-blur-md shadow-2xl shadow-zinc-950/50">
          <CardHeader className="space-y-1 text-center">
            <div className="mx-auto bg-gradient-to-tr from-indigo-500 to-red-500 p-2.5 rounded-2xl w-fit mb-3 shadow-lg shadow-indigo-500/10">
              <ShieldCheck className="h-6 w-6 text-white" />
            </div>
            <CardTitle className="text-2xl font-bold tracking-tight text-white">
              Painel Administrativo
            </CardTitle>
            <CardDescription className="text-zinc-400">
              Entre com suas credenciais do Supabase Auth para gerenciar os relatos.
            </CardDescription>
          </CardHeader>
          
          <form onSubmit={handleLogin}>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-zinc-300">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="ex: admin@empresa.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="bg-zinc-900 border-zinc-800 text-white placeholder-zinc-500 focus:border-indigo-500 focus:ring-indigo-500 transition-colors"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password" className="text-zinc-300">Senha</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="bg-zinc-900 border-zinc-800 text-white placeholder-zinc-500 pr-10 focus:border-indigo-500 focus:ring-indigo-500 transition-colors"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-200 transition-colors"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            </CardContent>
            
            <CardFooter className="flex flex-col gap-3 pt-8 mt-4">
              <Button 
                type="submit" 
                className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-medium shadow-lg shadow-indigo-600/20 py-2.5 transition-all active:scale-[0.98]"
                disabled={isLoading}
              >
                {isLoading ? (
                  <span className="flex items-center gap-2 justify-center">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Autenticando...
                  </span>
                ) : (
                  'Entrar como Administrador'
                )}
              </Button>
              <div className="text-center text-xs text-zinc-500 mt-2">
                Protegido por Supabase Auth.
              </div>
            </CardFooter>
          </form>
        </Card>
      </div>
    </div>
  );
}

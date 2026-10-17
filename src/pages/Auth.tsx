import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  ArrowRight,
  Building2,
  Eye,
  EyeOff,
  Loader2,
  Lock,
  Mail,
  User,
  Wallet,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { z } from 'zod';

const emailSchema = z.string().email('Email invalido');
const passwordSchema = z.string().min(6, 'A senha deve ter pelo menos 6 caracteres');

const Auth: React.FC = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [workspaceName, setWorkspaceName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isResendingConfirmation, setIsResendingConfirmation] = useState(false);
  const [pendingConfirmationEmail, setPendingConfirmationEmail] = useState('');
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});

  const { signIn, signUp, resetPassword, resendConfirmation, user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user) {
      navigate('/', { replace: true });
    }
  }, [user, navigate]);

  const validateForm = () => {
    const newErrors: { email?: string; password?: string } = {};

    const emailResult = emailSchema.safeParse(email);
    if (!emailResult.success) {
      newErrors.email = emailResult.error.errors[0].message;
    }

    if (!isForgotPassword) {
      const passwordResult = passwordSchema.safeParse(password);
      if (!passwordResult.success) {
        newErrors.password = passwordResult.error.errors[0].message;
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!validateForm()) return;

    setIsLoading(true);

    try {
      if (isForgotPassword) {
        const { error } = await resetPassword(email);
        if (error) {
          toast.error(error.message);
        } else {
          toast.success('Email de recuperacao enviado. Verifique sua caixa de entrada.');
          setIsForgotPassword(false);
        }
        return;
      }

      if (isLogin) {
        const { error } = await signIn(email, password);
        if (error) {
          if (error.message.includes('Invalid login credentials')) {
            toast.error('Email ou senha incorretos');
          } else {
            toast.error(error.message);
          }
        } else {
          toast.success('Login realizado com sucesso.');
        }
        return;
      }

      const { error } = await signUp(email, password, displayName, workspaceName || undefined);
      if (error) {
        if (error.message.includes('User already registered')) {
          toast.error('Este email ja esta cadastrado. Voce pode ser convidado por outro usuario.');
        } else {
          toast.error(error.message);
        }
      } else {
        setPendingConfirmationEmail(email);
        toast.success('Cadastro recebido. Verifique seu email para confirmar a conta.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendConfirmation = async () => {
    const targetEmail = pendingConfirmationEmail || email;
    const emailResult = emailSchema.safeParse(targetEmail);

    if (!emailResult.success) {
      setErrors((current) => ({ ...current, email: emailResult.error.errors[0].message }));
      return;
    }

    setIsResendingConfirmation(true);

    try {
      const { error } = await resendConfirmation(targetEmail);
      if (error) {
        toast.error(error.message);
        return;
      }

      setPendingConfirmationEmail(targetEmail);
      toast.success('Email de confirmacao reenviado. Confira a caixa de entrada e o spam.');
    } finally {
      setIsResendingConfirmation(false);
    }
  };

  const handleBackToLogin = () => {
    setIsForgotPassword(false);
    setErrors({});
  };

  const clearEmailError = (value: string) => {
    setEmail(value);
    setErrors((current) => ({ ...current, email: undefined }));
  };

  const clearPasswordError = (value: string) => {
    setPassword(value);
    setErrors((current) => ({ ...current, password: undefined }));
  };

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="shrink-0 px-6 pb-6 pt-12">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', duration: 0.5 }}
          className="mx-auto flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-primary/70 shadow-lg shadow-primary/30"
        >
          <Wallet className="h-10 w-10 text-primary-foreground" />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="mt-6 text-center"
        >
          <h1 className="text-3xl font-bold">DEU BOM!!</h1>
          <p className="mt-1 text-lg font-semibold text-primary">FINANCAS SEM ERRO</p>
          <p className="mx-auto mt-3 max-w-sm text-sm text-muted-foreground">
            Controle seu mes com clareza, acompanhe entradas, saidas e pendencias sem depender de planilha.
          </p>
        </motion.div>
      </header>

      <main className="flex-1 px-6 pb-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="mx-auto max-w-md rounded-2xl border border-border bg-card p-6"
        >
          {isForgotPassword ? (
            <>
              <div className="mb-6 text-center">
                <h2 className="text-xl font-semibold">Recuperar senha</h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  Digite seu email para receber o link de recuperacao.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="mb-2 block text-sm font-medium">Email</label>
                  <div className="relative">
                    <Mail className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                    <input
                      type="email"
                      value={email}
                      onChange={(event) => clearEmailError(event.target.value)}
                      aria-label="Email"
                      placeholder="seu@email.com"
                      className={`w-full rounded-xl border bg-input py-3 pl-12 pr-4 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary ${
                        errors.email ? 'border-expense' : 'border-border'
                      }`}
                    />
                  </div>
                  {errors.email ? (
                    <p className="mt-1 text-sm text-expense">{errors.email}</p>
                  ) : null}
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-4 font-semibold text-primary-foreground transition-all hover:brightness-110 disabled:opacity-50"
                >
                  {isLoading ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <>
                      Enviar link de recuperacao
                      <ArrowRight className="h-5 w-5" />
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={handleBackToLogin}
                  className="w-full py-3 text-sm text-muted-foreground transition-colors hover:text-foreground"
                >
                  Voltar para o login
                </button>
              </form>
            </>
          ) : (
            <>
              <div className="mb-6 flex rounded-xl bg-muted p-1">
                <button
                  type="button"
                  onClick={() => setIsLogin(true)}
                  className={`flex-1 rounded-lg py-2.5 text-sm font-medium transition-all ${
                    isLogin ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'
                  }`}
                >
                  Entrar
                </button>
                <button
                  type="button"
                  onClick={() => setIsLogin(false)}
                  className={`flex-1 rounded-lg py-2.5 text-sm font-medium transition-all ${
                    !isLogin ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'
                  }`}
                >
                  Cadastrar
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                {!isLogin ? (
                  <>
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}>
                      <label className="mb-2 block text-sm font-medium">Seu nome</label>
                      <div className="relative">
                        <User className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                        <input
                          type="text"
                          value={displayName}
                          onChange={(event) => setDisplayName(event.target.value)}
                          placeholder="Como quer ser chamado?"
                          className="w-full rounded-xl border border-border bg-input py-3 pl-12 pr-4 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                        />
                      </div>
                    </motion.div>

                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}>
                      <label className="mb-2 block text-sm font-medium">Nome do espaco</label>
                      <div className="relative">
                        <Building2 className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                        <input
                          type="text"
                          value={workspaceName}
                          onChange={(event) => setWorkspaceName(event.target.value)}
                          placeholder="Ex: Contas da familia, Minha casa..."
                          className="w-full rounded-xl border border-border bg-input py-3 pl-12 pr-4 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                        />
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Voce tera acesso total e podera convidar outros usuarios.
                      </p>
                    </motion.div>
                  </>
                ) : null}

                <div>
                  <label className="mb-2 block text-sm font-medium">Email</label>
                  <div className="relative">
                    <Mail className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                    <input
                      type="email"
                      value={email}
                      onChange={(event) => clearEmailError(event.target.value)}
                      aria-label="Email"
                      placeholder="seu@email.com"
                      className={`w-full rounded-xl border bg-input py-3 pl-12 pr-4 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary ${
                        errors.email ? 'border-expense' : 'border-border'
                      }`}
                    />
                  </div>
                  {errors.email ? (
                    <p className="mt-1 text-sm text-expense">{errors.email}</p>
                  ) : null}
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium">Senha</label>
                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(event) => clearPasswordError(event.target.value)}
                      aria-label="Senha"
                      placeholder="********"
                      className={`w-full rounded-xl border bg-input py-3 pl-12 pr-12 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary ${
                        errors.password ? 'border-expense' : 'border-border'
                      }`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((current) => !current)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground"
                    >
                      {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                    </button>
                  </div>
                  {errors.password ? (
                    <p className="mt-1 text-sm text-expense">{errors.password}</p>
                  ) : null}
                </div>

                {isLogin ? (
                  <button
                    type="button"
                    onClick={() => setIsForgotPassword(true)}
                    className="text-sm text-primary hover:underline"
                  >
                    Esqueci minha senha
                  </button>
                ) : null}

                <button
                  type="submit"
                  disabled={isLoading}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-4 font-semibold text-primary-foreground transition-all hover:brightness-110 disabled:opacity-50"
                >
                  {isLoading ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <>
                      {isLogin ? 'Entrar' : 'Criar conta'}
                      <ArrowRight className="h-5 w-5" />
                    </>
                  )}
                </button>
              </form>

              <div className="mt-6 rounded-xl border border-primary/10 bg-primary/5 p-4 text-left">
                <p className="text-sm font-medium">Voce entra sabendo o que fazer</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Veja o saldo do mes, registre receitas e despesas em poucos passos e acompanhe o que ainda esta pendente.
                </p>
              </div>

              {!isLogin && pendingConfirmationEmail ? (
                <div className="mt-4 rounded-xl border border-border bg-muted/30 p-4 text-left">
                  <p className="text-sm font-medium">Nao recebeu o email?</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Confira a caixa de spam. Se ainda nao aparecer, reenvie a confirmacao para {pendingConfirmationEmail}.
                  </p>
                  <button
                    type="button"
                    onClick={handleResendConfirmation}
                    disabled={isResendingConfirmation}
                    className="mt-3 inline-flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-sm font-medium text-foreground disabled:opacity-50"
                  >
                    {isResendingConfirmation ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Mail className="h-4 w-4" />
                    )}
                    Reenviar confirmacao
                  </button>
                </div>
              ) : null}
            </>
          )}
        </motion.div>

        {!isLogin && !isForgotPassword ? (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="mx-auto mt-4 max-w-md text-center text-sm text-muted-foreground"
          >
            Ao criar uma conta, voce se torna proprietario com acesso total.
            Emails ja cadastrados nao podem criar novas contas, mas podem ser convidados.
          </motion.p>
        ) : null}
      </main>

      <footer className="shrink-0 px-6 pb-8 text-center">
        <p className="text-sm text-muted-foreground">
          Seus dados financeiros protegidos, sincronizados e prontos para organizar seu mes
        </p>
      </footer>
    </div>
  );
};

export default Auth;

import { Eye, EyeOff, Lock, Mail, TrendingUp } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { extractApiErrorMessage } from '../api/client';
import { useLogin } from '../api/hooks/useAuth';
import { useToast } from '../context/ToastContext';

export function LoginPage() {
  const loginMutation = useLogin();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setErrorMessage(null);

    if (!email.trim() || !password) {
      setErrorMessage('Email dan kata sandi wajib diisi.');
      return;
    }

    try {
      const response = await loginMutation.mutateAsync({
        email: email.trim().toLowerCase(),
        password,
      });
      showToast({
        variant: 'success',
        message: response.message || `Selamat datang kembali, ${response.data.user.name}!`,
      });
      void navigate(response.data.user.onboardingCompleted ? '/dashboard' : '/onboarding', {
        replace: true,
      });
    } catch (error) {
      setErrorMessage(extractApiErrorMessage(error, 'Email atau kata sandi salah.'));
    }
  };

  return (
    <div className="flex min-h-screen flex-col justify-center bg-slate-50 px-4 py-12 sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-md">
        <div className="flex flex-col items-center text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-900 text-white shadow-md">
            <TrendingUp className="h-6 w-6 text-indigo-400" />
          </div>
          <h1 className="mt-4 text-2xl font-extrabold tracking-tight text-slate-900">Masuk ke UPgrade</h1>
          <p className="mt-1 text-sm text-slate-500">
            Lanjutkan perjalanan menuju 7 Level Kebebasan Finansial Anda
          </p>
        </div>

        <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <form onSubmit={(event) => void handleSubmit(event)} className="space-y-4">
            <div>
              <label htmlFor="login-email" className="mb-1.5 block text-sm font-medium text-slate-700">
                Alamat Email
              </label>
              <div className="relative">
                <Mail className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  id="login-email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="nama@email.com"
                  className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pr-3.5 pl-10 text-sm text-slate-900 outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100"
                />
              </div>
            </div>

            <div>
              <label htmlFor="login-password" className="mb-1.5 block text-sm font-medium text-slate-700">
                Kata Sandi
              </label>
              <div className="relative">
                <Lock className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Masukkan kata sandi"
                  className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pr-10 pl-10 text-sm text-slate-900 outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-label={showPassword ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'}
                  className="absolute top-1/2 right-3 -translate-y-1/2 rounded-md p-1 text-slate-400 hover:text-slate-600"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {errorMessage && (
              <div className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs font-medium text-rose-700">
                {errorMessage}
              </div>
            )}

            <button
              type="submit"
              disabled={loginMutation.isPending}
              className="w-full rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white shadow-xs transition hover:bg-indigo-600 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loginMutation.isPending ? 'Memproses...' : 'Masuk Sekarang'}
            </button>
          </form>

          <p className="mt-6 text-center text-xs text-slate-500">
            Belum memiliki akun UPgrade?{' '}
            <Link to="/register" className="font-semibold text-indigo-600 hover:text-indigo-700">
              Daftar Gratis
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

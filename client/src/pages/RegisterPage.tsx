import { CheckCircle2, Circle, Eye, EyeOff, Lock, Mail, TrendingUp, User } from 'lucide-react';
import { useMemo, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { extractApiErrorMessage } from '../api/client';
import { useRegister } from '../api/hooks/useAuth';
import { useToast } from '../context/ToastContext';

export function RegisterPage() {
  const registerMutation = useRegister();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const passwordChecks = useMemo(
    () => [
      { id: 'len', label: 'Minimal 8 karakter', passed: password.length >= 8 },
      { id: 'alpha', label: 'Mengandung huruf (A–Z / a–z)', passed: /[A-Za-z]/.test(password) },
      { id: 'digit', label: 'Mengandung angka (0–9)', passed: /\d/.test(password) },
    ],
    [password],
  );

  const allPasswordChecksPassed = passwordChecks.every((check) => check.passed);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setErrorMessage(null);

    if (!name.trim()) {
      setErrorMessage('Nama lengkap wajib diisi.');
      return;
    }
    if (!email.trim()) {
      setErrorMessage('Alamat email wajib diisi.');
      return;
    }
    if (!allPasswordChecksPassed) {
      setErrorMessage('Kata sandi belum memenuhi seluruh kriteria keamanan.');
      return;
    }

    try {
      const response = await registerMutation.mutateAsync({
        name: name.trim(),
        email: email.trim().toLowerCase(),
        password,
      });
      showToast({
        variant: 'success',
        message: response.message || 'Pendaftaran berhasil. Mari atur profil keuangan awal Anda!',
      });
      void navigate('/onboarding', { replace: true });
    } catch (error) {
      setErrorMessage(extractApiErrorMessage(error, 'Gagal mendaftarkan akun.'));
    }
  };

  return (
    <div className="flex min-h-screen flex-col justify-center bg-slate-50 px-4 py-12 sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-md">
        <div className="flex flex-col items-center text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-900 text-white shadow-md">
            <TrendingUp className="h-6 w-6 text-indigo-400" />
          </div>
          <h1 className="mt-4 text-2xl font-extrabold tracking-tight text-slate-900">Buat Akun UPgrade</h1>
          <p className="mt-1 text-sm text-slate-500">
            Mulai petakan kondisi keuangan dan raih kebebasan finansial bertahap
          </p>
        </div>

        <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <form onSubmit={(event) => void handleSubmit(event)} className="space-y-4">
            <div>
              <label htmlFor="register-name" className="mb-1.5 block text-sm font-medium text-slate-700">
                Nama Lengkap
              </label>
              <div className="relative">
                <User className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  id="register-name"
                  type="text"
                  autoComplete="name"
                  required
                  maxLength={100}
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Contoh: Budi Santoso"
                  className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pr-3.5 pl-10 text-sm text-slate-900 outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100"
                />
              </div>
            </div>

            <div>
              <label htmlFor="register-email" className="mb-1.5 block text-sm font-medium text-slate-700">
                Alamat Email
              </label>
              <div className="relative">
                <Mail className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  id="register-email"
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
              <label htmlFor="register-password" className="mb-1.5 block text-sm font-medium text-slate-700">
                Kata Sandi
              </label>
              <div className="relative">
                <Lock className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  id="register-password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  required
                  maxLength={72}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Minimal 8 karakter huruf & angka"
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

              {/* Live Password Requirement Indicators */}
              <ul className="mt-2.5 space-y-1 rounded-xl border border-slate-100 bg-slate-50/80 p-3">
                {passwordChecks.map((check) => (
                  <li
                    key={check.id}
                    className={`flex items-center gap-2 text-xs font-medium ${
                      check.passed ? 'text-emerald-700' : 'text-slate-500'
                    }`}
                  >
                    {check.passed ? (
                      <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-600" />
                    ) : (
                      <Circle className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                    )}
                    <span>{check.label}</span>
                  </li>
                ))}
              </ul>
            </div>

            {errorMessage && (
              <div className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs font-medium text-rose-700">
                {errorMessage}
              </div>
            )}

            <button
              type="submit"
              disabled={registerMutation.isPending}
              className="w-full rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white shadow-xs transition hover:bg-indigo-600 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {registerMutation.isPending ? 'Mendaftarkan Akun...' : 'Daftar & Mulai Onboarding'}
            </button>
          </form>

          <p className="mt-6 text-center text-xs text-slate-500">
            Sudah memiliki akun UPgrade?{' '}
            <Link to="/login" className="font-semibold text-indigo-600 hover:text-indigo-700">
              Masuk di sini
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

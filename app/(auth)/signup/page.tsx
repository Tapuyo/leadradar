'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import UniverseBackground from '@/components/UniverseBackground/UniverseBackground';

export default function SignupPage() {
  const router = useRouter();
  const [companyName, setCompanyName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    const supabase = createClient();

    const { data, error: signupError } = await supabase.auth.signUp({ email, password });
    if (signupError) {
      setError(signupError.message);
      setLoading(false);
      return;
    }

    if (data.user) {
      const { error: companyError } = await supabase
        .from('companies')
        .insert({ user_id: data.user.id, name: companyName });

      if (companyError) {
        setError(companyError.message);
        setLoading(false);
        return;
      }
    }

    router.push('/dashboard');
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 relative overflow-hidden">
      <UniverseBackground />

      <div className="w-full max-w-md relative z-10">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white font-space-grotesk tracking-tight drop-shadow-[0_0_20px_rgba(37,99,235,0.6)]">
            Lead<span className="text-[#2563eb]">Radar</span>
          </h1>
          <p className="text-[#8899bb] mt-2 text-sm">Create your account</p>
        </div>

        <form
          onSubmit={handleSignup}
          className="bg-[#0a0a1e]/70 backdrop-blur-md border border-[#1e2d4a]/80 rounded-2xl p-8 space-y-5 shadow-[0_0_40px_rgba(37,99,235,0.12)]"
        >
          <div>
            <label className="block text-sm text-[#8899bb] mb-1.5">Company Name</label>
            <input
              type="text"
              value={companyName}
              onChange={e => setCompanyName(e.target.value)}
              required
              className="w-full bg-[#0d1428]/80 border border-[#1e2d4a] rounded-lg px-4 py-2.5 text-[#e8edf5] placeholder-[#8899bb] focus:outline-none focus:border-[#2563eb] transition-colors text-sm"
              placeholder="Acme Cleaning Co."
            />
          </div>

          <div>
            <label className="block text-sm text-[#8899bb] mb-1.5">Email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              className="w-full bg-[#0d1428]/80 border border-[#1e2d4a] rounded-lg px-4 py-2.5 text-[#e8edf5] placeholder-[#8899bb] focus:outline-none focus:border-[#2563eb] transition-colors text-sm"
              placeholder="you@company.com"
            />
          </div>

          <div>
            <label className="block text-sm text-[#8899bb] mb-1.5">Password</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              minLength={6}
              className="w-full bg-[#0d1428]/80 border border-[#1e2d4a] rounded-lg px-4 py-2.5 text-[#e8edf5] placeholder-[#8899bb] focus:outline-none focus:border-[#2563eb] transition-colors text-sm"
              placeholder="••••••••"
            />
          </div>

          {error && (
            <p className="text-red-400 text-sm bg-red-400/10 border border-red-400/20 rounded-lg px-4 py-2.5">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#1a4b8c] hover:bg-[#2563eb] disabled:opacity-50 text-white font-medium py-2.5 rounded-lg transition-colors text-sm shadow-[0_0_16px_rgba(37,99,235,0.3)]"
          >
            {loading ? 'Creating account...' : 'Create Account'}
          </button>

          <p className="text-center text-[#8899bb] text-sm">
            Already have an account?{' '}
            <Link href="/login" className="text-[#2563eb] hover:text-blue-400 transition-colors">
              Sign in
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}

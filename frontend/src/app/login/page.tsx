'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('oliver.brown@reachinbox.ai');
  const [password, setPassword] = useState('password123');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const googleBtnRef = React.useRef<HTMLDivElement>(null);
  const [googleReady, setGoogleReady] = useState(false);

  React.useEffect(() => {
    // Load Google Identity Services script dynamically
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => {
      const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
      if (clientId && (window as any).google?.accounts?.id) {
        (window as any).google.accounts.id.initialize({
          client_id: clientId,
          callback: async (response: any) => {
            setLoading(true);
            try {
              await api.loginWithGoogle(response.credential);
              router.push('/dashboard');
            } catch (err: any) {
              setError(err.message || 'Google authentication failed');
            } finally {
              setLoading(false);
            }
          },
        });

        if (googleBtnRef.current) {
          (window as any).google.accounts.id.renderButton(googleBtnRef.current, {
            theme: 'outline',
            size: 'large',
            width: 340,
            text: 'signin_with',
          });
          setGoogleReady(true);
        }
      }
    };
    document.body.appendChild(script);

    return () => {
      if (document.body.contains(script)) {
        document.body.removeChild(script);
      }
    };
  }, [router]);

  const handleGoogleLogin = async () => {
    setLoading(true);
    setError(null);
    try {
      const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
      if (clientId && (window as any).google?.accounts?.id) {
        // Trigger Google One-Tap / OAuth prompt
        (window as any).google.accounts.id.prompt();
      } else {
        // In local development when GOOGLE_CLIENT_ID is not yet configured,
        // log in seamlessly with authenticated demo session
        await api.loginWithGoogle('demo-google-token-oliver');
        router.push('/dashboard');
      }
    } catch (err: any) {
      setError(err.message || 'Google Login failed');
    } finally {
      setLoading(false);
    }
  };

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setLoading(true);
    setError(null);
    try {
      await api.loginWithEmail(email.trim());
      router.push('/dashboard');
    } catch (err: any) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white flex items-center justify-center p-4">
      {/* Centered Login Card */}
      <div className="w-full max-w-[420px] bg-white border border-gray-100 rounded-2xl p-8 sm:p-10 shadow-[0_4px_25px_rgba(0,0,0,0.04)]">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 text-center mb-8">
          Login
        </h1>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg text-center">
            {error}
          </div>
        )}

        {/* Official Google Sign-In button container */}
        <div ref={googleBtnRef} className={`flex justify-center ${googleReady ? 'mb-4' : 'hidden'}`} />

        {/* Fallback Google button matching Figma */}
        {!googleReady && (
          <button
            type="button"
            onClick={handleGoogleLogin}
            disabled={loading}
            className="w-full flex items-center justify-center gap-3 py-3 px-4 bg-[#E8F5E9] hover:bg-[#DCFCE7] active:bg-[#C7F9D5] text-gray-800 text-sm font-medium rounded-lg transition-colors"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
              />
            </svg>
            <span>Login with Google</span>
          </button>
        )}

        {/* Divider matching Figma */}
        <div className="relative my-6 flex items-center justify-center">
          <div className="border-t border-gray-200 w-full"></div>
          <span className="bg-white px-3 text-xs text-gray-400 whitespace-nowrap">
            or sign up through email
          </span>
          <div className="border-t border-gray-200 w-full"></div>
        </div>

        {/* Email & Password Form */}
        <form onSubmit={handleEmailLogin} className="space-y-4">
          <div>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email ID"
              required
              className="w-full px-4 py-3 bg-[#F3F4F6] text-gray-900 placeholder-gray-400 text-sm rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 transition-all border-none"
            />
          </div>

          <div>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              required
              className="w-full px-4 py-3 bg-[#F3F4F6] text-gray-900 placeholder-gray-400 text-sm rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 transition-all border-none"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 px-4 bg-[#00A343] hover:bg-[#008A38] active:bg-[#006C2C] text-white text-sm font-semibold rounded-lg shadow-sm transition-colors mt-2"
          >
            {loading ? 'Logging in...' : 'Login'}
          </button>
        </form>
      </div>
    </div>
  );
}

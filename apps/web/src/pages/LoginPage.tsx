import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext.js';
import { useToast } from '../contexts/ToastContext.js';
import { Button } from '../components/ui/Button.js';
import { Input } from '../components/ui/Input.js';
import { Mail, Lock, ArrowRight, Sparkles } from 'lucide-react';

export const LoginPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { login } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast.warning('Please enter both email and password.');
      return;
    }

    setIsLoading(true);
    try {
      await login(email, password);
      toast.success('Welcome back to SchedulAI!');
      navigate('/dashboard');
    } catch (err) {
      toast.error((err as Error).message, 'Login Failed');
    } finally {
      setIsLoading(false);
    }
  };

  const fillDemo = (role: 'admin' | 'teacher' | 'staff') => {
    if (role === 'admin') {
      setEmail('admin@schedulai.edu');
      setPassword('Admin@12345');
    } else if (role === 'teacher') {
      setEmail('teacher@schedulai.edu');
      setPassword('Teacher@12345');
    } else {
      setEmail('staff@schedulai.edu');
      setPassword('Staff@12345');
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-xl font-bold text-white tracking-tight">Sign In</h3>
        <p className="text-xs text-slate-400 mt-1">
          Access the AI timetable management platform
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          type="email"
          label="Institutional Email"
          placeholder="admin@schedulai.edu"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          leftIcon={<Mail className="w-4 h-4" />}
          required
        />

        <Input
          type="password"
          label="Password"
          placeholder="••••••••"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          leftIcon={<Lock className="w-4 h-4" />}
          required
        />

        <Button
          type="submit"
          variant="teal"
          size="lg"
          className="w-full mt-2"
          isLoading={isLoading}
          rightIcon={<ArrowRight className="w-4 h-4" />}
        >
          Sign In
        </Button>
      </form>

      {/* Demo Quick Logins */}
      <div className="pt-4 border-t border-slate-800 space-y-2">
        <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 text-center">
          Quick Demo Credentials
        </div>
        <div className="grid grid-cols-3 gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => fillDemo('admin')}
            className="text-[11px] py-1"
          >
            Admin
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => fillDemo('teacher')}
            className="text-[11px] py-1"
          >
            Teacher
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => fillDemo('staff')}
            className="text-[11px] py-1"
          >
            Staff
          </Button>
        </div>
      </div>

      <div className="text-center text-xs text-slate-400">
        Don't have an account?{' '}
        <Link to="/register" className="text-teal-400 hover:text-teal-300 font-semibold underline">
          Create one here
        </Link>
      </div>
    </div>
  );
};

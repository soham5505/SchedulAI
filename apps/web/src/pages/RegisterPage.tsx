import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext.js';
import { useToast } from '../contexts/ToastContext.js';
import { Button } from '../components/ui/Button.js';
import { Input } from '../components/ui/Input.js';
import { Select } from '../components/ui/Select.js';
import { Mail, Lock, User, ArrowRight } from 'lucide-react';
import { UserRole } from '@schedulai/shared-types';

export const RegisterPage: React.FC = () => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<UserRole>('ADMIN');
  const [isLoading, setIsLoading] = useState(false);
  const { register } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !email || !password) {
      toast.warning('Please complete all required fields.');
      return;
    }

    setIsLoading(true);
    try {
      await register(name, email, password, role);
      toast.success('Account created successfully!');
      navigate('/dashboard');
    } catch (err) {
      toast.error((err as Error).message, 'Registration Failed');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-xl font-bold text-white tracking-tight">Create Account</h3>
        <p className="text-xs text-slate-400 mt-1">
          Register new institutional administrator or user
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          type="text"
          label="Full Name"
          placeholder="Dr. Alan Turing"
          value={name}
          onChange={(e) => setName(e.target.value)}
          leftIcon={<User className="w-4 h-4" />}
          required
        />

        <Input
          type="email"
          label="Institutional Email"
          placeholder="alan.turing@schedulai.edu"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          leftIcon={<Mail className="w-4 h-4" />}
          required
        />

        <Input
          type="password"
          label="Password (min 8 chars, 1 upper, 1 lower, 1 digit)"
          placeholder="••••••••"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          leftIcon={<Lock className="w-4 h-4" />}
          required
        />

        <Select
          label="Account Role"
          value={role}
          onChange={(e) => setRole(e.target.value as UserRole)}
          options={[
            { value: 'ADMIN', label: 'Administrator (Full Access)' },
            { value: 'STAFF', label: 'Academic Staff (Manage Data)' },
            { value: 'TEACHER', label: 'Faculty / Teacher' },
            { value: 'VIEWER', label: 'Student / Viewer (Read Only)' },
          ]}
        />

        <Button
          type="submit"
          variant="teal"
          size="lg"
          className="w-full mt-2"
          isLoading={isLoading}
          rightIcon={<ArrowRight className="w-4 h-4" />}
        >
          Create Account
        </Button>
      </form>

      <div className="text-center text-xs text-slate-400 pt-2 border-t border-slate-800">
        Already have an account?{' '}
        <Link to="/login" className="text-teal-400 hover:text-teal-300 font-semibold underline">
          Sign In
        </Link>
      </div>
    </div>
  );
};

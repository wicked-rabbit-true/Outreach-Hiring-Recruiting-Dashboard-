import LoginForm from './LoginForm';
import { branding } from '@/settings/public';

export const dynamic = 'force-dynamic';

export default function LoginPage() {
  return (
    <div className="login">
      <div className="login-card">
        <h1>{branding.name}</h1>
        <p>{branding.subtitle}. Sign in to see how the campaign is performing.</p>
        <LoginForm />
      </div>
    </div>
  );
}

import LoginForm from '@/components/layout/login-form';

type PageProps = {
  searchParams?: {
    callbackUrl?: string | string[];
  };
};

export default function Page({ searchParams }: PageProps) {
  const raw = searchParams?.callbackUrl;

  const callbackUrl =
    typeof raw === 'string' ? raw : Array.isArray(raw) ? raw[0] : undefined;
  return <LoginForm callbackUrl={callbackUrl} />;
}

import LoginForm from '@/components/layout/login-form';

type PageProps = {
  searchParams?: Promise<{
    callbackUrl?: string | string[];
  }>;
};

export default async function Page({ searchParams }: PageProps) {
  const params = await searchParams;
  const raw = params?.callbackUrl;

  const callbackUrl =
    typeof raw === 'string' ? raw : Array.isArray(raw) ? raw[0] : undefined;
  return <LoginForm callbackUrl={callbackUrl} />;
}

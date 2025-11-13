import { Header } from '@/components/layout/header';
import { Auth } from '@/providers';

export default async function Layout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <Auth>
      <div className="flex h-full flex-col">
        <Header />
        <div className="flex-1">{children}</div>
      </div>
    </Auth>
  );
}

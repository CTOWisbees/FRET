'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    router.push('/login');
  }, [router]);

  return (
    <div className="flex items-center justify-center min-h-screen bg-[#0F141B]">
      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#0E9F6E]"></div>
    </div>
  );
}

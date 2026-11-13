import React from 'react';
import { Outlet } from 'react-router-dom';
import { Navbar } from './Navbar';
import { Footer } from './Footer';
import { MobileNav } from './MobileNav';

export const PublicLayout: React.FC = () => {
  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900 antialiased">
      <Navbar />
      <main className="flex-1 pb-16 md:pb-0">
        <Outlet />
      </main>
      <Footer />
      <MobileNav />
    </div>
  );
};

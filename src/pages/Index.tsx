
import React from 'react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import WelcomeCard from '@/components/WelcomeCard';

const Index = () => {
  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Header />
      
      <main className="flex-grow py-12 px-6 md:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col items-center justify-center h-full py-12 md:py-24">
            <h1 className="text-4xl md:text-5xl font-bold text-gray-800 mb-6 text-center">
              Clean Starter Template
            </h1>
            <p className="text-xl text-gray-600 max-w-2xl text-center mb-12">
              A minimal foundation for your next amazing web project.
              Start building right away with this simple and elegant template.
            </p>
            
            <WelcomeCard />
          </div>
        </div>
      </main>
      
      <Footer />
    </div>
  );
};

export default Index;

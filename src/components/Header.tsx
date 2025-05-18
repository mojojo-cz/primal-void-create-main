
import React from 'react';
import { Link } from 'react-router-dom';

const Header = () => {
  return (
    <header className="w-full py-4 px-6 md:px-8 bg-white border-b border-gray-100 shadow-sm">
      <div className="max-w-7xl mx-auto flex justify-between items-center">
        <Link to="/" className="text-xl font-medium text-gray-800 hover:text-gray-600 transition-colors">
          My Project
        </Link>
        
        <nav className="hidden md:flex space-x-8">
          <Link to="/" className="text-gray-600 hover:text-gray-800 transition-colors">Home</Link>
          <Link to="/" className="text-gray-600 hover:text-gray-800 transition-colors">Features</Link>
          <Link to="/" className="text-gray-600 hover:text-gray-800 transition-colors">About</Link>
          <Link to="/" className="text-gray-600 hover:text-gray-800 transition-colors">Contact</Link>
        </nav>
        
        <div className="md:hidden">
          <button className="text-gray-600 hover:text-gray-800 focus:outline-none">
            <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
        </div>
      </div>
    </header>
  );
};

export default Header;

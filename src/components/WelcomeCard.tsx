
import React from 'react';
import { Button } from "@/components/ui/button";

const WelcomeCard = () => {
  return (
    <div className="bg-white rounded-lg shadow-md p-8 w-full max-w-lg">
      <h2 className="text-2xl font-semibold text-gray-800 mb-4">Welcome to Your New Project</h2>
      <p className="text-gray-600 mb-6">
        This is a clean, minimal template to help you get started. You can customize 
        this project to build anything you want.
      </p>
      <div className="flex flex-col sm:flex-row gap-4">
        <Button className="bg-blue-600 hover:bg-blue-700">
          Get Started
        </Button>
        <Button variant="outline" className="border-gray-300 text-gray-700 hover:bg-gray-50">
          Learn More
        </Button>
      </div>
    </div>
  );
};

export default WelcomeCard;

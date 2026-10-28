import React from 'react';
import { Link } from 'react-router-dom';

export const NotFoundPage: React.FC = () => {
  return (
    <div className="max-w-md mx-auto py-20 px-4 text-center space-y-4">
      <h1 className="text-4xl font-extrabold text-slate-900">404</h1>
      <p className="text-slate-600 text-sm">
        The page you are looking for does not exist or has been moved.
      </p>
      <div>
        <Link
          to="/"
          className="inline-block px-5 py-2.5 rounded-xl text-sm font-semibold bg-blue-600 text-white hover:bg-blue-700 transition"
        >
          Return Home
        </Link>
      </div>
    </div>
  );
};

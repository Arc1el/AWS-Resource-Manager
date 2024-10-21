import React from 'react';
import '../styles/globals.css';

function MyApp({ Component, pageProps }: { Component: React.ComponentType; pageProps: any }) {
  return (
    <div className="min-h-screen bg-gray-100">
      <Component {...pageProps} />
    </div>
  );
}

export default MyApp;

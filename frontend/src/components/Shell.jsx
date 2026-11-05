import React from 'react';
import Header from './Header.jsx';
import Footer from './Footer.jsx';

export default function Shell({ children }) {
  return (
    <>
      <a className="skip-link" href="#main-content">
        Bỏ qua điều hướng
      </a>
      <Header />
      <main id="main-content" tabIndex={-1}>
        {children}
      </main>
      <Footer />
    </>
  );
}

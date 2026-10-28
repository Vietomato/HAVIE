import React from 'react';
import Header from './Header.jsx';
import Footer from './Footer.jsx';

export default function Shell({ children }) {
  return (
    <>
      <Header />
      <main id="main-content">{children}</main>
      <Footer />
    </>
  );
}

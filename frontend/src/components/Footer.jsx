import React from 'react';
import { Link } from 'react-router-dom';

export default function Footer() {
  return (
    <footer className="footer" id="about">
      <div className="container footer-grid">
        <section>
          <Link className="footer-logo" to="/">
            HAVIE.
          </Link>
          <p>Play beyond limits.</p>
          <p>Built for the love of badminton.</p>
        </section>
        <section>
          <h3>EXPLORE</h3>
          <Link to="/products">Shop all</Link>
          <Link to="/products?category=rackets">Vợt cầu lông</Link>
          <Link to="/products?category=shoes">Giày cầu lông</Link>
        </section>
        <section>
          <h3>SUPPORT</h3>
          <a href="mailto:hello@havie.example">Contact us</a>
          <Link to="/cart">Shopping cart</Link>
          <Link to="/auth">My account</Link>
        </section>
        <section>
          <h3>FOLLOW THE GAME</h3>
          <p>Made for the court. Designed for everyday.</p>
          <span className="footer-note">Demo Storefront • API Contract v1 Integrated</span>
        </section>
      </div>
      <div className="container footer-bottom">
        © 2026 HAVIE Badminton Store <span>Designed with intention.</span>
      </div>
    </footer>
  );
}

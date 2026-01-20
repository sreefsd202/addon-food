import React from 'react';
import { Link } from 'react-router-dom';
import './Navbar.css';

const Navbar = () => {
  return (
    <nav className="navbar">
      <div className="nav-container">

        {/* LEFT */}
        <div className="navbar-left">
          <Link to="/" className="logo-link">
            <div className="logo-section">
              <img src="/img.png" alt="CampusBites Logo" className="logo-image" />
              <div className="logo-text-container">
                <span className="logo-text">Campus</span>
                <span className="logo-highlight">Bites</span>
              </div>
            </div>
          </Link>
        </div>

        {/* CENTER */}
        <div className="navbar-center">
          <span className="tagline-text">
            Fresh Food, Zero Delay, Just Eat.
          </span>
        </div>

        {/* RIGHT */}
        <div className="navbar-right">
          <div className="desktop-nav">
            <Link to="/signup" className="nav-link">Sign Up</Link>
            <Link to="/user/login" className="nav-link">Sign In</Link>
            <Link to="/admin/login" className="nav-link">Admin</Link>
          </div>
        </div>

      </div>
    </nav>
  );
};

export default Navbar;

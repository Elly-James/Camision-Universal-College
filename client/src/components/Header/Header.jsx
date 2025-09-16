import React, { useContext } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import logoImage from '../../assets/logo-apex-study-forge3.png';
import './Header.css';

const Header = () => {
  const navigate = useNavigate();
  const { user, role, logout } = useContext(AuthContext);

  const handleAuthAction = () => {
    if (user) {
      logout();
      navigate('/');
    } else {
      navigate('/auth');
    }
  };

  return (
    <header className="headerSection">
      <div className="header flex">
        <div className="logoDiv">
          <div className="logo-img">
            <img src={logoImage} alt="Apex Study Forge Logo" />
          </div>
          <NavLink to="/" className="logo">
            <h1>Apex Study Forge</h1>
          </NavLink>
        </div>

        <div className="navBar">
          <ul className="navLists flex">
            <li className="navItem">
              <NavLink 
                to="/" 
                className={({ isActive }) => `navLink ${isActive ? 'activeLink' : ''}`}
              >
                Home
              </NavLink>
            </li>
            <li className="navItem">
              <NavLink 
                to="/blog" 
                className={({ isActive }) => `navLink ${isActive ? 'activeLink' : ''}`}
              >
                Blog
              </NavLink>
            </li>
            {user && role === 'client' && (
              <li className="navItem">
                <NavLink
                  to="/client-dashboard"
                  className={({ isActive }) => `navLink ${isActive ? 'activeLink' : ''}`}
                >
                  Client Dashboard
                </NavLink>
              </li>
            )}
            {user && role === 'admin' && (
              <li className="navItem">
                <NavLink
                  to="/admin-dashboard"
                  className={({ isActive }) => `navLink ${isActive ? 'activeLink' : ''}`}
                >
                  Admin Dashboard
                </NavLink>
              </li>
            )}
          </ul>

          <div className="btnContainer">
            <button onClick={handleAuthAction} className="authBtn">
              {user ? 'Logout' : 'Login/Signup'}
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
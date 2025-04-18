import React from 'react';
import { BrowserRouter as Router } from 'react-router-dom';
import { AuthProvider } from './components/context/AuthContext';
import Routing from './components/Routing/Routing.jsx';
import Header from './components/Header/Header';
import Footer from './components/Footer/Footer';
import './App.css';

const App = () => {
  return (
    <AuthProvider>
      <Router>
        <div className="app-container">
          <Header />
          <main>
            <Routing />
          </main>
          <Footer />
        </div>
      </Router>
    </AuthProvider>
  );
};

export default App;
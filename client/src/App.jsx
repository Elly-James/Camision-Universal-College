import React from 'react';
import { BrowserRouter as Router } from 'react-router-dom';
import { AuthProvider } from './components/context/AuthContext';
import Routing from './components/Routing/Routing.jsx';
import Header from './components/Header/Header';
import Footer from './components/Footer/Footer';
import { Toaster } from 'react-hot-toast';
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
          <Toaster
            position="top-right"
            toastOptions={{
              duration: 5000,
              success: { style: { background: 'green', color: 'white' } },
              error: { style: { background: 'red', color: 'white' } },
            }}
          />
        </div>
      </Router>
    </AuthProvider>
  );
};

export default App;
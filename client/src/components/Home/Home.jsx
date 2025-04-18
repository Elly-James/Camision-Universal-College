import React from 'react';
import { useNavigate } from 'react-router-dom';
import './Home.css';

const subjects = [
  { name: 'Mathematics', description: 'Algebra, Calculus, Statistics, and more.' },
  { name: 'Science', description: 'Physics, Chemistry, Biology, and more.' },
  { name: 'Literature', description: 'Classic novels, Poetry, Literary analysis.' },
  { name: 'History', description: 'World History, American History, Ancient Civilizations.' },
  { name: 'Programming', description: 'Python, JavaScript, Java, and more.' },
  { name: 'Languages', description: 'Spanish, French, German, and more.' },
];

const Home = () => {
  const navigate = useNavigate();

  const handleCheckout = (subject) => {
    navigate('/client-dashboard', { state: { subject } });
  };

  return (
    <>
      <section className="home">
        <div className="overlay"></div>
        <video className="background-video" autoPlay loop muted>
          <source src="https://videos.pexels.com/video-files/2777396/2777396-hd_1920_1080_30fps.mp4" type="video/mp4" />
          Your browser does not support the video tag.
        </video>
        <div className="homeContent container">
          <div className="textDiv">
            <span className="smallText">LEARN WITH US</span>
            <h1 className="homeTitle">Discover Academic Excellence</h1>
          </div>
          <div className="cardDiv">
            <p className="intro-text">
              Your one-stop platform for academic assistance and expert guidance across various subjects.
            </p>
            <div className="cta-button">
              <button onClick={() => navigate('/client-dashboard')} className="explore-btn">
                Explore Subjects
              </button>
            </div>
          </div>
          <div className="homeFooterIcons flex">
            <div className="rightIcons">
              <a href="https://facebook.com" target="_blank" rel="noopener noreferrer" aria-label="Facebook">
                <i className="fab fa-facebook-f icon"></i>
              </a>
              <a href="https://twitter.com" target="_blank" rel="noopener noreferrer" aria-label="Twitter">
                <i className="fab fa-twitter icon"></i>
              </a>
              <a href="https://instagram.com" target="_blank" rel="noopener noreferrer" aria-label="Instagram">
                <i className="fab fa-instagram icon"></i>
              </a>
            </div>
            <div className="leftIcons">
              <i className="fas fa-book icon"></i>
              <i className="fas fa-graduation-cap icon"></i>
            </div>
          </div>
        </div>
      </section>
      <section className="main-section">
        <div className="container">
          <div className="secTitle">
            <h3 className="title">Explore Subjects</h3>
            <p className="subtitle">Choose from a variety of subjects to get expert assistance</p>
          </div>
          <div className="subject-cards">
            {subjects.map((subject, index) => (
              <div key={index} className="subject-card">
                <h3>{subject.name}</h3>
                <p>{subject.description}</p>
                <button
                  className="checkout-button"
                  onClick={() => handleCheckout(subject.name)}
                >
                  Proceed to Checkout
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
};

export default Home;
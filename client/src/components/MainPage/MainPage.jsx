import React, { useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import './MainPage.css';

const MainPage = () => {
  const navigate = useNavigate();
  const { user } = useContext(AuthContext);

  const subjects = [
    {
      title: 'Nursing',
      description:
        'Get expertly crafted nursing essays and case studies. Our writers specialize in healthcare topics to meet your academic needs.',
    },
    {
      title: 'Mathematics',
      description:
        'Solve complex math problems with ease. From calculus to statistics, our experts deliver accurate and detailed solutions.',
    },
    {
      title: 'English Literature',
      description:
        'Analyze literary works with in-depth essays. Our writers provide insightful interpretations for your literature assignments.',
    },
    {
      title: 'History',
      description:
        'Explore historical events through well-researched papers. We cover ancient to modern history with precision and clarity.',
    },
    {
      title: 'Psychology',
      description:
        'Dive into psychological theories and research. Our papers are tailored to meet rigorous academic standards in psychology.',
    },
    {
      title: 'Business Studies',
      description:
        'Excel in business with custom case studies and reports. Our writers focus on management, marketing, and finance topics.',
    },
  ];

  const handleProceed = () => {
    if (user) {
      navigate('/client-dashboard');
    } else {
      navigate('/auth');
    }
  };

  return (
    <section className="main container section">
      <div className="secTitle">
        <h3 className="title">Our Subjects</h3>
        <p className="subtitle">Expert assistance across a wide range of academic subjects</p>
      </div>
      <div className="secContent grid">
        {subjects.map((subject, index) => (
          <div key={index} className="singleSubject">
            <div className="cardInfo">
              <h4 className="subjectTitle">{subject.title}</h4>
              <div className="desc">
                <p>{subject.description}</p>
              </div>
              <button onClick={handleProceed} className="btn flex">
                Proceed to Checkout
              </button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
};

export default MainPage;
import React, { useState } from 'react';
import './Footer.css';

const Footer = () => {
  const [showAllServices, setShowAllServices] = useState(false);
  const [email, setEmail] = useState('');
  const [subscriptionStatus, setSubscriptionStatus] = useState('');

  const toggleServices = () => {
    setShowAllServices(!showAllServices);
  };

  const handleSubscribe = (e) => {
    e.preventDefault();
    if (!email) {
      setSubscriptionStatus('Please enter a valid email address.');
      return;
    }

    window.location.href = `mailto:support@Camision-Universal-College.com?subject=Contact from Camision-Universal-College &body=Hello, I would like to get more information about your services. My email is ${email}.`;

    setSubscriptionStatus('Thank you for contacting us! We will get back to you soon.');
    setEmail('');
  };

  return (
    <section className="footer">
      <div className="videoDiv">
        <video src="https://videos.pexels.com/video-files/2777396/2777396-hd_1920_1080_30fps.mp4" muted autoPlay loop type="video/mp4"></video>
      </div>
      <div className="secContent container">
        <div className="contactDiv flex">
          <div className="text">
            <small>KEEP IN TOUCH</small>
            <h2>Contact Us</h2>
          </div>
          <div className="inputDiv flex">
            <form onSubmit={handleSubscribe} className="subscriptionForm">
              <input
                type="email"
                placeholder="Enter Email Address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
              <button className="btn flex" type="submit">
                SEND <i className="fas fa-paper-plane icon"></i>
              </button>
            </form>
            {subscriptionStatus && (
              <div className={`subscriptionMessage ${subscriptionStatus.includes('Thank') ? 'success' : 'error'}`}>
                {subscriptionStatus}
              </div>
            )}
          </div>
        </div>
        <div className="footerCard grid">
          <div className="footerIntro">
            <div className="logoDiv">
              <a href="/" className="logo flex">
                <i className="fas fa-book-open icon"></i> Camision-Universal-College
              </a>
            </div>
            <div className="footerContent">
              <div className="companyInfo">
              Camision-Universal-College offers expert academic assistance across various subjects. We provide high-quality, custom-written papers to help you succeed in your studies. Our team of professional writers is dedicated to delivering exceptional service tailored to your needs.
              </div>
              <div className="paymentMethodsContainer">
                <div className="paymentMethods">
                  <p className="acceptsText">We accept:</p>
                  <div className="paymentIcons">
                    <img
                      src="//asset.edusson.com/bundles/asterfreelance/_layout/images/_common_images/payment-icons-v3/visa.svg"
                      alt="Visa"
                      className="paymentIcon"
                    />
                    <img
                      src="//asset.edusson.com/bundles/asterfreelance/_layout/images/_common_images/payment-icons-v3/mastercard.svg"
                      alt="Mastercard"
                      className="paymentIcon"
                    />
                    <img
                      src="//asset.edusson.com/bundles/asterfreelance/_layout/images/_common_images/payment-icons-v3/amex.svg"
                      alt="AMEX"
                      className="paymentIcon"
                    />
                    <img
                      src="//asset.edusson.com/bundles/asterfreelance/_layout/images/_common_images/payment-icons-v3/applepay.svg"
                      alt="Apple Pay"
                      className="paymentIcon"
                    />
                    <img
                      src="//asset.edusson.com/bundles/asterfreelance/_layout/images/_common_images/payment-icons-v3/discover.svg"
                      alt="Discover"
                      className="paymentIcon"
                    />
                    <img
                      src="//asset.edusson.com/bundles/asterfreelance/_layout/images/_common_images/payment-icons-v3/union.svg"
                      alt="Union"
                      className="paymentIcon"
                    />
                    <img
                      src="//asset.edusson.com/bundles/asterfreelance/_layout/images/_common_images/payment-icons-v3/jcb.svg"
                      alt="JCB"
                      className="paymentIcon"
                    />
                  </div>
                </div>
              </div>
            </div>
            <div className="footerSocials flex">
              <a href="https://facebook.com" target="_blank" rel="noopener noreferrer" aria-label="Facebook">
                <i className="fab fa-facebook-f icon"></i>
              </a>
              <a href="https://twitter.com" target="_blank" rel="noopener noreferrer" aria-label="Twitter">
                <i className="fab fa-twitter icon"></i>
              </a>
              <a href="https://instagram.com" target="_blank" rel="noopener noreferrer" aria-label="Instagram">
                <i className="fab fa-instagram icon"></i>
              </a>
              <a href="https://linkedin.com" target="_blank" rel="noopener noreferrer" aria-label="LinkedIn">
                <i className="fab fa-linkedin-in icon"></i>
              </a>
            </div>
          </div>
          <div className="footerLinks grid">
            <div className="linkGroup">
              <span className="groupTitle">COMPANY</span>
              <li className="footerList flex">
                <i className="fas fa-chevron-right icon"></i>
                <a href="/about">About</a>
              </li>
              <li className="footerList flex">
                <i className="fas fa-chevron-right icon"></i>
                <a href="/testimonials">Testimonials</a>
              </li>
              <li className="footerList flex">
                <i className="fas fa-chevron-right icon"></i>
                <a href="/privacy">Privacy Policy</a>
              </li>
              <li className="footerList flex">
                <i className="fas fa-chevron-right icon"></i>
                <a href="/faq">FAQ</a>
              </li>
              <li className="footerList flex">
                <i className="fas fa-chevron-right icon"></i>
                <a href="/howitworks">How it works</a>
              </li>
              <li className="footerList flex">
                <i className="fas fa-chevron-right icon"></i>
                <a href="/contactus">Contact Us</a>
              </li>
              <li className="footerList flex">
                <i className="fas fa-chevron-right icon"></i>
                <a href="/writer">We are Hiring</a>
              </li>
              <li className="footerList flex">
                <i className="fas fa-chevron-right icon"></i>
                <a href="/terms">Terms and Conditions</a>
              </li>
              <li className="footerList flex">
                <i className="fas fa-chevron-right icon"></i>
                <a href="/fair-use-policy">Fair Use Policy</a>
              </li>
              <li className="footerList flex">
                <i className="fas fa-chevron-right icon"></i>
                <a href="/payment-policy">Payment Policy</a>
              </li>
              <li className="footerList flex">
                <i className="fas fa-chevron-right icon"></i>
                <a href="/writer/dont-buy-accounts">Don't buy accounts</a>
              </li>
            </div>
            <div className="linkGroup">
              <span className="groupTitle">SERVICES</span>
              <div className={`services-wrapper ${showAllServices ? 'expanded' : ''}`}>
                <div className="services-column">
                  <li className="footerList flex">
                    <i className="fas fa-chevron-right icon"></i>
                    <a href="/admission-essay-writing-service">Admission Essay Writing Services</a>
                  </li>
                  <li className="footerList flex">
                    <i className="fas fa-chevron-right icon"></i>
                    <a href="/analytical-essay-writing-service">Analytical Essay Writing Services</a>
                  </li>
                  <li className="footerList flex">
                    <i className="fas fa-chevron-right icon"></i>
                    <a href="/apa-paper-writing-service">APA Paper Writing Services</a>
                  </li>
                  <li className="footerList flex">
                    <i className="fas fa-chevron-right icon"></i>
                    <a href="/argumentative-essay-writing-service">Argumentative Essay Writing Services</a>
                  </li>
                  <li className="footerList flex">
                    <i className="fas fa-chevron-right icon"></i>
                    <a href="/book-report-writing-service">Book Report Writing Services</a>
                  </li>
                </div>
                <div className="services-column">
                  <li className="footerList flex">
                    <i className="fas fa-chevron-right icon"></i>
                    <a href="/buy-argumentative-essay">Argumentative Essays</a>
                  </li>
                  <li className="footerList flex">
                    <i className="fas fa-chevron-right icon"></i>
                    <a href="/buy-assignment"> Assignments</a>
                  </li>
                  <li className="footerList flex">
                    <i className="fas fa-chevron-right icon"></i>
                    <a href="/buy-biology-papers">Biology Papers</a>
                  </li>
                  <li className="footerList flex">
                    <i className="fas fa-chevron-right icon"></i>
                    <a href="/buy-capstone-project">Capstone Projects</a>
                  </li>
                  <li className="footerList flex">
                    <i className="fas fa-chevron-right icon"></i>
                    <a href="/buy-case-study">Case Studys</a>
                  </li>
                </div>
                <div className="services-column">
                  <li className="footerList flex">
                    <i className="fas fa-chevron-right icon"></i>
                    <a href="/coursework-help">Coursework Help</a>
                  </li>
                  <li className="footerList flex">
                    <i className="fas fa-chevron-right icon"></i>
                    <a href="/descriptive-essay-writing-service">Descriptive Essay Writing Service</a>
                  </li>
                  <li className="footerList flex">
                    <i className="fas fa-chevron-right icon"></i>
                    <a href="/dissertation-proposal-writing">Dissertation Proposal Writing</a>
                  </li>
                  <li className="footerList flex">
                    <i className="fas fa-chevron-right icon"></i>
                    <a href="/pay-for-dissertation">Pay For Dissertation</a>
                  </li>
                  <li className="footerList flex">
                    <i className="fas fa-chevron-right icon"></i>
                    <a href="/pay-for-thesis">Pay For Thesis</a>
                  </li>
                </div>
              </div>
              <button className="show-services-btn" onClick={toggleServices}>
                {showAllServices ? 'Show Less' : 'All Services'}
              </button>
            </div>
            <div className="linkGroup">
              <span className="groupTitle">CONTACT US</span>
              <li className="footerList flex">
                <i className="fas fa-phone icon"></i>
                <a href="tel:18883985903">1-888-398-5903</a>
              </li>
              <li className="footerList flex">
                <i className="fas fa-envelope icon"></i>
                <a href="mailto:support@Camision-Universal-College.com">support@Camision-Universal-College.com</a>
              </li>
              <li className="footerList flex">
                <i className="fas fa-map-marker-alt icon"></i>
                Online Platform
              </li>
            </div>
          </div>
          <div className="footerDiv flex">
            <small>BEST ACADEMIC ASSISTANCE</small>
            <small>© 2025 CAMISION UNIVERSAL COLLEGE. ALL RIGHTS RESERVED.</small>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Footer;
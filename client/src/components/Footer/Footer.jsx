// Updated footer.jsx

import React, { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faFacebookF, faTwitter, faInstagram, faLinkedinIn } from '@fortawesome/free-brands-svg-icons';
import { faPaperPlane, faBookOpen, faChevronRight, faPhone, faEnvelope, faMapMarkerAlt } from '@fortawesome/free-solid-svg-icons';
import './Footer.css';
import { contact } from '../../utils/api.js'; // Adjust the import path based on your file structure (assuming api.js is in the same directory or parent)

const Footer = () => {
  const [showAllServices, setShowAllServices] = useState(false);
  const [email, setEmail] = useState('');
  const [subscriptionStatus, setSubscriptionStatus] = useState('');

  const toggleServices = () => {
    setShowAllServices(!showAllServices);
  };

  const handleSubscribe = async (e) => {
    e.preventDefault();
    if (!email) {
      setSubscriptionStatus('Please enter a valid email address.');
      return;
    }

    try {
      await contact(email);
      setSubscriptionStatus('Thank you for contacting us! We will get back to you soon.');
      setEmail('');
    } catch (error) {
      setSubscriptionStatus('An error occurred while sending your message. Please try again later.');
    }
  };

  return (
    <section className="footer">
      <div className="videoDiv">
        <video
          src="https://videos.pexels.com/video-files/2777396/2777396-hd_1920_1080_30fps.mp4"
          muted
          autoPlay
          loop
          type="video/mp4"
        ></video>
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
                SEND <FontAwesomeIcon icon={faPaperPlane} className="icon" />
              </button>
            </form>
            {subscriptionStatus && (
              <div
                className={`subscriptionMessage ${
                  subscriptionStatus.includes('Thank') ? 'success' : 'error'
                }`}
              >
                {subscriptionStatus}
              </div>
            )}
          </div>
        </div>
        <div className="footerCard grid">
          <div className="footerIntro">
            <div className="logoDiv">
              <a href="/" className="logo flex">
                <FontAwesomeIcon icon={faBookOpen} className="icon" /> Apex-Study-Forge
              </a>
            </div>
            <div className="footerContent">
              <div className="companyInfo">
                Apex-Study-Forge offers expert academic assistance across various subjects. We provide
                high-quality, custom-written papers to help you succeed in your studies. Our team of professional
                writers is dedicated to delivering exceptional service tailored to your needs.
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
              <a href="https://www.facebook.com/profile.php?id=100072957581262" target="_blank" rel="noopener noreferrer" aria-label="Facebook">
                <FontAwesomeIcon icon={faFacebookF} className="icon" />
              </a>
              <a href="https://x.com/Ellyjames_" target="_blank" rel="noopener noreferrer" aria-label="Twitter">
                <FontAwesomeIcon icon={faTwitter} className="icon" />
              </a>
              <a href="https://www.instagram.com/ejk694/?hl=en" target="_blank" rel="noopener noreferrer" aria-label="Instagram">
                <FontAwesomeIcon icon={faInstagram} className="icon" />
              </a>
              <a href="linkedin.com/in/elly-james" target="_blank" rel="noopener noreferrer" aria-label="LinkedIn">
                <FontAwesomeIcon icon={faLinkedinIn} className="icon" />
              </a>
            </div>
          </div>
          <div className="footerLinks grid">
            <div className="linkGroup">
              <span className="groupTitle">COMPANY</span>
              <li className="footerList flex">
                <FontAwesomeIcon icon={faChevronRight} className="icon" />
                <a href="/about">About</a>
              </li>
              <li className="footerList flex">
                <FontAwesomeIcon icon={faChevronRight} className="icon" />
                <a href="/testimonials">Testimonials</a>
              </li>
              <li className="footerList flex">
                <FontAwesomeIcon icon={faChevronRight} className="icon" />
                <a href="/privacy">Privacy Policy</a>
              </li>
              <li className="footerList flex">
                <FontAwesomeIcon icon={faChevronRight} className="icon" />
                <a href="/faq">FAQ</a>
              </li>
              <li className="footerList flex">
                <FontAwesomeIcon icon={faChevronRight} className="icon" />
                <a href="/howitworks">How it works</a>
              </li>
              <li className="footerList flex">
                <FontAwesomeIcon icon={faChevronRight} className="icon" />
                <a href="/contactus">Contact Us</a>
              </li>
              <li className="footerList flex">
                <FontAwesomeIcon icon={faChevronRight} className="icon" />
                <a href="/writer">We are Hiring</a>
              </li>
              <li className="footerList flex">
                <FontAwesomeIcon icon={faChevronRight} className="icon" />
                <a href="/terms">Terms and Conditions</a>
              </li>
              <li className="footerList flex">
                <FontAwesomeIcon icon={faChevronRight} className="icon" />
                <a href="/fair-use-policy">Fair Use Policy</a>
              </li>
              <li className="footerList flex">
                <FontAwesomeIcon icon={faChevronRight} className="icon" />
                <a href="/payment-policy">Payment Policy</a>
              </li>
              <li className="footerList flex">
                <FontAwesomeIcon icon={faChevronRight} className="icon" />
                <a href="/writer/dont-buy-accounts">Don't buy accounts</a>
              </li>
            </div>
            <div className="linkGroup">
              <span className="groupTitle">SERVICES</span>
              <div className={`services-wrapper ${showAllServices ? 'expanded' : ''}`}>
                <div className="services-column">
                  <li className="footerList flex">
                    <FontAwesomeIcon icon={faChevronRight} className="icon" />
                    <a href="/admission-essay-writing-service">Admission Essay Writing Services</a>
                  </li>
                  <li className="footerList flex">
                    <FontAwesomeIcon icon={faChevronRight} className="icon" />
                    <a href="/analytical-essay-writing-service">Analytical Essay Writing Services</a>
                  </li>
                  <li className="footerList flex">
                    <FontAwesomeIcon icon={faChevronRight} className="icon" />
                    <a href="/apa-paper-writing-service">APA Paper Writing Services</a>
                  </li>
                  <li className="footerList flex">
                    <FontAwesomeIcon icon={faChevronRight} className="icon" />
                    <a href="/argumentative-essay-writing-service">Argumentative Essay Writing Services</a>
                  </li>
                  <li className="footerList flex">
                    <FontAwesomeIcon icon={faChevronRight} className="icon" />
                    <a href="/book-report-writing-service">Book Report Writing Services</a>
                  </li>
                </div>
                <div className="services-column">
                  <li className="footerList flex">
                    <FontAwesomeIcon icon={faChevronRight} className="icon" />
                    <a href="/buy-argumentative-essay">Argumentative Essays</a>
                  </li>
                  <li className="footerList flex">
                    <FontAwesomeIcon icon={faChevronRight} className="icon" />
                    <a href="/buy-assignment">Assignments</a>
                  </li>
                  <li className="footerList flex">
                    <FontAwesomeIcon icon={faChevronRight} className="icon" />
                    <a href="/buy-biology-papers">Biology Papers</a>
                  </li>
                  <li className="footerList flex">
                    <FontAwesomeIcon icon={faChevronRight} className="icon" />
                    <a href="/buy-capstone-project">Capstone Projects</a>
                  </li>
                  <li className="footerList flex">
                    <FontAwesomeIcon icon={faChevronRight} className="icon" />
                    <a href="/buy-case-study">Case Studies</a>
                  </li>
                </div>
                <div className="services-column">
                  <li className="footerList flex">
                    <FontAwesomeIcon icon={faChevronRight} className="icon" />
                    <a href="/coursework-help">Coursework Help</a>
                  </li>
                  <li className="footerList flex">
                    <FontAwesomeIcon icon={faChevronRight} className="icon" />
                    <a href="/descriptive-essay-writing-service">Descriptive Essay Writing Service</a>
                  </li>
                  <li className="footerList flex">
                    <FontAwesomeIcon icon={faChevronRight} className="icon" />
                    <a href="/dissertation-proposal-writing">Dissertation Proposal Writing</a>
                  </li>
                  <li className="footerList flex">
                    <FontAwesomeIcon icon={faChevronRight} className="icon" />
                    <a href="/pay-for-dissertation"> For Dissertation</a>
                  </li>
                  <li className="footerList flex">
                    <FontAwesomeIcon icon={faChevronRight} className="icon" />
                    <a href="/pay-for-thesis">For Thesis</a>
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
                <FontAwesomeIcon icon={faPhone} className="icon" />
                <a href="tel:+254743767800">+254 743 767 800</a>
              </li>
              <li className="footerList flex">
                <FontAwesomeIcon icon={faEnvelope} className="icon" />
                <a href="mailto:support@apexstudyforge.com">support@apexstudyforge.com</a>
              </li>
              <li className="footerList flex">
                <FontAwesomeIcon icon={faEnvelope} className="icon" />
                <a href="mailto:Vagasheredia@gmail.com">Vagasheredia@gmail.com</a>
              </li>
               <li className="footerList flex">
                <FontAwesomeIcon icon={faEnvelope} className="icon" />
                <a href="mailto:ellykomunga@gmail.com">ellykomunga@gmail.com</a>
              </li>
            </div>
          </div>
          <div className="footerDiv flex">
            <small>BEST ACADEMIC ASSISTANCE</small>
            <small>© 2025 APEX STUDY FORGE. ALL RIGHTS RESERVED.</small>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Footer;
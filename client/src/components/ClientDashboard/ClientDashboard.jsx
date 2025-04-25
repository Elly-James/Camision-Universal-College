import React, { useState, useEffect, useContext, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import Select from 'react-select';
import countryList from 'react-select-country-list';
import Header from '../Header/Header.jsx';
import api from '../../utils/api.js';
import { AuthContext } from '../context/AuthContext.jsx';
import './ClientDashboard.css';

const ClientDashboard = () => {
  const navigate = useNavigate();
  const { user, role } = useContext(AuthContext);

  const [subject, setSubject] = useState('');
  const [title, setTitle] = useState('');
  const [pages, setPages] = useState(1);
  const [deadline, setDeadline] = useState(new Date());
  const [instructions, setInstructions] = useState('');
  const [citedResources, setCitedResources] = useState(0);
  const [formattingStyle, setFormattingStyle] = useState('APA');
  const [writerLevel, setWriterLevel] = useState('PHD');
  const [spacing, setSpacing] = useState('double');
  const [files, setFiles] = useState([]);
  const [cardNumber, setCardNumber] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [cvc, setCvc] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [country, setCountry] = useState(null);
  const [postalCode, setPostalCode] = useState('');

  const [activeJobs, setActiveJobs] = useState([]);
  const [completedJobs, setCompletedJobs] = useState([]);
  const [currentTab, setCurrentTab] = useState('newOrder');
  const [selectedJob, setSelectedJob] = useState(null);
  const [newMessage, setNewMessage] = useState('');
  const [chatMessages, setChatMessages] = useState([]);
  const [newChatMessage, setNewChatMessage] = useState('');

  const countryOptions = useMemo(() => countryList().getData(), []);

  useEffect(() => {
    if (!user || role !== 'client') {
      navigate('/auth');
    } else {
      fetchJobs();
      fetchChatMessages();
    }
  }, [user, role, navigate]);

  const fetchJobs = async () => {
    try {
      const response = await api.get('/api/jobs');
      const jobs = response.data;
      setActiveJobs(jobs.filter(job => job.status !== 'Completed'));
      setCompletedJobs(jobs.filter(job => job.status === 'Completed'));
    } catch (error) {
      console.error('Failed to fetch jobs:', error);
    }
  };

  const fetchChatMessages = async () => {
    try {
      const response = await api.get('/api/messages');
      setChatMessages(response.data);
    } catch (error) {
      console.error('Failed to fetch chat messages:', error);
    }
  };

  const calculateTotalAmount = () => {
    const wordsPerPage = spacing === 'single' ? 550 : 275;
    const ratePerWord = {
      PHD: 0.15,
      Masters: 0.12,
      Undergraduate: 0.10,
      'High School': 0.08,
      Primary: 0.05,
    }[writerLevel] || 0.10;
    return (pages * wordsPerPage * ratePerWord).toFixed(2);
  };

  const handlePostJob = async (e) => {
    e.preventDefault();
    try {
      const totalAmount = calculateTotalAmount();

      const formData = new FormData();
      formData.append('subject', subject);
      formData.append('title', title);
      formData.append('pages', pages);
      formData.append('deadline', deadline.toISOString());
      formData.append('instructions', instructions);
      formData.append('citedResources', citedResources);
      formData.append('formattingStyle', formattingStyle);
      formData.append('writerLevel', writerLevel);
      formData.append('spacing', spacing);
      formData.append('totalAmount', totalAmount);
      files.forEach(file => formData.append('files', file));

      await api.post('/api/jobs', formData);
      alert('Job posted successfully!');

      // Clear form
      setSubject('');
      setTitle('');
      setPages(1);
      setDeadline(new Date());
      setInstructions('');
      setCitedResources(0);
      setFormattingStyle('APA');
      setWriterLevel('PHD');
      setSpacing('double');
      setFiles([]);
      setCardNumber('');
      setExpiryDate('');
      setCvc('');
      setFirstName('');
      setLastName('');
      setCountry(null);
      setPostalCode('');
      setCurrentTab('activeJobs');
      fetchJobs();
    } catch (error) {
      console.error('Failed to post job:', error);
      alert('Failed to post job. Please try again.');
    }
  };

  const viewJobDetails = async (jobId) => {
    try {
      const response = await api.get(`/api/jobs/${jobId}`);
      setSelectedJob(response.data);
      setCurrentTab('jobDetails');
      setNewMessage('');
    } catch (error) {
      console.error('Failed to fetch job details:', error);
    }
  };

  const sendMessage = async () => {
    if (!newMessage.trim()) return;
    try {
      const formData = new FormData();
      formData.append('content', newMessage);
      await api.post(`/api/jobs/${selectedJob.id}/messages`, formData);
      const response = await api.get(`/api/jobs/${selectedJob.id}`);
      setSelectedJob(response.data);
      setNewMessage('');
    } catch (error) {
      console.error('Failed to send message:', error);
      alert('Failed to send message. Please try again.');
    }
  };

  const sendChatMessage = async () => {
    if (!newChatMessage.trim()) return;
    try {
      const formData = new FormData();
      formData.append('content', newChatMessage);
      await api.post('/api/messages', formData);
      setNewChatMessage('');
      fetchChatMessages();
    } catch (error) {
      console.error('Failed to send chat message:', error);
      alert('Failed to send chat message. Please try again.');
    }
  };

  const removeFile = (fileName) => {
    setFiles(files.filter((file) => file.name !== fileName));
  };

  const generateFilePreview = (file) => {
    const fileType = file.type.split('/')[0];
    const fileExtension = file.name.split('.').pop().toLowerCase();

    if (fileType === 'image') {
      return <img src={URL.createObjectURL(file)} alt={file.name} className="file-preview" />;
    } else if (fileExtension === 'pdf') {
      return (
        <div className="file-preview-icon">
          <span className="file-icon">📄</span>
          <span className="file-type">PDF</span>
        </div>
      );
    } else if (fileExtension === 'docx' || fileExtension === 'doc') {
      return (
        <div className="file-preview-icon">
          <span className="file-icon">📝</span>
          <span className="file-type">DOCX</span>
        </div>
      );
    }
    return (
      <div className="file-preview-icon">
        <span className="file-icon">📁</span>
        <span className="file-type">File</span>
      </div>
    );
  };

  return (
    <>
      <Header />
      <div className="client-dashboard-container">
        <div className="client-dashboard">
          <div className="dashboard-header">
            <h1>Client Dashboard</h1>
            <div className="user-info">
              <p>Welcome, {user?.name}</p>
            </div>
          </div>

          <div className="dashboard-tabs">
            <button
              className={currentTab === 'newOrder' ? 'tab-active' : ''}
              onClick={() => setCurrentTab('newOrder')}
            >
              New Order
            </button>
            <button
              className={currentTab === 'activeJobs' ? 'tab-active' : ''}
              onClick={() => setCurrentTab('activeJobs')}
            >
              Active Jobs ({activeJobs.length})
            </button>
            <button
              className={currentTab === 'completedJobs' ? 'tab-active' : ''}
              onClick={() => setCurrentTab('completedJobs')}
            >
              Completed Jobs ({completedJobs.length})
            </button>
            <button
              className={currentTab === 'chat' ? 'tab-active' : ''}
              onClick={() => setCurrentTab('chat')}
            >
              Chat with Admin
            </button>
          </div>

          {currentTab === 'newOrder' && (
            <div className="order-form">
              <h2>Create New Order</h2>
              <form onSubmit={handlePostJob}>
                <div className="form-section">
                  <h3>Paper Details</h3>
                  <div className="form-row">
                    <div className="form-group">
                      <label htmlFor="subject">Subject</label>
                      <select
                        id="subject"
                        className="form-input"
                        value={subject}
                        onChange={(e) => setSubject(e.target.value)}
                        required
                      >
                        <option value="">Select Subject</option>
                        <option value="Nursing">Nursing</option>
                        <option value="Maths">Maths</option>
                        <option value="English">English</option>
                        <option value="History">History</option>
                        <option value="Science">Science</option>
                        <option value="Business">Business</option>
                        <option value="Psychology">Psychology</option>
                        <option value="Economics">Economics</option>
                      </select>
                    </div>
                    <div className="form-group">
                      <label htmlFor="title">Topic</label>
                      <input
                        id="title"
                        className="form-input"
                        type="text"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        placeholder="Enter the main topic of your paper"
                        required
                      />
                    </div>
                  </div>

                  <div className="form-row">
                    <div className="form-group">
                      <label htmlFor="pages">Number of Pages</label>
                      <input
                        id="pages"
                        className="form-input"
                        type="number"
                        min="1"
                        value={pages}
                        onChange={(e) => setPages(parseInt(e.target.value))}
                        required
                      />
                      <span className="form-hint">
                        {spacing === 'single' ? '1 page = 550 words' : '1 page = 275 words'}
                      </span>
                    </div>
                    <div className="form-group">
                      <label htmlFor="spacing">Spacing</label>
                      <select
                        id="spacing"
                        className="form-input"
                        value={spacing}
                        onChange={(e) => setSpacing(e.target.value)}
                      >
                        <option value="single">Single</option>
                        <option value="double">Double</option>
                      </select>
                    </div>
                  </div>

                  <div className="form-row">
                    <div className="form-group">
                      <label htmlFor="deadline">Deadline</label>
                      <DatePicker
                        id="deadline"
                        className="form-input"
                        selected={deadline}
                        onChange={(date) => setDeadline(date)}
                        showTimeSelect
                        dateFormat="MMMM d, yyyy h:mm aa"
                        minDate={new Date()}
                        required
                      />
                    </div>
                    <div className="form-group">
                      <label htmlFor="citedResources">Number of Cited Resources</label>
                      <input
                        id="citedResources"
                        className="form-input"
                        type="number"
                        min="0"
                        value={citedResources}
                        onChange={(e) => setCitedResources(parseInt(e.target.value))}
                      />
                    </div>
                  </div>

                  <div className="form-row">
                    <div className="form-group">
                      <label htmlFor="formattingStyle">Formatting Style</label>
                      <select
                        id="formattingStyle"
                        className="form-input"
                        value={formattingStyle}
                        onChange={(e) => setFormattingStyle(e.target.value)}
                      >
                        <option value="APA">APA</option>
                        <option value="MLA">MLA</option>
                        <option value="Chicago">Chicago</option>
                        <option value="Harvard">Harvard</option>
                        <option value="IEEE">IEEE</option>
                      </select>
                    </div>
                    <div className="form-group">
                      <label htmlFor="writerLevel">Writer Level</label>
                      <select
                        id="writerLevel"
                        className="form-input"
                        value={writerLevel}
                        onChange={(e) => setWriterLevel(e.target.value)}
                      >
                        <option value="PHD">PHD</option>
                        <option value="Masters">Masters</option>
                        <option value="Undergraduate">Undergraduate</option>
                        <option value="High School">High School</option>
                        <option value="Primary">Primary</option>
                      </select>
                    </div>
                  </div>

                  <div className="form-group">
                    <label htmlFor="instructions">Detailed Instructions</label>
                    <textarea
                      id="instructions"
                      className="form-input"
                      value={instructions}
                      onChange={(e) => setInstructions(e.target.value)}
                      rows="5"
                      placeholder="Please provide detailed instructions for your paper"
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="files">Upload Files</label>
                    <input
                      id="files"
                      className="form-input file-input"
                      type="file"
                      multiple
                      onChange={(e) => setFiles(Array.from(e.target.files))}
                    />
                    <span className="form-hint">Upload relevant materials or instructions (optional)</span>

                    {files.length > 0 && (
                      <div className="uploaded-files">
                        <ul>
                          {files.map((file, index) => (
                            <li key={index} className="uploaded-file-item">
                              <div className="file-preview-container">{generateFilePreview(file)}</div>
                              <span>{file.name}</span>
                              <button
                                type="button"
                                onClick={() => removeFile(file.name)}
                                className="remove-file-button"
                              >
                                X
                              </button>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>

                <div className="form-section payment-section">
                  <h3>Payment Details</h3>
                  <div className="form-group payment-method">
                    <label>Payment Method</label>
                    <div className="payment-options">
                      <label>
                        <input
                          type="radio"
                          name="paymentMethod"
                          value="card"
                          checked={true}
                          readOnly
                        />
                        Credit/Debit Card
                      </label>
                    </div>
                  </div>
                  <div className="form-row">
                    <div className="form-group">
                      <label htmlFor="cardNumber" className="required">
                        Card Number
                      </label>
                      <input
                        id="cardNumber"
                        className="form-input"
                        type="text"
                        value={cardNumber}
                        onChange={(e) => setCardNumber(e.target.value)}
                        placeholder="1234 5678 9012 3456"
                        maxLength="19"
                        required
                      />
                    </div>
                  </div>
                  <div className="form-row">
                    <div className="form-group">
                      <label htmlFor="expiryDate" className="required">
                        Expiration Date
                      </label>
                      <input
                        id="expiryDate"
                        className="form-input"
                        type="text"
                        value={expiryDate}
                        onChange={(e) => setExpiryDate(e.target.value)}
                        placeholder="MM/YY"
                        maxLength="5"
                        required
                      />
                    </div>
                    <div className="form-group">
                      <label htmlFor="cvc" className="required">
                        CVV
                      </label>
                      <input
                        id="cvc"
                        className="form-input"
                        type="text"
                        value={cvc}
                        onChange={(e) => setCvc(e.target.value)}
                        placeholder="123"
                        maxLength="4"
                        required
                      />
                    </div>
                  </div>
                  <div className="form-row">
                    <div className="form-group">
                      <label htmlFor="firstName" className="required">
                        First Name
                      </label>
                      <input
                        id="firstName"
                        className="form-input"
                        type="text"
                        value={firstName}
                        onChange={(e) => setFirstName(e.target.value)}
                        placeholder="First name"
                        required
                      />
                    </div>
                    <div className="form-group">
                      <label htmlFor="lastName" className="required">
                        Last Name
                      </label>
                      <input
                        id="lastName"
                        className="form-input"
                        type="text"
                        value={lastName}
                        onChange={(e) => setLastName(e.target.value)}
                        placeholder="Last name"
                        required
                      />
                    </div>
                  </div>
                  <div className="form-row">
                    <div className="form-group">
                      <label htmlFor="country" className="required">
                        Country
                      </label>
                      <Select
                        options={countryOptions}
                        value={country}
                        onChange={(option) => setCountry(option)}
                        placeholder="Select Country"
                        className="country-select"
                        classNamePrefix="select"
                        required
                      />
                    </div>
                    <div className="form-group">
                      <label htmlFor="postalCode" className="required">
                        Postal Code
                      </label>
                      <input
                        id="postalCode"
                        className="form-input"
                        type="text"
                        value={postalCode}
                        onChange={(e) => setPostalCode(e.target.value)}
                        placeholder="Enter postal code"
                        required
                      />
                    </div>
                  </div>
                </div>

                <button type="submit" className="auth-button">
                  Post Job
                </button>
              </form>
            </div>
          )}

          {currentTab === 'activeJobs' && (
            <div className="job-list">
              <h2>Active Jobs</h2>
              {activeJobs.length > 0 ? (
                activeJobs.map((job) => (
                  <div key={job.id} className="job-card" onClick={() => viewJobDetails(job.id)}>
                    <h3>{job.title}</h3>
                    <p>Subject: {job.subject}</p>
                    <p>Pages: {job.pages}</p>
                    <p>Deadline: {new Date(job.deadline).toLocaleString()}</p>
                    <p>Status: {job.status}</p>
                  </div>
                ))
              ) : (
                <p>No active jobs found.</p>
              )}
            </div>
          )}

          {currentTab === 'completedJobs' && (
            <div className="job-list">
              <h2>Completed Jobs</h2>
              {completedJobs.length > 0 ? (
                completedJobs.map((job) => (
                  <div key={job.id} className="job-card" onClick={() => viewJobDetails(job.id)}>
                    <h3>{job.title}</h3>
                    <p>Subject: {job.subject}</p>
                    <p>Pages: {job.pages}</p>
                    <p>Deadline: {new Date(job.deadline).toLocaleString()}</p>
                    <p>Status: {job.status}</p>
                  </div>
                ))
              ) : (
                <p>No completed jobs found.</p>
              )}
            </div>
          )}

          {currentTab === 'jobDetails' && selectedJob && (
            <div className="job-details">
              <h2>Job Details</h2>
              <div className="job-details-content">
                <h3>{selectedJob.title}</h3>
                <p>Subject: {selectedJob.subject}</p>
                <p>Pages: {selectedJob.pages}</p>
                <p>Deadline: {new Date(selectedJob.deadline).toLocaleString()}</p>
                <p>Instructions: {selectedJob.instructions}</p>
                <p>Formatting Style: {selectedJob.formatting_style}</p>
                <p>Writer Level: {selectedJob.writer_level}</p>
                <p>Spacing: {selectedJob.spacing}</p>
                <p>Cited Resources: {selectedJob.cited_resources}</p>
                <p>Status: {selectedJob.status}</p>

                {selectedJob.files?.length > 0 && (
                  <div>
                    <h4>Uploaded Files:</h4>
                    <ul>
                      {selectedJob.files.map((file, index) => (
                        <li key={index}>
                          <a
                            href={`http://localhost:5000/uploads/${file}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            download
                          >
                            Download File {index + 1}
                          </a>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {selectedJob.completed_files?.length > 0 && (
                  <div>
                    <h4>Completed Work:</h4>
                    <ul>
                      {selectedJob.completed_files.map((file, index) => (
                        <li key={index}>
                          <a
                            href={`http://localhost:5000/uploads/${file}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            download
                          >
                            Download Completed File {index + 1}
                          </a>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="messages-section">
                  <h3>Communication with Admin</h3>
                  {selectedJob.messages?.length > 0 ? (
                    selectedJob.messages.map((msg, index) => (
                      <div
                        key={index}
                        className={`message ${msg.sender_role === 'client' ? 'message-sent' : 'message-received'}`}
                      >
                        <p><strong>{msg.sender_role === 'client' ? 'You' : 'Admin'}:</strong> {msg.content}</p>
                        {msg.files?.length > 0 && (
                          <div className="message-files">
                            <p>Attachments:</p>
                            <ul>
                              {msg.files.map((file, i) => (
                                <li key={i}>
                                  <a
                                    href={`http://localhost:5000/uploads/${file}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    download
                                  >
                                    Download File {i + 1}
                                  </a>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                        <small>{new Date(msg.created_at).toLocaleString()}</small>
                      </div>
                    ))
                  ) : (
                    <p>No messages yet. Start the conversation.</p>
                  )}

                  <div className="message-input">
                    <h4>Send Message to Admin</h4>
                    <textarea
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      placeholder="Type your message to the admin..."
                      rows="4"
                    />
                    <button
                      onClick={sendMessage}
                      disabled={!newMessage.trim()}
                    >
                      Send Message
                    </button>
                  </div>
                </div>
              </div>
              <button onClick={() => setCurrentTab('activeJobs')}>Back to Jobs</button>
            </div>
          )}

          {currentTab === 'chat' && (
            <div className="chat-section">
              <h2>Chat with Admin</h2>
              <div className="messages-section">
                {chatMessages.length > 0 ? (
                  chatMessages.map((msg, index) => (
                    <div
                      key={index}
                      className={`message ${msg.sender_role === 'client' ? 'message-sent' : 'message-received'}`}
                    >
                      <p><strong>{msg.sender_role === 'client' ? 'You' : 'Admin'}:</strong> {msg.content}</p>
                      <small>{new Date(msg.created_at).toLocaleString()}</small>
                    </div>
                  ))
                ) : (
                  <p>No messages yet. Start the conversation.</p>
                )}

                <div className="message-input">
                  <h4>Send Message to Admin</h4>
                  <textarea
                    value={newChatMessage}
                    onChange={(e) => setNewChatMessage(e.target.value)}
                    placeholder="Type your message to the admin..."
                    rows="4"
                  />
                  <button
                    onClick={sendChatMessage}
                    disabled={!newChatMessage.trim()}
                  >
                    Send Message
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default ClientDashboard;
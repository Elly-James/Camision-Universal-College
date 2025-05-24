import React, { useState, useEffect, useContext, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import Select from 'react-select';
import countryList from 'react-select-country-list';
import Header from '../Header/Header.jsx';
import { AuthContext } from '../context/AuthContext.jsx';
import { 
  getCurrentUser, 
  createJob, 
  getJobs, 
  getJob, 
  sendMessage, 
  getMessages, 
  editMessage, 
  deleteMessage, 
  getSocketJobs, 
  getSocketMessages,
  getFile 
} from '../../utils/api.js';
import toast from 'react-hot-toast';
import './ClientDashboard.css';
import { FaTrash, FaEdit, FaSave, FaTimes } from 'react-icons/fa';

const ClientDashboard = () => {
  const navigate = useNavigate();
  const { user, role, token } = useContext(AuthContext);

  // Form states
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
  const [additionalFiles, setAdditionalFiles] = useState([]);

  // Dashboard states
  const [activeJobs, setActiveJobs] = useState([]);
  const [completedJobs, setCompletedJobs] = useState([]);
  const [currentTab, setCurrentTab] = useState('newOrder');
  const [selectedJob, setSelectedJob] = useState(null);
  const [chatMessages, setChatMessages] = useState([]);
  const [newChatMessage, setNewChatMessage] = useState('');
  const [editingMessageId, setEditingMessageId] = useState(null);
  const [editedMessageContent, setEditedMessageContent] = useState('');
  const [isDownloading, setIsDownloading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [hiddenMessageIds, setHiddenMessageIds] = useState(() => {
    const stored = localStorage.getItem('hiddenMessageIds');
    return stored ? JSON.parse(stored) : [];
  });

  const countryOptions = useMemo(() => countryList().getData(), []);

  useEffect(() => {
    if (!user || role !== 'client') {
      navigate('/auth');
    } else {
      fetchData();
    }

    const socketJobs = getSocketJobs();
    const socketMessages = getSocketMessages();

    if (socketJobs) {
      socketJobs.on('new_job', (job) => {
        if (job.user_id === user.id) {
          setActiveJobs((prev) => [...prev, job]);
          toast.success('New job posted');
        }
      });
      socketJobs.on('job_updated', (job) => {
        setActiveJobs((prev) => prev.map((j) => (j.id === job.id ? job : j)));
        setCompletedJobs((prev) => prev.map((j) => (j.id === job.id ? job : j)));
        if (selectedJob && selectedJob.id === job.id) {
          setSelectedJob(job);
        }
        toast.success('Job updated');
      });
    }

    if (socketMessages) {
      socketMessages.on('new_general_message', (message) => {
        if (!hiddenMessageIds.includes(message.id) && message.client_id === user.id) {
          setChatMessages((prev) => [...prev, message]);
          if (selectedJob) {
            setSelectedJob((prev) => ({
              ...prev,
              messages: [...(prev.messages || []), message],
            }));
          }
          toast.success('New message received');
        }
      });
      socketMessages.on('message_updated', (message) => {
        if (!hiddenMessageIds.includes(message.id) && message.client_id === user.id) {
          setChatMessages((prev) => prev.map((m) => (m.id === message.id ? message : m)));
          if (selectedJob) {
            setSelectedJob((prev) => ({
              ...prev,
              messages: prev.messages.map((m) => (m.id === message.id ? message : m)),
            }));
          }
          toast.success('Message updated');
        }
      });
      socketMessages.on('message_deleted', ({ message_id, client_id }) => {
        if (client_id === user.id) {
          setChatMessages((prev) => prev.filter((m) => m.id !== message_id));
          setHiddenMessageIds((prev) => {
            const updated = [...prev, message_id];
            localStorage.setItem('hiddenMessageIds', JSON.stringify(updated));
            return updated;
          });
          if (selectedJob) {
            setSelectedJob((prev) => ({
              ...prev,
              messages: prev.messages.filter((m) => m.id !== message_id),
            }));
          }
          toast.success('Message deleted');
        }
      });
    }

    return () => {
      if (socketJobs) {
        socketJobs.off('new_job');
        socketJobs.off('job_updated');
      }
      if (socketMessages) {
        socketMessages.off('new_general_message');
        socketMessages.off('message_updated');
        socketMessages.off('message_deleted');
      }
    };
  }, [user, role, navigate, selectedJob, hiddenMessageIds]);

  const fetchData = async () => {
    try {
      const [userData, jobsData, messagesData] = await Promise.all([
        getCurrentUser(),
        getJobs(),
        getMessages(),
      ]);
      setActiveJobs(jobsData.filter((job) => job.status !== 'Completed'));
      setCompletedJobs(jobsData.filter((job) => job.status === 'Completed'));
      setChatMessages(messagesData.filter((msg) => !hiddenMessageIds.includes(msg.id)));
    } catch (error) {
      toast.error(error.message || 'Failed to load data');
      if (error.message.includes('Token')) {
        navigate('/auth');
      }
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

  const resetForm = () => {
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
  };

  const handlePostJob = async (e) => {
    e.preventDefault();
    const currentDate = new Date();
    if (deadline <= currentDate) {
      toast.error('Deadline must be in the future');
      return;
    }
    try {
      const totalAmount = calculateTotalAmount();
      const formData = new FormData();
      
      formData.append('subject', subject);
      formData.append('title', title);
      formData.append('pages', pages);
      const deadlineISO = deadline.toISOString();
      formData.append('deadline', deadlineISO);
      formData.append('instructions', instructions);
      formData.append('citedResources', citedResources);
      formData.append('formattingStyle', formattingStyle);
      formData.append('writerLevel', writerLevel);
      formData.append('spacing', spacing);
      formData.append('totalAmount', totalAmount);
      files.forEach(file => formData.append('files', file));
      if (token) formData.append('token', token);

      const response = await createJob(formData);
      toast.success('Job posted successfully!');
      resetForm();
      await fetchData();
      setCurrentTab('activeJobs');
    } catch (error) {
      toast.error(error.response?.data?.error || error.message || 'Failed to post job');
    }
  };

  const viewJobDetails = async (jobId) => {
    try {
      const job = await getJob(jobId);
      setSelectedJob({
        ...job,
        messages: job.messages.filter(msg => !hiddenMessageIds.includes(msg.id)),
      });
      setCurrentTab('jobDetails');
      setAdditionalFiles([]);
    } catch (error) {
      toast.error(error.message || 'Job not found');
    }
  };

  const downloadFile = async (filename) => {
    setIsDownloading(true);
    try {
      // Ensure filename is correctly formatted
      const normalizedFilename = filename.replace(/\\/g, '/');
      await getFile(normalizedFilename);
      toast.success('File downloaded successfully!');
    } catch (error) {
      toast.error(error.message || 'Failed to download file');
      console.error('Download error:', error);
    } finally {
      setIsDownloading(false);
    }
  };

  const sendAdditionalFiles = async () => {
    if (additionalFiles.length === 0) {
      toast.error('Please select files to upload');
      return;
    }
    setIsUploading(true);
    try {
      const formData = new FormData();
      additionalFiles.forEach(file => formData.append('files', file));
      if (token) formData.append('token', token);
      formData.append('content', 'Additional files uploaded');

      await sendMessage(formData, selectedJob.id);
      const updatedJob = await getJob(selectedJob.id);
      setSelectedJob({
        ...updatedJob,
        messages: updatedJob.messages.filter(msg => !hiddenMessageIds.includes(msg.id)),
      });
      setAdditionalFiles([]);
      toast.success('Additional files uploaded successfully!');
    } catch (error) {
      toast.error(error.message || 'Failed to upload additional files');
    } finally {
      setIsUploading(false);
    }
  };

  const sendChatMessage = useCallback(async (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
    }
    if ((e.type === 'click' || (e.key === 'Enter' && !e.shiftKey)) && newChatMessage.trim()) {
      try {
        const formData = new FormData();
        formData.append('content', newChatMessage);
        if (token) formData.append('token', token);

        await sendMessage(formData);
        setNewChatMessage('');
        const messages = await getMessages();
        setChatMessages(messages.filter((msg) => !hiddenMessageIds.includes(msg.id)));
        toast.success('Message sent successfully!');
      } catch (error) {
        toast.error(error.message || 'Failed to send message');
      }
    }
  }, [newChatMessage, token, hiddenMessageIds]);

  const clearChatHistory = async () => {
    if (!window.confirm('Are you sure you want to clear all chat history?')) return;
    try {
      const clientMessages = chatMessages.filter((msg) => msg.sender_role === 'client');
      await Promise.all(clientMessages.map((msg) => deleteMessage(msg.id)));
      const allMessageIds = chatMessages.map((msg) => msg.id);
      setHiddenMessageIds(allMessageIds);
      localStorage.setItem('hiddenMessageIds', JSON.stringify(allMessageIds));
      setChatMessages([]);
      if (selectedJob) {
        setSelectedJob((prev) => ({
          ...prev,
          messages: prev.messages.filter((msg) => msg.sender_role !== 'client'),
        }));
      }
      toast.success('Chat history cleared successfully!');
    } catch (error) {
      toast.error(error.message || 'Failed to clear chat history');
    }
  };

  const saveEditedMessage = async (messageId) => {
    if (!editedMessageContent.trim()) {
      toast.error('Message cannot be empty');
      return;
    }
    try {
      await editMessage(messageId, editedMessageContent);
      setEditingMessageId(null);
      setEditedMessageContent('');
      const messages = await getMessages();
      setChatMessages(messages.filter((msg) => !hiddenMessageIds.includes(msg.id)));
      if (selectedJob) {
        const updatedJob = await getJob(selectedJob.id);
        setSelectedJob({
          ...updatedJob,
          messages: updatedJob.messages.filter(msg => !hiddenMessageIds.includes(msg.id)),
        });
      }
      toast.success('Message updated successfully!');
    } catch (error) {
      toast.error(error.message || 'Failed to edit message');
    }
  };

  const deleteChatMessage = async (messageId) => {
    if (!window.confirm('Are you sure you want to delete this message?')) return;
    try {
      await deleteMessage(messageId);
      setHiddenMessageIds((prev) => {
        const updated = [...prev, messageId];
        localStorage.setItem('hiddenMessageIds', JSON.stringify(updated));
        return updated;
      });
      setChatMessages((prev) => prev.filter((msg) => msg.id !== messageId));
      if (selectedJob) {
        setSelectedJob((prev) => ({
          ...prev,
          messages: prev.messages.filter((msg) => msg.id !== messageId),
        }));
      }
      toast.success('Message deleted successfully!');
    } catch (error) {
      toast.error(error.message || 'Failed to delete message');
    }
  };

  const startEditingMessage = (message) => {
    setEditingMessageId(message.id);
    setEditedMessageContent(message.content);
  };

  const cancelEditing = () => {
    setEditingMessageId(null);
    setEditedMessageContent('');
  };

  const removeFile = (fileName) => {
    setFiles(files.filter((file) => file.name !== fileName));
    setAdditionalFiles(additionalFiles.filter((file) => file.name !== fileName));
  };

  const generateFilePreview = (file) => {
    const fileType = file.type?.split('/')[0] || file.split('.').pop().toLowerCase();
    const fileExtension = file.name?.split('.').pop().toLowerCase() || file.split('.').pop().toLowerCase();

    if (fileType === 'image' || ['png', 'jpg', 'jpeg'].includes(fileExtension)) {
      return file instanceof File ? (
        <img src={URL.createObjectURL(file)} alt={file.name} className="file-preview" />
      ) : (
        <img src={`/Uploads/${file}`} alt={file} className="file-preview" />
      );
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
                      className="file-input"
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
                <table className="job-table">
                  <thead>
                    <tr>
                      <th>Title</th>
                      <th>Subject</th>
                      <th>Pages</th>
                      <th>Deadline</th>
                      <th>Status</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeJobs.map((job) => (
                      <tr key={job.id}>
                        <td>{job.title}</td>
                        <td>{job.subject}</td>
                        <td>{job.pages}</td>
                        <td>{new Date(job.deadline).toLocaleString()}</td>
                        <td>{job.status}</td>
                        <td>
                          <button
                            onClick={() => viewJobDetails(job.id)}
                            className="details-button"
                          >
                            Details
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p>No active jobs found.</p>
              )}
            </div>
          )}

          {currentTab === 'completedJobs' && (
            <div className="job-list">
              <h2>Completed Jobs</h2>
              {completedJobs.length > 0 ? (
                <table className="job-table">
                  <thead>
                    <tr>
                      <th>Title</th>
                      <th>Subject</th>
                      <th>Pages</th>
                      <th>Deadline</th>
                      <th>Status</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {completedJobs.map((job) => (
                      <tr key={job.id}>
                        <td>{job.title}</td>
                        <td>{job.subject}</td>
                        <td>{job.pages}</td>
                        <td>{new Date(job.deadline).toLocaleString()}</td>
                        <td>{job.status}</td>
                        <td>
                          <button
                            onClick={() => viewJobDetails(job.id)}
                            className="details-button"
                          >
                            Details
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p>No completed jobs found.</p>
              )}
            </div>
          )}

          {currentTab === 'jobDetails' && selectedJob && (
            <div className="job-details">
              <h2>Job Details</h2>
              <div className="job-details-content">
                <div className="job-details-grid">
                  <p><strong>Topic:</strong> {selectedJob.title}</p>
                  <p><strong>Subject:</strong> {selectedJob.subject}</p>
                  <p><strong>Number of Pages:</strong> {selectedJob.pages}</p>
                  <p><strong>Spacing:</strong> {selectedJob.spacing}</p>
                  <p><strong>Deadline:</strong> {new Date(selectedJob.deadline).toLocaleString()}</p>
                  <p><strong>Number of Cited Resources:</strong> {selectedJob.cited_resources}</p>
                  <p><strong>Formatting Style:</strong> {selectedJob.formatting_style}</p>
                  <p><strong>Writer Level:</strong> {selectedJob.writer_level}</p>
                  <p><strong>Status:</strong> {selectedJob.status}</p>
                </div>
                <div className="instructions">
                  <p><strong>Instructions:</strong> {selectedJob.instructions}</p>
                </div>
                {(selectedJob.files?.length > 0 || selectedJob.all_files?.length > 0) && (
                  <div>
                    <h4>Uploaded Files:</h4>
                    <div className="uploaded-files">
                      <ul>
                        {(selectedJob.all_files || selectedJob.files || []).map((file, index) => (
                          !file.includes('completed-') && (
                            <li key={index} className="uploaded-file-item">
                              <div className="file-preview-container">{generateFilePreview(file)}</div>
                              <span>{file.split('/').pop()}</span>
                              <button
                                onClick={() => downloadFile(file)}
                                disabled={isDownloading}
                                className="download-button"
                              >
                                {isDownloading ? 'Downloading...' : 'Download File'}
                              </button>
                            </li>
                          )
                        ))}
                      </ul>
                    </div>
                  </div>
                )}
                {selectedJob.status !== 'Completed' && (
                  <div className="additional-files-section">
                    <h4>Upload Additional Files</h4>
                    <input
                      type="file"
                      multiple
                      onChange={(e) => setAdditionalFiles(Array.from(e.target.files))}
                    />
                    {additionalFiles.length > 0 && (
                      <div className="uploaded-files">
                        <ul>
                          {additionalFiles.map((file, index) => (
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
                        <button 
                          onClick={sendAdditionalFiles}
                          disabled={isUploading || additionalFiles.length === 0}
                          className="upload-button"
                        >
                          {isUploading ? 'Uploading...' : 'Upload Files'}
                        </button>
                      </div>
                    )}
                  </div>
                )}
                {selectedJob.completed_files?.length > 0 && (
                  <div>
                    <h4>Completed Files:</h4>
                    <div className="uploaded-files">
                      <ul>
                        {selectedJob.completed_files.map((file, index) => (
                          <li key={index} className="uploaded-file-item">
                            <div className="file-preview-container">{generateFilePreview(file)}</div>
                            <span>{file.split('/').pop()}</span>
                            <button
                              onClick={() => downloadFile(file)}
                              disabled={isDownloading}
                              className="download-button"
                            >
                              {isDownloading ? 'Downloading...' : 'Download Completed File'}
                            </button>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}
              </div>
              <button onClick={() => setCurrentTab('activeJobs')} className="action-button">Back to Jobs</button>
            </div>
          )}
        </div>

        <div className="admin-chat">
          <h3>Chat with Admin</h3>
          <button onClick={clearChatHistory} className="auth-button">
            Clear Chat History
          </button>
          <div className="admin-messages">
            {chatMessages.length > 0 ? (
              chatMessages.map((msg) => (
                <div
                  key={msg.id}
                  className={`message ${msg.sender_role === 'client' ? 'message-sent' : 'message-received'}`}
                >
                  {editingMessageId === msg.id ? (
                    <div className="edit-message">
                      <textarea
                        value={editedMessageContent}
                        onChange={(e) => setEditedMessageContent(e.target.value)}
                        rows="3"
                      />
                      <div className="edit-actions">
                        <button onClick={() => saveEditedMessage(msg.id)}>
                          <FaSave /> Save
                        </button>
                        <button onClick={cancelEditing}>
                          <FaTimes /> Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <p><strong>{msg.sender_role === 'client' ? 'You' : 'Admin'}:</strong> {msg.content}</p>
                      <small>{new Date(msg.created_at).toLocaleString()}</small>
                      {msg.sender_role === 'client' && (
                        <div className="message-actions">
                          <button onClick={() => startEditingMessage(msg)} title="Edit">
                            <FaEdit />
                          </button>
                          <button onClick={() => deleteChatMessage(msg.id)} title="Delete">
                            <FaTrash />
                          </button>
                        </div>
                      )}
                    </>
                  )}
                </div>
              ))
            ) : (
              <p>No messages yet. Start the conversation.</p>
            )}
          </div>
          <div className="message-input">
            <textarea
              value={newChatMessage}
              onChange={(e) => setNewChatMessage(e.target.value)}
              onKeyPress={sendChatMessage}
              placeholder="Type your message to the admin..."
              rows="3"
            />
            <button
              onClick={sendChatMessage}
              disabled={!newChatMessage.trim()}
              className="send-message-button"
            >
              Send
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

export default ClientDashboard;
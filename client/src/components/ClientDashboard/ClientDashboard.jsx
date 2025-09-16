// ClientDashboard.jsx (updated)

import React, { useState, useEffect, useContext, useMemo, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
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
  getFile,
  getFileBlob,
  initiatePayment,
  getPaymentStatus,
} from '../../utils/api.js';
import toast from 'react-hot-toast';
import './ClientDashboard.css';
import { FaTrash, FaEdit, FaSave, FaTimes } from 'react-icons/fa';

const ClientDashboard = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, role, token } = useContext(AuthContext);
  const [isLoading, setIsLoading] = useState(true); // New: Track loading state

  // Form states
  const [subject, setSubject] = useState('');
  const [title, setTitle] = useState('');
  const [pages, setPages] = useState(1);
  const [deadline, setDeadline] = useState(new Date());
  const [instructions, setInstructions] = useState('');
  const [writerLevel, setWriterLevel] = useState('highschool');
  const [formattingStyle, setFormattingStyle] = useState('APA');
  const [spacing, setSpacing] = useState('double');
  const [citedResources, setCitedResources] = useState(0);
  const [files, setFiles] = useState([]);
  const [phoneNumber, setPhoneNumber] = useState(user?.phone || '+254712345678');
  const [countryCode, setCountryCode] = useState('KE');
  const [isPostingJob, setIsPostingJob] = useState(false);
  const [isPayingRemaining, setIsPayingRemaining] = useState(false);

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
  const [additionalFiles, setAdditionalFiles] = useState([]);
  const [previewUrls, setPreviewUrls] = useState({});

  const countryOptions = useMemo(() => countryList().getData(), []);

  // Updated: Initialize sockets once
  const socketJobs = useMemo(() => getSocketJobs(), []);
  const socketMessages = useMemo(() => getSocketMessages(), []);

  // Fetch previews for selected job
  useEffect(() => {
    const fetchPreviews = async () => {
      const newPreviews = {};
      const allFiles = [
        ...(selectedJob?.files || []),
        ...(selectedJob?.completed_files || []),
        ...(selectedJob?.all_files || []),
      ].filter(Boolean);

      for (const file of allFiles) {
        const ext = (typeof file === 'string' ? file.split('.').pop() : file.name.split('.').pop()).toLowerCase();
        if (['jpg', 'jpeg', 'png'].includes(ext)) {
          try {
            const blob = await getFileBlob(file);
            newPreviews[file] = URL.createObjectURL(blob);
          } catch (e) {
            console.error(`Failed to fetch preview for ${file}:`, e);
          }
        }
      }
      setPreviewUrls(newPreviews);
    };

    if (selectedJob) {
      fetchPreviews();
    }

    return () => {
      Object.values(previewUrls).forEach((url) => URL.revokeObjectURL(url));
    };
  }, [selectedJob]);

  // Updated: Load pending form data from localStorage on mount if newOrder tab
  useEffect(() => {
    if (currentTab === 'newOrder') {
      const pendingForm = localStorage.getItem('pendingJobForm');
      if (pendingForm) {
        const formData = JSON.parse(pendingForm);
        setSubject(formData.subject || '');
        setTitle(formData.title || '');
        setPages(formData.pages || 1);
        setDeadline(formData.deadline ? new Date(formData.deadline) : new Date());
        setInstructions(formData.instructions || '');
        setWriterLevel(formData.writerLevel || 'highschool');
        setFormattingStyle(formData.formattingStyle || 'APA');
        setSpacing(formData.spacing || 'double');
        setCitedResources(formData.citedResources || 0);
        setPhoneNumber(formData.phoneNumber || user?.phone || '+254712345678');
        setCountryCode(formData.countryCode || 'KE');
        toast.info('Restored previous form data due to payment issue.');
      }
    }
  }, [currentTab, user]);

  // Updated: Auth check with loading state
  useEffect(() => {
    const checkAuth = async () => {
      try {
        // Fetch user data to ensure AuthContext is populated
        await getCurrentUser();
        setIsLoading(false); // Mark loading complete
      } catch (error) {
        console.error('Auth check error:', error);
        setIsLoading(false);
        navigate('/auth');
      }
    };

    checkAuth();
  }, [navigate]);

  // Updated: Main data fetching and socket setup
  useEffect(() => {
    if (!isLoading && user && role === 'client') {
      fetchData();
    } else if (!isLoading && (!user || role !== 'client')) {
      console.log('Redirecting to /auth: user=', user, 'role=', role);
      navigate('/auth');
    }

    // Socket event listeners
    if (socketJobs) {
      socketJobs.on('new_job', (job) => {
        if (job.user_id === user?.id) {
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
        if (!hiddenMessageIds.includes(message.id) && message.client_id === user?.id) {
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
        if (!hiddenMessageIds.includes(message.id) && message.client_id === user?.id) {
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
        if (client_id === user?.id) {
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

    // Cleanup sockets on unmount
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
  }, [isLoading, user, role, navigate, selectedJob, hiddenMessageIds, socketJobs, socketMessages]);

  // Payment callback handling
  useEffect(() => {
    const orderTrackingId = searchParams.get('OrderTrackingId');
    const jobId = searchParams.get('job_id');
    const paymentType = searchParams.get('type');

    if (orderTrackingId && jobId) {
      (async () => {
        try {
          const status = await getPaymentStatus(orderTrackingId);
          if (status.payment_status === 'Completed') {
            toast.success(`${paymentType === 'completion' ? 'Remaining' : 'Upfront'} payment completed!`);
            localStorage.removeItem('pendingJobForm');
            await fetchData();
            navigate('/client-dashboard?tab=activeJobs');
          } else if (status.payment_status === 'Failed' || status.payment_status === 'Invalid') {
            toast.error(`${paymentType === 'completion' ? 'Remaining' : 'Upfront'} payment failed or was cancelled.`);
            navigate('/client-dashboard?tab=newOrder');
          } else {
            toast.error('Payment status pending. Please wait and try again.');
            navigate('/client-dashboard?tab=newOrder');
          }
        } catch (error) {
          toast.error(error.error || `Error verifying ${paymentType === 'completion' ? 'remaining' : 'upfront'} payment.`);
          navigate('/client-dashboard?tab=newOrder');
        }
      })();
    }
  }, [searchParams, navigate]);

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
      console.error('Fetch data error:', error);
      toast.error(error.error || 'Failed to load data');
      if (error.error?.includes('Token')) {
        navigate('/auth');
      }
    }
  };

  const calculateTotalAmount = () => {
    const rates = { highschool: 6, college: 9, bachelors: 12, masters: 15, phd: 18 };
    return pages * (rates[writerLevel] || 6);
  };

  const calculateUpfrontAmount = () => (calculateTotalAmount() * 0.25).toFixed(2);

  const handlePostJob = async (e) => {
    e.preventDefault();
    const currentDate = new Date();
    if (deadline <= currentDate) {
      toast.error('Deadline must be in the future');
      return;
    }

    const formData = {
      subject,
      title,
      pages,
      deadline: deadline.toISOString(),
      instructions,
      writerLevel,
      formattingStyle,
      spacing,
      citedResources,
      phoneNumber,
      countryCode,
    };
    localStorage.setItem('pendingJobForm', JSON.stringify(formData));

    setIsPostingJob(true);
    try {
      const formDataPayload = new FormData();
      formDataPayload.append('subject', subject);
      formDataPayload.append('title', title);
      formDataPayload.append('pages', pages.toString());
      formDataPayload.append('deadline', deadline.toISOString());
      formDataPayload.append('instructions', instructions);
      formDataPayload.append('writerLevel', writerLevel);
      formDataPayload.append('formattingStyle', formattingStyle);
      formDataPayload.append('spacing', spacing);
      formDataPayload.append('citedResources', citedResources.toString());
      formDataPayload.append('totalAmount', calculateTotalAmount().toString());
      formDataPayload.append('phone_number', phoneNumber);
      formDataPayload.append('country_code', countryCode);
      files.forEach((file) => formDataPayload.append('files', file));

      const response = await createJob(formDataPayload);
      if (response.redirect_url) {
        window.location.href = response.redirect_url;
      } else {
        throw new Error(response.error || 'No redirect URL received from server');
      }
    } catch (error) {
      console.error('Job creation or payment initiation error:', error);
      let errorMessage = error.error || 'Failed to create job or initiate payment';
      if (error.error?.includes('IPN not registered')) {
        errorMessage = 'Payment system not configured. Please contact support.';
      } else if (error.error?.includes('authenticate with Pesapal')) {
        errorMessage = 'Payment gateway authentication failed. Please try again later.';
      }
      toast.error(errorMessage);
    } finally {
      setIsPostingJob(false);
    }
  };

  const handleRemainingPayment = async (jobId) => {
    setIsPayingRemaining(true);
    try {
      const response = await initiatePayment({ job_id: jobId, payment_type: 'completion', phone_number: phoneNumber, country_code: countryCode });
      if (response.redirect_url) {
        window.location.href = response.redirect_url;
      } else {
        throw new Error(response.error || 'No redirect URL received for remaining payment');
      }
    } catch (error) {
      console.error('Remaining payment initiation error:', error);
      let errorMessage = error.error || 'Failed to initiate remaining payment';
      if (error.error?.includes('IPN not registered')) {
        errorMessage = 'Payment system not configured. Please contact support.';
      } else if (error.error?.includes('authenticate with Pesapal')) {
        errorMessage = 'Payment gateway authentication failed. Please try again later.';
      } else if (error.error?.includes('Invalid job or already paid')) {
        errorMessage = 'Job not eligible for payment or already paid.';
      }
      toast.error(errorMessage);
    } finally {
      setIsPayingRemaining(false);
    }
  };

  const viewJobDetails = async (jobId) => {
    try {
      const job = await getJob(jobId);
      setSelectedJob({
        ...job,
        messages: job.messages.filter((msg) => !hiddenMessageIds.includes(msg.id)),
      });
      setCurrentTab('jobDetails');
      setAdditionalFiles([]);
    } catch (error) {
      toast.error(error.error || 'Job not found');
    }
  };

  const downloadFile = async (filename) => {
    setIsDownloading(true);
    try {
      const normalizedFilename = filename.replace(/\\/g, '/');
      await getFile(normalizedFilename);
      toast.success('File downloaded successfully!');
    } catch (error) {
      toast.error(error.error || 'Failed to download file');
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
      additionalFiles.forEach((file) => formData.append('files', file));
      formData.append('content', 'Additional files uploaded');
      if (token) formData.append('token', token);

      await sendMessage(formData, selectedJob.id);
      const updatedJob = await getJob(selectedJob.id);
      setSelectedJob({
        ...updatedJob,
        messages: updatedJob.messages.filter((msg) => !hiddenMessageIds.includes(msg.id)),
      });
      setAdditionalFiles([]);
      toast.success('Additional files uploaded successfully!');
    } catch (error) {
      toast.error(error.error || 'Failed to upload additional files');
    } finally {
      setIsUploading(false);
    }
  };

  const sendChatMessage = useCallback(
    async (e) => {
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
          toast.error(error.error || 'Failed to send message');
        }
      }
    },
    [newChatMessage, token, hiddenMessageIds]
  );

  const clearChatHistory = async () => {
    if (!window.confirm('Are you sure you want to clear all chat history?')) return;
    try {
      const clientMessages = chatMessages.filter((msg) => msg.sender_role === 'client');
      await Promise.all(clientMessages.map((msg) => deleteMessage(msg.id)));
      const allMessageIds = chatMessages.map((msg) => msg.id);
      setHiddenMessageIds((prev) => {
        const updated = [...prev, ...allMessageIds];
        localStorage.setItem('hiddenMessageIds', JSON.stringify(updated));
        return updated;
      });
      setChatMessages([]);
      if (selectedJob) {
        setSelectedJob((prev) => ({
          ...prev,
          messages: prev.messages.filter((msg) => msg.sender_role !== 'client'),
        }));
      }
      toast.success('Chat history cleared successfully!');
    } catch (error) {
      toast.error(error.error || 'Failed to clear chat history');
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
          messages: updatedJob.messages.filter((msg) => !hiddenMessageIds.includes(msg.id)),
        });
      }
      toast.success('Message updated successfully!');
    } catch (error) {
      toast.error(error.error || 'Failed to edit message');
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
          messages: prev.messages.filter((m) => m.id !== messageId),
        }));
      }
      toast.success('Message deleted successfully!');
    } catch (error) {
      toast.error(error.error || 'Failed to delete message');
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
      if (file instanceof File) {
        return <img src={URL.createObjectURL(file)} alt={file.name} className="file-preview" />;
      } else {
        const previewUrl = previewUrls[file];
        if (previewUrl) {
          return <img src={previewUrl} alt={file.split('/').pop()} className="file-preview" />;
        } else {
          return (
            <div className="file-preview-icon">
              <span className="file-icon">🖼️</span>
              <span className="file-type">Image</span>
            </div>
          );
        }
      }
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

  // New: Render loading state while checking auth
  if (isLoading) {
    return <div>Loading...</div>;
  }

  return (
    <>
      <Header />
      <div className="client-dashboard-container">
        <div className="client-dashboard">
          <div className="dashboard-header">
            <h1>Dashboard</h1>
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
                        onChange={(e) => setPages(parseInt(e.target.value) || 1)}
                        required
                      />
                    </div>
                    <div className="form-group">
                      <label htmlFor="writerLevel">Education Level</label>
                      <select
                        id="writerLevel"
                        className="form-input"
                        value={writerLevel}
                        onChange={(e) => setWriterLevel(e.target.value)}
                        required
                      >
                        <option value="highschool">High School ($6/page)</option>
                        <option value="college">College ($9/page)</option>
                        <option value="bachelors">Bachelors ($12/page)</option>
                        <option value="masters">Masters ($15/page)</option>
                        <option value="phd">PhD ($18/page)</option>
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
                      <label htmlFor="countryCode">Country</label>
                      <Select
                        id="countryCode"
                        options={countryOptions}
                        value={countryOptions.find((option) => option.value === countryCode)}
                        onChange={(option) => setCountryCode(option.value)}
                        placeholder="Select Country"
                        required
                      />
                    </div>
                  </div>

                  <div className="form-group">
                    <label htmlFor="phoneNumber">Phone Number</label>
                    <input
                      id="phoneNumber"
                      className="form-input"
                      type="tel"
                      value={phoneNumber}
                      onChange={(e) => setPhoneNumber(e.target.value)}
                      placeholder="Enter your phone number"
                      required
                    />
                  </div>

                  <div className="form-row">
                    <div className="form-group">
                      <label htmlFor="formattingStyle">Formatting Style</label>
                      <select
                        id="formattingStyle"
                        className="form-input"
                        value={formattingStyle}
                        onChange={(e) => setFormattingStyle(e.target.value)}
                        required
                      >
                        <option value="APA">APA</option>
                        <option value="MLA">MLA</option>
                        <option value="Chicago">Chicago</option>
                        <option value="Harvard">Harvard</option>
                      </select>
                    </div>
                    <div className="form-group">
                      <label htmlFor="spacing">Spacing</label>
                      <select
                        id="spacing"
                        className="form-input"
                        value={spacing}
                        onChange={(e) => setSpacing(e.target.value)}
                        required
                      >
                        <option value="double">Double</option>
                        <option value="single">Single</option>
                      </select>
                    </div>
                  </div>

                  <div className="form-group">
                    <label htmlFor="citedResources">Cited Resources</label>
                    <input
                      id="citedResources"
                      className="form-input"
                      type="number"
                      min="0"
                      value={citedResources}
                      onChange={(e) => setCitedResources(parseInt(e.target.value) || 0)}
                    />
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
                  <p>Total Amount: ${calculateTotalAmount().toFixed(2)}</p>
                  <p>Upfront Payment (25%): ${calculateUpfrontAmount()}</p>
                  <button
                    type="submit"
                    className="auth-button"
                    disabled={isPostingJob}
                  >
                    {isPostingJob ? 'Processing...' : 'Pay 25% and Post Job'}
                  </button>
                </div>
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
                      <th>Payment Status</th>
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
                        <td>{job.payment_status}</td>
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
                      <th>Payment Status</th>
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
                        <td>{job.payment_status}</td>
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
                  <p><strong>Education Level:</strong> {selectedJob.writer_level}</p>
                  <p><strong>Deadline:</strong> {new Date(selectedJob.deadline).toLocaleString()}</p>
                  <p><strong>Status:</strong> {selectedJob.status}</p>
                  <p><strong>Total Amount:</strong> ${selectedJob.total_amount?.toFixed(2) || calculateTotalAmount().toFixed(2)}</p>
                  <p><strong>Payment Status:</strong> {selectedJob.payment_status || 'Pending'}</p>
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
                    {selectedJob.payment_status === 'Partial' && (
                      <button
                        onClick={() => handleRemainingPayment(selectedJob.id)}
                        className="auth-button"
                        disabled={isPayingRemaining}
                      >
                        {isPayingRemaining ? 'Processing...' : `Pay Remaining 75% ($${ (selectedJob.total_amount * 0.75).toFixed(2) })`}
                      </button>
                    )}
                    {selectedJob.payment_status === 'Completed' && (
                      <p className="payment-status">Payment Completed</p>
                    )}
                  </div>
                )}
              </div>
              <button onClick={() => setCurrentTab('activeJobs')} className="action-button">
                Back to Jobs
              </button>
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
                      <p>
                        <strong>{msg.sender_role === 'client' ? 'You' : 'Admin'}:</strong> {msg.content}
                      </p>
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
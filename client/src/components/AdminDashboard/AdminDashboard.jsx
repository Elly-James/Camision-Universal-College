import React, { useState, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../Header/Header.jsx';
import api from '../../utils/api.js';
import { AuthContext } from '../context/AuthContext.jsx';
import './AdminDashboard.css';

const AdminDashboard = () => {
  const navigate = useNavigate();
  const { user, role } = useContext(AuthContext);

  const [jobs, setJobs] = useState([]);
  const [currentTab, setCurrentTab] = useState('allJobs');
  const [selectedJob, setSelectedJob] = useState(null);
  const [newMessage, setNewMessage] = useState('');
  const [completedFiles, setCompletedFiles] = useState([]);
  const [chatMessages, setChatMessages] = useState([]);
  const [newChatMessage, setNewChatMessage] = useState('');

  useEffect(() => {
    if (!user || role !== 'admin') {
      navigate('/auth');
    } else {
      fetchJobs();
      fetchChatMessages();
    }
  }, [user, role, navigate]);

  const fetchJobs = async () => {
    try {
      const response = await api.get('/api/jobs');
      setJobs(response.data);
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

  const updateJobStatus = async (jobId, status) => {
    try {
      await api.put(`/api/jobs/${jobId}`, { status });
      fetchJobs();
      if (selectedJob && selectedJob.id === jobId) {
        const response = await api.get(`/api/jobs/${jobId}`);
        setSelectedJob(response.data);
      }
    } catch (error) {
      console.error('Failed to update job status:', error);
      alert('Failed to update job status. Please try again.');
    }
  };

  const viewJobDetails = async (jobId) => {
    try {
      const response = await api.get(`/api/jobs/${jobId}`);
      setSelectedJob(response.data);
      setCurrentTab('jobDetails');
      setNewMessage('');
      setCompletedFiles([]);
    } catch (error) {
      console.error('Failed to fetch job details:', error);
    }
  };

  const sendMessage = async () => {
    if (!newMessage.trim() && completedFiles.length === 0) return;

    try {
      const formData = new FormData();
      formData.append('content', newMessage);
      completedFiles.forEach((file) => formData.append('completed_files', file));

      await api.post(`/api/jobs/${selectedJob.id}/messages`, formData);
      const response = await api.get(`/api/jobs/${selectedJob.id}`);
      setSelectedJob(response.data);
      setNewMessage('');
      setCompletedFiles([]);
      fetchJobs();
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

  return (
    <>
      <Header />
      <div className="admin-dashboard">
        <div className="dashboard-header">
          <h1>Admin Dashboard</h1>
          <div className="user-info">
            <p>Welcome, {user?.name}</p>
          </div>
        </div>

        <div className="dashboard-tabs">
          <button
            className={currentTab === 'allJobs' ? 'tab-active' : ''}
            onClick={() => setCurrentTab('allJobs')}
          >
            All Jobs ({jobs.length})
          </button>
          <button
            className={currentTab === 'chat' ? 'tab-active' : ''}
            onClick={() => setCurrentTab('chat')}
          >
            Chat with Clients
          </button>
        </div>

        {currentTab === 'allJobs' && (
          <div className="job-list">
            <h2>All Jobs</h2>
            {jobs.length > 0 ? (
              jobs.map((job) => (
                <div key={job.id} className="job-card">
                  <h3 onClick={() => viewJobDetails(job.id)} style={{ cursor: 'pointer' }}>
                    {job.client_name}: {job.title}
                  </h3>
                  <p>Client: {job.client_name} ({job.client_email})</p>
                  <p>Subject: {job.subject}</p>
                  <p>Pages: {job.pages}</p>
                  <p>Deadline: {new Date(job.deadline).toLocaleString()}</p>
                  <p>Status: {job.status}</p>
                  <div className="status-controls">
                    <label>Update Status:</label>
                    <select
                      value={job.status}
                      onChange={(e) => updateJobStatus(job.id, e.target.value)}
                    >
                      <option value="Pending">Pending</option>
                      <option value="In Progress">In Progress</option>
                      <option value="Completed">Completed</option>
                    </select>
                  </div>
                </div>
              ))
            ) : (
              <p>No jobs available.</p>
            )}
          </div>
        )}

        {currentTab === 'jobDetails' && selectedJob && (
          <div className="job-details">
            <h2>Job Details</h2>
            <div className="job-details-content">
              <h3>{selectedJob.client_name}: {selectedJob.title}</h3>
              <p>Subject: {selectedJob.subject}</p>
              <p>Pages: {selectedJob.pages}</p>
              <p>Deadline: {new Date(selectedJob.deadline).toLocaleString()}</p>
              <p>Instructions: {selectedJob.instructions}</p>
              <p>Formatting Style: {selectedJob.formatting_style}</p>
              <p>Writer Level: {selectedJob.writer_level}</p>
              <p>Spacing: {selectedJob.spacing}</p>
              <p>Cited Resources: {selectedJob.cited_resources}</p>

              {selectedJob.files?.length > 0 && (
                <div className="files-section">
                  <h4>Original Files from Client:</h4>
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
                <div className="files-section">
                  <h4>Completed Files:</h4>
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
                <h3>Communication with Client</h3>
                {selectedJob.messages?.length > 0 ? (
                  selectedJob.messages.map((msg, index) => (
                    <div
                      key={index}
                      className={`message ${msg.sender_role === 'admin' ? 'message-sent' : 'message-received'}`}
                    >
                      <p><strong>{msg.sender_role === 'admin' ? 'You' : selectedJob.client_name}:</strong> {msg.content}</p>
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
                  <h4>Send Response to Client</h4>
                  <textarea
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    placeholder="Type your message to the client..."
                    rows="4"
                  />
                  <div className="file-upload">
                    <label>Upload Completed Work:</label>
                    <input
                      type="file"
                      multiple
                      onChange={(e) => setCompletedFiles(Array.from(e.target.files))}
                    />
                  </div>
                  <button
                    onClick={sendMessage}
                    disabled={!newMessage.trim() && completedFiles.length === 0}
                  >
                    Send Message & Files
                  </button>
                </div>
              </div>
            </div>
            <button onClick={() => setCurrentTab('allJobs')}>Back to All Jobs</button>
          </div>
        )}

        {currentTab === 'chat' && (
          <div className="chat-section">
            <h2>Chat with Clients</h2>
            <div className="messages-section">
              {chatMessages.length > 0 ? (
                chatMessages.map((msg, index) => (
                  <div
                    key={index}
                    className={`message ${msg.sender_role === 'admin' ? 'message-sent' : 'message-received'}`}
                  >
                    <p><strong>{msg.sender_role === 'admin' ? 'You' : 'Client'}:</strong> {msg.content}</p>
                    <small>{new Date(msg.created_at).toLocaleString()}</small>
                  </div>
                ))
              ) : (
                <p>No messages yet.</p>
              )}

              <div className="message-input">
                <h4>Send Message to Client</h4>
                <textarea
                  value={newChatMessage}
                  onChange={(e) => setNewChatMessage(e.target.value)}
                  placeholder="Type your message to the client..."
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
    </>
  );
};

export default AdminDashboard;
import React, { useState, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../Header/Header.jsx';
import Footer from '../Footer/Footer.jsx';
import api from '../../utils/api.js';
import { AuthContext } from '../context/AuthContext.jsx';

const AdminDashboard = () => {

  const navigate = useNavigate();
  const { user, role } = useContext(AuthContext);

  const [jobs, setJobs] = useState([]);
  const [currentTab, setCurrentTab] = useState('allJobs');
  const [selectedJob, setSelectedJob] = useState(null);
  const [newMessage, setNewMessage] = useState('');
  const [completedFiles, setCompletedFiles] = useState([]);

  useEffect(() => {
    if (!user || role !== 'admin') {
      navigate('/auth');
    } else {
      fetchJobs();
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

  const viewJobDetails = (jobId) => {
    const job = jobs.find((j) => j.id === jobId);
    if (job) {
      setSelectedJob(job);
      setCurrentTab('jobDetails');
      setNewMessage('');
      setCompletedFiles([]);
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
    } catch (error) {
      console.error('Failed to send message:', error);
      alert('Failed to send message. Please try again.');
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
        </div>

        {currentTab === 'allJobs' && (
          <div className="job-list">
            <h2>All Jobs</h2>
            {jobs.length > 0 ? (
              jobs.map((job) => (
                <div key={job.id} className="job-card" onClick={() => viewJobDetails(job.id)}>
                  <h3>{job.title}</h3>
                  <p>Subject: {job.subject}</p>
                  <p>Pages: {job.pages}</p>
                  <p>Deadline: {new Date(job.deadline).toLocaleString()}</p>
                  <p>Status: {job.status}</p>
                </div>
              ))
            ) : (
              <p>No jobs found.</p>
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
              <p>Status: {selectedJob.status}</p>
              <div className="status-buttons">
                <select
                  value={selectedJob.status}
                  onChange={(e) => updateJobStatus(selectedJob.id, e.target.value)}
                >
                  <option value="Pending">Pending</option>
                  <option value="In Progress">In Progress</option>
                  <option value="Completed">Completed</option>
                </select>
              </div>
              {selectedJob.files?.length > 0 && (
                <div>
                  <h4>Uploaded Files:</h4>
                  <ul>
                    {selectedJob.files.map((file, index) => (
                      <li key={index}>
                        <a href={`/uploads/${file}`} target="_blank" rel="noopener noreferrer">
                          File {index + 1}
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
                        <a href={`/uploads/${file}`} target="_blank" rel="noopener noreferrer">
                          Completed File {index + 1}
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
            <div className="messages-section">
              <h3>Messages</h3>
              {selectedJob.messages?.length > 0 ? (
                selectedJob.messages.map((msg, index) => (
                  <div
                    key={index}
                    className={`message ${msg.sender_role === 'admin' ? 'message-sent' : 'message-received'}`}
                  >
                    <p>{msg.content}</p>
                    <small>{new Date(msg.created_at).toLocaleString()}</small>
                  </div>
                ))
              ) : (
                <p>No messages yet.</p>
              )}
              <div className="message-input">
                <textarea
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder="Type your message..."
                />
                <input
                  type="file"
                  multiple
                  onChange={(e) => setCompletedFiles(Array.from(e.target.files))}
                />
                <button onClick={sendMessage}>Send</button>
              </div>
            </div>
            <button onClick={() => setCurrentTab('allJobs')}>Back to Jobs</button>
          </div>
        )}
      </div>
      <Footer />
    </>
  );
};

export default AdminDashboard;
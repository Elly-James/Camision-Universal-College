import React, { useState, useEffect, useContext, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../Header/Header.jsx';
import AdminJobDetails from '../AdminJobDetails/AdminJobDetails.jsx';
import { AuthContext } from '../context/AuthContext.jsx';
import { 
  getCurrentUser, 
  getJobs, 
  getJob,
  getSocketJobs, 
  getSocketMessages,
  getFile 
} from '../../utils/api.js';
import toast from 'react-hot-toast';
import './AdminDashboard.css';
import { FaTrash, FaEdit, FaSave, FaTimes } from 'react-icons/fa';

const AdminDashboard = () => {
  const navigate = useNavigate();
  const { user, role, token } = useContext(AuthContext);
  const [jobs, setJobs] = useState([]);
  const [selectedJob, setSelectedJob] = useState(null);
  const [currentTab, setCurrentTab] = useState('allJobs');
  const [isDownloading, setIsDownloading] = useState(false);

  useEffect(() => {
    if (!user || role !== 'admin') {
      navigate('/auth');
    } else {
      fetchData();
    }

    const socketJobs = getSocketJobs();
    const socketMessages = getSocketMessages();

    if (socketJobs) {
      socketJobs.on('new_job', (job) => {
        setJobs((prev) => [...prev, job]);
        toast.success('New job posted');
      });
      socketJobs.on('job_updated', (job) => {
        setJobs((prev) => prev.map((j) => (j.id === job.id ? job : j)));
        if (selectedJob && selectedJob.id === job.id) {
          setSelectedJob({
            ...job,
            messages: job.messages || selectedJob.messages,
            all_files: job.all_files || selectedJob.all_files
          });
        }
        toast.success('Job updated');
      });
    }

    if (socketMessages) {
      socketMessages.on('new_general_message', (message) => {
        if (selectedJob && message.client_id === selectedJob.user_id && message.sender_role !== 'admin') {
          setSelectedJob((prev) => ({
            ...prev,
            messages: [...(prev.messages || []), message],
            all_files: [...(prev.all_files || []), ...(message.files || [])],
          }));
          toast.success('New message received from client');
        }
      });
      socketMessages.on('message_updated', (message) => {
        if (selectedJob && selectedJob.messages?.some((m) => m.id === message.id)) {
          setSelectedJob((prev) => ({
            ...prev,
            messages: prev.messages.map((m) => (m.id === message.id ? message : m)),
          }));
          toast.success('Message updated');
        }
      });
      socketMessages.on('message_deleted', ({ message_id, client_id }) => {
        if (selectedJob && selectedJob.user_id === client_id) {
          setSelectedJob((prev) => ({
            ...prev,
            messages: prev.messages.filter((m) => m.id !== message_id),
          }));
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
  }, [user, role, navigate, selectedJob]);

  const fetchData = async () => {
    try {
      const [userData, jobsData] = await Promise.all([
        getCurrentUser(),
        getJobs(),
      ]);
      setJobs(jobsData);
    } catch (error) {
      toast.error(error.message || 'Failed to load data');
      if (error.message.includes('Token')) {
        navigate('/auth');
      }
    }
  };

  const viewJobDetails = async (jobId) => {
    try {
      const job = await getJob(jobId);
      setSelectedJob(job);
      setCurrentTab('jobDetails');
    } catch (error) {
      toast.error(error.message || 'Job not found');
    }
  };

  const downloadFile = async (filename) => {
    setIsDownloading(true);
    try {
      await getFile(filename);
      toast.success('File downloaded successfully!');
    } catch (error) {
      toast.error(error.message || 'Failed to download file');
    } finally {
      setIsDownloading(false);
    }
  };

  const generateFilePreview = (file) => {
    const fileExtension = (file.name || file).split('.').pop().toLowerCase();

    if (['png', 'jpg', 'jpeg'].includes(fileExtension)) {
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
      <div className="admin-dashboard-container">
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
              All Jobs
            </button>
            <button
              className={currentTab === 'jobDetails' ? 'tab-active' : ''}
              onClick={() => setCurrentTab('jobDetails')}
              disabled={!selectedJob}
            >
              Job Details
            </button>
          </div>

          {currentTab === 'allJobs' && (
            <div className="job-list">
              <h2>All Jobs</h2>
              {jobs.length > 0 ? (
                <table className="job-table">
                  <thead>
                    <tr>
                      <th>Title</th>
                      <th>Subject</th>
                      <th>Client</th>
                      <th>Pages</th>
                      <th>Deadline</th>
                      <th>Status</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {jobs.map((job) => (
                      <tr key={job.id}>
                        <td>{job.title}</td>
                        <td>{job.subject}</td>
                        <td>{job.client_name}</td>
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
                <p>No jobs found.</p>
              )}
            </div>
          )}

          {currentTab === 'jobDetails' && selectedJob && (
            <AdminJobDetails
              job={selectedJob}
              onBack={() => setCurrentTab('allJobs')}
              onUpdate={fetchData}
              downloadFile={downloadFile}
              generateFilePreview={generateFilePreview}
              isDownloading={isDownloading}
            />
          )}
        </div>
      </div>
    </>
  );
};

export default AdminDashboard;
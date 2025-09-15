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
  getFile,
  getBlogs,
  createBlog,
  updateBlog,
  deleteBlog,
  getSocketBlogs
} from '../../utils/api.js';
import toast from 'react-hot-toast';
import './AdminDashboard.css';
import { FaTrash, FaEdit, FaSave, FaTimes } from 'react-icons/fa';

const AdminDashboard = () => {
  const navigate = useNavigate();
  const { user, role, token } = useContext(AuthContext);
  const [jobs, setJobs] = useState([]);
  const [selectedJob, setSelectedJob] = useState(null);
  const [blogs, setBlogs] = useState([]);
  const [currentTab, setCurrentTab] = useState('allJobs');
  const [isDownloading, setIsDownloading] = useState(false);
  const [blogForm, setBlogForm] = useState({ title: '', content: '', url: '', image: '', email: '' });
  const [editingBlogId, setEditingBlogId] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchData = useCallback(async () => {
    let attempts = 0;
    const maxAttempts = 3;
    while (attempts < maxAttempts) {
      try {
        const [userData, jobsData, blogsData] = await Promise.all([
          getCurrentUser(),
          getJobs(),
          getBlogs(1),
        ]);
        setJobs(jobsData);
        setBlogs(blogsData.blogs);
        return;
      } catch (error) {
        attempts++;
        if (attempts === maxAttempts) {
          toast.error(error.message || 'Failed to load data');
          if (error.message.includes('Token')) {
            navigate('/auth');
          }
        }
        await new Promise(resolve => setTimeout(resolve, 1000 * attempts));
      }
    }
  }, [navigate]);

  useEffect(() => {
    if (!user || role !== 'admin') {
      navigate('/auth');
      return;
    }
    fetchData();

    const socketJobs = getSocketJobs();
    const socketMessages = getSocketMessages();
    const socketBlogs = getSocketBlogs();

    if (socketJobs) {
      socketJobs.on('new_job', async (job) => {
        setJobs((prev) => {
          if (!prev.some(j => j.id === job.id)) {
            return [...prev, job];
          }
          return prev;
        });
        toast.success('New job posted');
      });
      socketJobs.on('job_updated', async (job) => {
        setJobs((prev) => prev.map((j) => (j.id === job.id ? job : j)));
        if (selectedJob && selectedJob.id === job.id) {
          try {
            const updatedJob = await getJob(job.id);
            setSelectedJob({
              ...updatedJob,
              messages: updatedJob.messages || selectedJob.messages,
              all_files: updatedJob.all_files || selectedJob.all_files,
            });
          } catch (error) {
            console.error('Failed to refresh selected job:', error);
            toast.error('Failed to refresh job details');
          }
        }
        toast.success('Job updated');
      });
      socketJobs.on('payment_status_updated', async ({ job_id, payment_status }) => {
        setJobs((prev) => prev.map((j) => j.id === job_id ? { ...j, payment_status } : j));
        if (selectedJob && selectedJob.id === job_id) {
          try {
            const updatedJob = await getJob(job_id);
            setSelectedJob({
              ...updatedJob,
              messages: updatedJob.messages || selectedJob.all_files,
              all_files: updatedJob.all_files || selectedJob.all_files,
            });
          } catch (error) {
            console.error('Failed to refresh job after payment update:', error);
            toast.error('Failed to refresh job data');
          }
        }
        toast.success(`Job ${job_id} payment status updated to ${payment_status}`);
      });
    }

    if (socketMessages) {
      socketMessages.on('new_general_message', async (message) => {
        if (selectedJob && message.client_id === selectedJob.user_id && message.sender_role !== 'admin') {
          setSelectedJob((prev) => ({
            ...prev,
            messages: [...(prev.messages || []), message],
            all_files: [...(prev.all_files || []), ...(message.files || [])],
          }));
          toast.success('New message received from client');
        }
      });
      socketMessages.on('message_updated', async (message) => {
        if (selectedJob && selectedJob.messages?.some((m) => m.id === message.id)) {
          setSelectedJob((prev) => ({
            ...prev,
            messages: prev.messages.map((m) => (m.id === message.id ? message : m)),
          }));
          toast.success('Message updated');
        }
      });
      socketMessages.on('message_deleted', async ({ message_id, client_id }) => {
        if (selectedJob && selectedJob.user_id === client_id) {
          setSelectedJob((prev) => ({
            ...prev,
            messages: prev.messages.filter((m) => m.id !== message_id),
          }));
          toast.success('Message deleted');
        }
      });
    }

    if (socketBlogs) {
      socketBlogs.on('new_blog', async (blog) => {
        setBlogs((prev) => {
          if (!prev.some(b => b.id === blog.id)) {
            return [blog, ...prev];
          }
          return prev;
        });
        toast.success('New blog posted');
      });
      socketBlogs.on('blog_updated', async (blog) => {
        setBlogs((prev) => prev.map((b) => (b.id === blog.id ? blog : b)));
        toast.success('Blog updated');
      });
      socketBlogs.on('blog_deleted', async ({ blog_id }) => {
        setBlogs((prev) => prev.filter((b) => b.id !== blog_id));
        toast.success('Blog deleted');
      });
    }

    return () => {
      if (socketJobs) {
        socketJobs.off('new_job');
        socketJobs.off('job_updated');
        socketJobs.off('payment_status_updated');
      }
      if (socketMessages) {
        socketMessages.off('new_general_message');
        socketMessages.off('message_updated');
        socketMessages.off('message_deleted');
      }
      if (socketBlogs) {
        socketBlogs.off('new_blog');
        socketBlogs.off('blog_updated');
        socketBlogs.off('blog_deleted');
      }
    };
  }, [user, role, navigate, selectedJob, fetchData]);

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

  const handleBlogSubmit = async (e) => {
    e.preventDefault();
    if (isSubmitting) return;
    setIsSubmitting(true);

    try {
      const blogData = {
        title: blogForm.title,
        content: blogForm.content,
        url: blogForm.url || '',
        email: blogForm.email || '',
        image: blogForm.image || ''
      };

      if (editingBlogId) {
        await updateBlog(editingBlogId, blogData);
        toast.success('Blog updated successfully');
      } else {
        await createBlog(blogData);
        toast.success('Blog created successfully');
      }

      setBlogForm({ title: '', content: '', url: '', image: '', email: '' });
      setImagePreview(null);
      setEditingBlogId(null);

      const blogsData = await getBlogs(1);
      setBlogs(blogsData.blogs);
      
    } catch (error) {
      console.error('Blog submission error:', error);
      const errorMessage = error.details || error.message || 'Failed to save blog';
      toast.error(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleImageChange = (e) => {
    const url = e.target.value;
    setBlogForm({ ...blogForm, image: url });
    setImagePreview(url || null);
  };

  const handleEditBlog = (blog) => {
    setBlogForm({
      title: blog.title,
      content: blog.content,
      url: blog.url || '',
      image: blog.image || '',
      email: blog.email || '',
    });
    setImagePreview(blog.image || null);
    setEditingBlogId(blog.id);
  };

  const handleDeleteBlog = async (blogId) => {
    if (window.confirm('Are you sure you want to delete this blog?')) {
      try {
        await deleteBlog(blogId);
        toast.success('Blog deleted successfully');
        await fetchData();
      } catch (error) {
        toast.error(error.message || 'Failed to delete blog');
      }
    }
  };

  const handleCancelEdit = () => {
    setBlogForm({ title: '', content: '', url: '', image: '', email: '' });
    setImagePreview(null);
    setEditingBlogId(null);
  };

  const generateFilePreview = (file) => {
    const fileExtension = (file.name || file).split('.').pop().toLowerCase();

    if (['png', 'jpg', 'jpeg'].includes(fileExtension)) {
      return file instanceof File ? (
        <img src={URL.createObjectURL(file)} alt={file.name} className="file-preview" />
      ) : (
        <img src={`${API_URL}/api/files/${file}?preview=true`} alt={file} className="file-preview" />
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
              onClick={() => {
                setCurrentTab('allJobs');
                fetchData();
              }}
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
            <button
              className={currentTab === 'blogs' ? 'tab-active' : ''}
              onClick={() => {
                setCurrentTab('blogs');
                fetchData();
              }}
            >
              Blogs
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
                      <th>Payment Status</th>
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
                <p>No jobs found.</p>
              )}
            </div>
          )}

          {currentTab === 'jobDetails' && selectedJob && (
            <AdminJobDetails
              job={selectedJob}
              onBack={() => {
                setCurrentTab('allJobs');
                fetchData();
              }}
              onUpdate={fetchData}
              downloadFile={downloadFile}
              generateFilePreview={generateFilePreview}
              isDownloading={isDownloading}
            />
          )}

          {currentTab === 'blogs' && (
            <div className="blog-list">
              <h2>Manage Blogs</h2>
              <form onSubmit={handleBlogSubmit} className="blog-form mb-8">
                <div className="mb-4">
                  <label htmlFor="title" className="block text-gray-700">Title *</label>
                  <input
                    type="text"
                    id="title"
                    value={blogForm.title}
                    onChange={(e) => setBlogForm({ ...blogForm, title: e.target.value })}
                    className="w-full px-3 py-2 border rounded"
                    required
                    disabled={isSubmitting}
                  />
                </div>
                <div className="mb-4">
                  <label htmlFor="content" className="block text-gray-700">Content (Markdown Supported) *</label>
                  <textarea
                    id="content"
                    value={blogForm.content}
                    onChange={(e) => setBlogForm({ ...blogForm, content: e.target.value })}
                    className="w-full px-3 py-2 border rounded font-mono"
                    rows="10"
                    required
                    disabled={isSubmitting}
                    placeholder="Use ## for headings, * for lists, **bold**, *italic*"
                  ></textarea>
                  <p className="text-sm text-gray-600 mt-1">
                    Supports basic markdown: ## Heading, * List item, **bold**, *italic*
                  </p>
                </div>
                <div className="mb-4">
                  <label htmlFor="email" className="block text-gray-700">Email (Optional)</label>
                  <input
                    type="email"
                    id="email"
                    value={blogForm.email}
                    onChange={(e) => setBlogForm({ ...blogForm, email: e.target.value })}
                    className="w-full px-3 py-2 border rounded"
                    placeholder="contact@example.com"
                    disabled={isSubmitting}
                  />
                </div>
                <div className="mb-4">
                  <label htmlFor="url" className="block text-gray-700">URL (Optional)</label>
                  <input
                    type="url"
                    id="url"
                    value={blogForm.url}
                    onChange={(e) => setBlogForm({ ...blogForm, url: e.target.value })}
                    className="w-full px-3 py-2 border rounded"
                    placeholder="https://example.com"
                    disabled={isSubmitting}
                  />
                </div>
                <div className="mb-4">
                  <label htmlFor="image" className="block text-gray-700">Image URL (Optional)</label>
                  <input
                    type="url"
                    id="image"
                    value={blogForm.image}
                    onChange={handleImageChange}
                    className="w-full px-3 py-2 border rounded"
                    placeholder="https://example.com/image.jpg"
                    disabled={isSubmitting}
                  />
                  {imagePreview && (
                    <div className="mt-2">
                      <img
                        src={imagePreview}
                        alt="Image Preview"
                        className="w-32 h-32 object-cover rounded"
                        onError={() => {
                          setImagePreview(null);
                          toast.error('Invalid image URL');
                        }}
                      />
                      <p className="text-sm text-gray-600">Preview (loaded from URL)</p>
                    </div>
                  )}
                </div>
                <div className="flex space-x-4">
                  <button
                    type="submit"
                    className={`px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 ${isSubmitting ? 'opacity-50 cursor-not-allowed' : ''}`}
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? 'Submitting...' : editingBlogId ? <FaSave /> : 'Create Blog'}
                  </button>
                  {editingBlogId && (
                    <button
                      type="button"
                      onClick={handleCancelEdit}
                      className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
                      disabled={isSubmitting}
                    >
                      <FaTimes /> Cancel
                    </button>
                  )}
                </div>
              </form>
              <h3>Existing Blogs</h3>
              {blogs.length > 0 ? (
                <table className="blog-table w-full">
                  <thead>
                    <tr>
                      <th>Title</th>
                      <th>Author</th>
                      <th>Created At</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {blogs.map((blog) => (
                      <tr key={blog.id}>
                        <td>{blog.title}</td>
                        <td>{blog.author_name}</td>
                        <td>{new Date(blog.created_at).toLocaleString()}</td>
                        <td>
                          <button
                            onClick={() => handleEditBlog(blog)}
                            className="mr-2 text-blue-600 hover:text-blue-800"
                            disabled={isSubmitting}
                          >
                            <FaEdit />
                          </button>
                          <button
                            onClick={() => handleDeleteBlog(blog.id)}
                            className="text-red-600 hover:text-red-800"
                            disabled={isSubmitting}
                          >
                            <FaTrash />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p>No blogs found.</p>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default AdminDashboard;
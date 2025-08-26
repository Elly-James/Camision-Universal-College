import React, { useState, useContext, useEffect, useRef } from 'react';
import { AuthContext } from '../context/AuthContext.jsx';
import {
  updateJob,
  sendMessage,
  editMessage,
  deleteMessage,
  getSocketJobs,
  getSocketMessages,
  getJob,
  getMessages,
  getPaymentStatus,
} from '../../utils/api.js';
import toast from 'react-hot-toast';
import './AdminJobDetails.css';
import { FaTrash, FaEdit, FaSave, FaTimes, FaSync } from 'react-icons/fa';

const AdminJobDetails = ({ job, onBack, onUpdate, downloadFile, generateFilePreview, isDownloading }) => {
  const { user, role, token } = useContext(AuthContext);
  const [localJob, setLocalJob] = useState(job);
  const [newMessage, setNewMessage] = useState('');
  const [completedFiles, setCompletedFiles] = useState([]);
  const [editingMessageId, setEditingMessageId] = useState(null);
  const [editedMessageContent, setEditedMessageContent] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [isCheckingPayment, setIsCheckingPayment] = useState(false);
  const [hiddenMessageIds, setHiddenMessageIds] = useState(() => {
    const stored = localStorage.getItem('adminHiddenMessageIds');
    return stored ? JSON.parse(stored) : [];
  });
  const messagesEndRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [localJob.messages]);

  useEffect(() => {
    setLocalJob({
      ...job,
      messages: job.messages.filter((msg) => !hiddenMessageIds.includes(msg.id)),
      completed_files: job.completed_files || [],
      all_files: job.all_files || [],
    });

    if (!user || role !== 'admin') {
      return;
    }

    const socketJobs = getSocketJobs();
    const socketMessages = getSocketMessages();

    if (socketJobs) {
      socketJobs.on('job_updated', (updatedJob) => {
        if (updatedJob.id === localJob.id) {
          setLocalJob({
            ...updatedJob,
            messages: updatedJob.messages.filter((msg) => !hiddenMessageIds.includes(msg.id)),
            completed_files: updatedJob.completed_files || [],
            all_files: updatedJob.all_files || [],
          });
          onUpdate();
          toast.success('Job updated');
        }
      });
      socketJobs.on('payment_status_updated', async ({ job_id, payment_status, order_tracking_id }) => {
        if (job_id === localJob.id) {
          try {
            const response = await getJob(localJob.id);
            setLocalJob({
              ...response,
              messages: response.messages.filter((msg) => !hiddenMessageIds.includes(msg.id)),
              completed_files: response.completed_files || [],
              all_files: response.all_files || [],
            });
            onUpdate();
            toast.success(`Payment status updated to ${payment_status}`);
          } catch (error) {
            console.error('Failed to refresh job after payment update:', error);
            toast.error('Failed to refresh job data');
          }
        }
      });
    }

    if (socketMessages) {
      socketMessages.on('new_general_message', (message) => {
        if (
          message.client_id === localJob.user_id &&
          message.sender_role !== 'admin' &&
          !hiddenMessageIds.includes(message.id)
        ) {
          setLocalJob((prev) => ({
            ...prev,
            messages: [...(prev.messages || []), message],
            all_files: [...(prev.all_files || []), ...(message.files || [])],
            completed_files: message.files?.some((f) => f.includes('completed-'))
              ? [...(prev.completed_files || []), ...(message.files.filter((f) => f.includes('completed-')))]
              : prev.completed_files,
          }));
          toast.success('New message received from client');
        } else if (
          message.sender_role === 'admin' &&
          message.recipient_id === localJob.user_id &&
          !hiddenMessageIds.includes(message.id)
        ) {
          setLocalJob((prev) => ({
            ...prev,
            messages: [...(prev.messages || []), message],
            all_files: [...(prev.all_files || []), ...(message.files || [])],
            completed_files: message.files?.some((f) => f.includes('completed-'))
              ? [...(prev.completed_files || []), ...(message.files.filter((f) => f.includes('completed-')))]
              : prev.completed_files,
          }));
          toast.success('Your message sent successfully');
        }
      });
      socketMessages.on('message_updated', (message) => {
        if (localJob.messages?.some((m) => m.id === message.id) && !hiddenMessageIds.includes(message.id)) {
          setLocalJob((prev) => ({
            ...prev,
            messages: prev.messages.map((m) => (m.id === message.id ? message : m)),
          }));
          toast.success('Message updated');
        }
      });
      socketMessages.on('message_deleted', ({ message_id, client_id }) => {
        if (client_id === localJob.user_id) {
          setHiddenMessageIds((prev) => {
            const updated = [...prev, message_id];
            localStorage.setItem('adminHiddenMessageIds', JSON.stringify(updated));
            return updated;
          });
          setLocalJob((prev) => ({
            ...prev,
            messages: prev.messages.filter((m) => m.id !== message_id),
          }));
          toast.success('Message deleted');
        }
      });
    }

    return () => {
      if (socketJobs) {
        socketJobs.off('job_updated');
        socketJobs.off('payment_status_updated');
      }
      if (socketMessages) {
        socketMessages.off('new_general_message');
        socketMessages.off('message_updated');
        socketMessages.off('message_deleted');
      }
    };
  }, [job, user, role, localJob.id, localJob.user_id, onUpdate, hiddenMessageIds]);

  const updateJobStatus = async (status) => {
    try {
      await updateJob(localJob.id, { status });
      const response = await getJob(localJob.id);
      setLocalJob({
        ...response,
        messages: response.messages.filter((msg) => !hiddenMessageIds.includes(msg.id)),
        completed_files: response.completed_files || [],
        all_files: response.all_files || [],
      });
      onUpdate();
      toast.success('Job status updated successfully!');
    } catch (error) {
      console.error('Job status update failed:', error);
      toast.error(error.error || 'Failed to update job status');
    }
  };

  const checkPaymentStatus = async () => {
    if (!localJob.order_tracking_id && !localJob.completion_tracking_id) {
      toast.error('No payment tracking ID available');
      return;
    }
    setIsCheckingPayment(true);
    try {
      const trackingId = localJob.completion_tracking_id || localJob.order_tracking_id;
      const response = await getPaymentStatus(trackingId);
      if (response.payment_status !== localJob.payment_status) {
        const jobResponse = await getJob(localJob.id);
        setLocalJob({
          ...jobResponse,
          messages: jobResponse.messages.filter((msg) => !hiddenMessageIds.includes(msg.id)),
          completed_files: jobResponse.completed_files || [],
          all_files: jobResponse.all_files || [],
        });
        onUpdate();
        toast.success(`Payment status updated to ${response.payment_status}`);
      } else {
        toast.info('No change in payment status');
      }
    } catch (error) {
      console.error('Payment status check failed:', error);
      toast.error(error.error || 'Failed to check payment status');
    } finally {
      setIsCheckingPayment(false);
    }
  };

  const sendJobMessage = async () => {
    if (!newMessage.trim()) {
      toast.error('Message content required');
      return;
    }
    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append('content', newMessage);
      if (token) formData.append('token', token);

      await sendMessage(formData, localJob.id);
      const response = await getJob(localJob.id);
      setLocalJob({
        ...response,
        messages: response.messages.filter((msg) => !hiddenMessageIds.includes(msg.id)),
        completed_files: response.completed_files || [],
        all_files: response.all_files || [],
      });
      setNewMessage('');
      toast.success('Message sent successfully!');
    } catch (error) {
      console.error('Send message failed:', error);
      toast.error(error.error || 'Failed to send message');
    } finally {
      setIsUploading(false);
    }
  };

  const uploadCompletedFiles = async () => {
    if (completedFiles.length === 0) {
      toast.error('Please select files to upload');
      return;
    }
    setIsUploading(true);
    try {
      const formData = new FormData();
      completedFiles.forEach((file) => formData.append('completed_files', file));
      if (token) formData.append('token', token);
      formData.append('content', 'Completed files uploaded');

      await sendMessage(formData, localJob.id);
      const response = await getJob(localJob.id);
      setLocalJob({
        ...response,
        messages: response.messages.filter((msg) => !hiddenMessageIds.includes(msg.id)),
        completed_files: response.completed_files || [],
        all_files: response.all_files || [],
      });
      setCompletedFiles([]);
      toast.success('Completed files uploaded successfully!');
      if (localJob.status !== 'Completed') {
        await updateJobStatus('Completed');
      }
    } catch (error) {
      console.error('Upload completed files failed:', error);
      toast.error(error.error || 'Failed to upload completed files');
    } finally {
      setIsUploading(false);
    }
  };

  const startEditingMessage = (message) => {
    setEditingMessageId(message.id);
    setEditedMessageContent(message.content);
  };

  const saveEditedMessage = async (messageId) => {
    if (!editedMessageContent.trim()) {
      toast.error('Message cannot be empty');
      return;
    }
    try {
      await editMessage(messageId, editedMessageContent);
      const response = await getJob(localJob.id);
      setLocalJob({
        ...response,
        messages: response.messages.filter((msg) => !hiddenMessageIds.includes(msg.id)),
        completed_files: response.completed_files || [],
        all_files: response.all_files || [],
      });
      setEditingMessageId(null);
      setEditedMessageContent('');
      toast.success('Message updated successfully!');
    } catch (error) {
      console.error('Edit message failed:', error);
      toast.error(error.error || 'Failed to edit message');
    }
  };

  const deleteChatMessage = async (messageId) => {
    if (!window.confirm('Are you sure you want to delete this message?')) return;
    try {
      await deleteMessage(messageId);
      setHiddenMessageIds((prev) => {
        const updated = [...prev, messageId];
        localStorage.setItem('adminHiddenMessageIds', JSON.stringify(updated));
        return updated;
      });
      setLocalJob((prev) => ({
        ...prev,
        messages: prev.messages.filter((m) => m.id !== messageId),
      }));
      toast.success('Message deleted successfully!');
    } catch (error) {
      console.error('Delete message failed:', error);
      toast.error(error.error || 'Failed to delete message');
    }
  };

  const clearChatHistory = async () => {
    if (!window.confirm('Are you sure you want to clear all admin messages for this client?')) return;
    try {
      const adminMessages = localJob.messages.filter((msg) => msg.sender_role === 'admin');
      await Promise.all(adminMessages.map((msg) => deleteMessage(msg.id)));
      const allMessageIds = localJob.messages.map((msg) => msg.id);
      setHiddenMessageIds((prev) => {
        const updated = [...prev, ...allMessageIds];
        localStorage.setItem('adminHiddenMessageIds', JSON.stringify(updated));
        return updated;
      });
      setLocalJob((prev) => ({
        ...prev,
        messages: [],
      }));
      toast.success('Chat history cleared successfully!');
    } catch (error) {
      console.error('Clear chat history failed:', error);
      toast.error(error.error || 'Failed to clear chat history');
    }
  };

  const removeFile = (fileName) => {
    setCompletedFiles(completedFiles.filter((file) => file.name !== fileName));
  };

  return (
    <div className="job-details">
      <div className="job-details-header">
        <h2>Job Details</h2>
        <button onClick={onBack} className="action-button back-button">
          Back to Jobs
        </button>
      </div>
      <div className="job-details-content">
        <div className="job-details-card">
          <h3>Job Information</h3>
          <div className="job-details-grid">
            <p><strong>Topic:</strong> {localJob.title}</p>
            <p><strong>Subject:</strong> {localJob.subject}</p>
            <p><strong>Client:</strong> {localJob.client_name}</p>
            <p><strong>Client Email:</strong> {localJob.client_email}</p>
            <p><strong>Pages:</strong> {localJob.pages}</p>
            <p><strong>Spacing:</strong> {localJob.spacing}</p>
            <p><strong>Deadline:</strong> {new Date(localJob.deadline).toLocaleString()}</p>
            <p><strong>Cited Resources:</strong> {localJob.cited_resources}</p>
            <p><strong>Formatting Style:</strong> {localJob.formatting_style}</p>
            <p><strong>Writer Level:</strong> {localJob.writer_level}</p>
            <p><strong>Status:</strong> {localJob.status}</p>
            <p><strong>Total Amount:</strong> ${localJob.total_amount}</p>
            <p><strong>Payment Status:</strong> {localJob.payment_status}</p>
          </div>
        </div>

        <div className="job-details-card">
          <h3>Instructions</h3>
          <div className="instructions">
            <p>{localJob.instructions}</p>
          </div>
        </div>

        <div className="job-details-card">
          <h3>Status Update</h3>
          <div className="status-update">
            <select
              value={localJob.status}
              onChange={(e) => updateJobStatus(e.target.value)}
              className="form-input"
            >
              <option value="Pending Payment">Pending Payment</option>
              <option value="In Progress">In Progress</option>
              <option value="Completed">Completed</option>
            </select>
          </div>
        </div>

        <div className="job-details-card">
          <h3>Payment Status</h3>
          <div className="payment-status">
            <button
              onClick={checkPaymentStatus}
              disabled={isCheckingPayment || (!localJob.order_tracking_id && !localJob.completion_tracking_id)}
              className="action-button"
            >
              {isCheckingPayment ? 'Checking...' : 'Check Payment Status'}
              <FaSync style={{ marginLeft: '5px' }} />
            </button>
          </div>
        </div>

        {localJob.files?.length > 0 && (
          <div className="job-details-card">
            <h3>Initial Files</h3>
            <div className="uploaded-files">
              <ul>
                {localJob.files.map((file, index) => (
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
                ))}
              </ul>
            </div>
          </div>
        )}

        {localJob.all_files?.filter((file) => file.includes('additional-')).length > 0 && (
          <div className="job-details-card">
            <h3>Additional Files</h3>
            <div className="uploaded-files">
              <ul>
                {localJob.all_files
                  .filter((file) => file.includes('additional-'))
                  .map((file, index) => (
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
                  ))}
              </ul>
            </div>
          </div>
        )}

        {localJob.messages?.some((msg) => msg.files?.length > 0) && (
          <div className="job-details-card">
            <h3>Message Files</h3>
            <div className="uploaded-files">
              <ul>
                {localJob.messages
                  .filter((msg) => msg.files?.length > 0)
                  .flatMap((msg) => msg.files)
                  .filter((file) => !file.includes('completed-') && !file.includes('additional-'))
                  .map((file, index) => (
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
                  ))}
              </ul>
            </div>
          </div>
        )}

        <div className="job-details-card messages-section">
          <h3>Communication with Client</h3>
          {localJob.messages?.length > 0 ? (
            <div className="admin-messages">
              {localJob.messages
                .sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
                .map((msg) => (
                  <div
                    key={msg.id}
                    className={`message ${msg.sender_role === 'admin' ? 'message-sent' : 'message-received'}`}
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
                          <button onClick={() => setEditingMessageId(null)}>
                            <FaTimes /> Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <p>
                          <strong>{msg.sender_role === 'admin' ? 'You' : 'Client'}:</strong> {msg.content}
                        </p>
                        <small>{new Date(msg.created_at).toLocaleString()}</small>
                        {msg.sender_role === 'admin' && (
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
                ))}
              <div ref={messagesEndRef} />
            </div>
          ) : (
            <p>No messages yet. Start the conversation.</p>
          )}

          <div className="message-input">
            <h4>Send Message to Client</h4>
            <textarea
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="Type your message to the client..."
              rows="4"
            />
            <div className="message-actions">
              <button
                onClick={sendJobMessage}
                disabled={isUploading || !newMessage.trim()}
                className="send-message-button"
              >
                {isUploading ? 'Sending...' : 'Send'}
              </button>
              <button
                onClick={clearChatHistory}
                className="action-button clear-chat"
              >
                Clear Chat History
              </button>
            </div>
          </div>
        </div>

        <div className="job-details-card">
          <h3>Upload Completed Files</h3>
          <div className="file-upload">
            <input
              id="completedFiles"
              type="file"
              multiple
              onChange={(e) => setCompletedFiles(Array.from(e.target.files))}
            />
            {completedFiles.length > 0 && (
              <div className="uploaded-files">
                <ul>
                  {completedFiles.map((file, index) => (
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
                  onClick={uploadCompletedFiles}
                  disabled={isUploading || completedFiles.length === 0}
                  className="upload-button"
                >
                  {isUploading ? 'Uploading...' : 'Upload File'}
                </button>
              </div>
            )}
          </div>
        </div>

        {localJob.completed_files?.length > 0 && (
          <div className="job-details-card">
            <h3>Completed Files</h3>
            <div className="uploaded-files">
              <ul>
                {localJob.completed_files.map((file, index) => (
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
      <div className="payment-status-button">
        <button className="payment-status">
          Remaining 75% Payment: {localJob.payment_status === 'Completed' ? 'Paid' : localJob.payment_status}
        </button>
      </div>
    </div>
  );
};

export default AdminJobDetails;
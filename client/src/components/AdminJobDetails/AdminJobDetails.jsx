import React, { useState } from 'react';
import api from "../../utils/api";

const AdminJobDetails = ({ job, onBack, onUpdate }) => {
  const [newMessage, setNewMessage] = useState('');
  const [localJob, setLocalJob] = useState(job);

  const updateJobStatus = async (status) => {
    try {
      await api.put(`/api/jobs/${job.id}`, { status });
      const response = await api.get(`/api/jobs/${job.id}`);
      setLocalJob(response.data);
      onUpdate();
    } catch (error) {
      console.error('Failed to update job status:', error);
      alert('Failed to update job status. Please try again.');
    }
  };

  const sendMessage = async () => {
    if (!newMessage.trim()) return;
    try {
      await api.post(`/api/jobs/${job.id}/messages`, { content: newMessage });
      const response = await api.get(`/api/jobs/${job.id}`);
      setLocalJob(response.data);
      setNewMessage('');
    } catch (error) {
      console.error('Failed to send message:', error);
      alert('Failed to send message. Please try again.');
    }
  };

  return (
    <div className="job-details">
      <h2>Job Details</h2>
      <div className="job-details-content">
        <h3>{localJob.title}</h3>
        <p>Subject: {localJob.subject}</p>
        <p>Pages: {localJob.pages}</p>
        <p>Deadline: {new Date(localJob.deadline).toLocaleString()}</p>
        <p>Instructions: {localJob.instructions}</p>
        <p>Status: {localJob.status}</p>
        {localJob.files?.length > 0 && (
          <div>
            <h4>Uploaded Files:</h4>
            <ul>
              {localJob.files.map((file, index) => (
                <li key={index}>
                  <a href={`/uploads/${file}`} target="_blank" rel="noopener noreferrer">
                    File {index + 1}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <div className="status-actions">
        <h3>Update Status</h3>
        <select
          value={localJob.status}
          onChange={(e) => updateJobStatus(e.target.value)}
        >
          <option value="Pending">Pending</option>
          <option value="In Progress">In Progress</option>
          <option value="Completed">Completed</option>
        </select>
      </div>

      <div className="messages-section">
        <h3>Messages</h3>
        {localJob.messages?.length > 0 ? (
          localJob.messages.map((msg, index) => (
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
          <button onClick={sendMessage}>Send</button>
        </div>
      </div>

      <button onClick={onBack}>Back to Jobs</button>
    </div>
  );
};

export default AdminJobDetails;
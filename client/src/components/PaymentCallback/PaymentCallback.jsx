import React, { useEffect, useState, useContext } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext.jsx';
import toast from 'react-hot-toast';
import './PaymentCallback.css';

const PaymentCallback = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useContext(AuthContext);
  const [paymentStatus, setPaymentStatus] = useState('processing');

  useEffect(() => {
    if (!user || user.role !== 'client') {
      navigate('/auth');
      return;
    }

    const orderTrackingId = searchParams.get('OrderTrackingId');
    const paymentType = searchParams.get('type');

    if (!orderTrackingId) {
      setPaymentStatus('error');
      toast.error('Invalid payment response');
      return;
    }

    // Defer payment verification to ClientDashboard to avoid duplicate API calls
    setTimeout(() => {
      setPaymentStatus('redirecting');
      navigate(
        `/client-dashboard?tab=${
          paymentType === 'completion' ? 'completedJobs' : 'activeJobs'
        }&OrderTrackingId=${orderTrackingId}&job_id=${searchParams.get('job_id')}&type=${paymentType}`
      );
    }, 2000); // Show processing briefly for UX
  }, [searchParams, user, navigate]);

  return (
    <div className="payment-callback-container">
      <div className="payment-callback-card">
        <h2>Payment Processing</h2>

        {paymentStatus === 'processing' && (
          <div className="payment-status processing">
            <div className="spinner"></div>
            <p>Verifying your payment...</p>
          </div>
        )}

        {paymentStatus === 'redirecting' && (
          <div className="payment-status processing">
            <div className="spinner"></div>
            <p>Redirecting to dashboard...</p>
          </div>
        )}

        {paymentStatus === 'error' && (
          <div className="payment-status error">
            <div className="error-icon">⚠️</div>
            <h3>Payment Error</h3>
            <p>There was an error processing your payment. Please contact support.</p>
            <button
              onClick={() => navigate('/client-dashboard?tab=newOrder')}
              className="continue-button"
            >
              Return to Dashboard
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default PaymentCallback;
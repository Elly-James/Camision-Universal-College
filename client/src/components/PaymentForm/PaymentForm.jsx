import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { CardElement, useStripe, useElements } from '@stripe/react-stripe-js';
import api from "../../utils/api";

const PaymentForm = () => {
  const stripe = useStripe();
  const elements = useElements();
  const navigate = useNavigate();
  const location = useLocation();
  const { jobData } = location.state || {};
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const handlePaymentSubmit = async (e) => {
    e.preventDefault();
    if (!stripe || !elements || !jobData) return;

    setLoading(true);
    setError(null);

    try {
      const { totalAmount, files, ...rest } = jobData;
      const response = await api.post('/api/create-payment-intent', {
        amount: Math.round(totalAmount * 100), // Convert to cents
      });

      const { client_secret } = response.data;

      const { error: stripeError, paymentIntent } = await stripe.confirmCardPayment(client_secret, {
        payment_method: {
          card: elements.getElement(CardElement),
          billing_details: {
            email: localStorage.getItem('email'),
          },
        },
      });

      if (stripeError) {
        setError(stripeError.message);
        setLoading(false);
        return;
      }

      if (paymentIntent.status === 'succeeded') {
        const formData = new FormData();
        Object.entries(rest).forEach(([key, value]) => {
          formData.append(key, value);
        });
        files.forEach((file) => formData.append('files', file));
        formData.append('payment_intent_id', paymentIntent.id);

        await api.post('/api/jobs', formData);
        alert('Payment successful! Job posted.');
        navigate('/client-dashboard');
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Payment failed. Please try again.');
      setLoading(false);
    }
  };

  if (!jobData) {
    return <div>Error: No job data provided.</div>;
  }

  return (
    <div className="payment-form">
      <h2>Payment Details</h2>
      <p>Total Amount: ${jobData.totalAmount.toFixed(2)}</p>
      {error && <div className="error-message">{error}</div>}
      <form onSubmit={handlePaymentSubmit}>
        <CardElement options={{ hidePostalCode: true }} />
        <button type="submit" disabled={loading || !stripe || !elements}>
          {loading ? 'Processing...' : 'Pay Now'}
        </button>
      </form>
    </div>
  );
};

export default PaymentForm;
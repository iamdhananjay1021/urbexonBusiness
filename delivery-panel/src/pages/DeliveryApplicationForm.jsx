/**
 * DeliveryApplicationForm.jsx — Multi-step Delivery Partner Application
 * Handles complete application workflow with validation
 */

import { useState, useEffect } from 'react';
import axios from 'axios';
import '../styles/DeliveryApplicationForm.css';

const STEPS = ['Personal', 'Address', 'Vehicle', 'Bank', 'Review'];

export default function DeliveryApplicationForm() {
  const [currentStep, setCurrentStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [formData, setFormData] = useState({
    // Personal Info
    fullName: '',
    phone: '',
    email: '',
    dateOfBirth: '',
    gender: '',

    // Address
    area: '',
    landmark: '',
    city: '',
    state: '',
    pincode: '',
    latitude: null,
    longitude: null,

    // Vehicle
    vehicleType: 'motorcycle',
    vehicleNumber: '',
    vehicleModel: '',

    // Bank
    accountHolder: '',
    accountNumber: '',
    ifsc: '',
    bankName: '',
    upiId: '',
  });

  // Get user location
  const getLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setFormData((prev) => ({
            ...prev,
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          }));
          alert('Location captured successfully');
        },
        (error) => {
          console.error('Geolocation error:', error);
          alert('Unable to get your location. Please enter manually.');
        }
      );
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
    setError(null);
  };

  const validateStep = () => {
    switch (currentStep) {
      case 0: // Personal
        if (!formData.fullName.trim()) return 'Full name is required';
        if (!formData.phone.match(/^[6-9]\d{9}$/)) return 'Valid 10-digit phone required';
        if (!formData.email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) return 'Valid email required';
        if (!formData.dateOfBirth) return 'Date of birth is required';
        if (!formData.gender) return 'Gender is required';
        return null;

      case 1: // Address
        if (!formData.area.trim()) return 'Area is required';
        if (!formData.city.trim()) return 'City is required';
        if (!formData.pincode.match(/^\d{6}$/)) return 'Valid 6-digit pincode required';
        if (!formData.latitude || !formData.longitude) return 'Location coordinates required';
        return null;

      case 2: // Vehicle
        if (!formData.vehicleType) return 'Vehicle type is required';
        if (!formData.vehicleNumber.trim()) return 'Vehicle number is required';
        return null;

      case 3: // Bank
        if (!formData.accountHolder.trim()) return 'Account holder name is required';
        if (!formData.accountNumber.match(/^\d{9,18}$/)) return 'Valid account number required';
        if (!formData.ifsc.match(/^[A-Z]{4}0[A-Z0-9]{6}$/)) return 'Valid IFSC code required';
        if (!formData.bankName.trim()) return 'Bank name is required';
        return null;

      default:
        return null;
    }
  };

  const handleNext = () => {
    const validationError = validateStep();
    if (validationError) {
      setError(validationError);
      return;
    }
    setCurrentStep((prev) => prev + 1);
    setError(null);
  };

  const handlePrevious = () => {
    setCurrentStep((prev) => prev - 1);
    setError(null);
  };

  const handleSubmit = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await axios.post('/api/delivery/application/submit', {
        personal: {
          fullName: formData.fullName,
          phone: formData.phone,
          email: formData.email,
          dateOfBirth: formData.dateOfBirth,
          gender: formData.gender,
        },
        address: {
          area: formData.area,
          landmark: formData.landmark,
          city: formData.city,
          state: formData.state,
          pincode: formData.pincode,
          latitude: formData.latitude,
          longitude: formData.longitude,
        },
        vehicle: {
          vehicleType: formData.vehicleType,
          vehicleNumber: formData.vehicleNumber,
          vehicleModel: formData.vehicleModel,
        },
        bank: {
          accountHolder: formData.accountHolder,
          accountNumber: formData.accountNumber,
          ifsc: formData.ifsc,
          bankName: formData.bankName,
          upiId: formData.upiId,
        },
      });

      if (response.data.success) {
        setSuccess(true);
      } else {
        setError(response.data.message || 'Submission failed');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Error submitting application');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="application-success">
        <div className="success-card">
          <div className="success-icon">✅</div>
          <h2>Application Submitted Successfully</h2>
          <p>Your delivery partner application has been submitted for review.</p>
          <p>Our team will review your application within 24-48 hours.</p>
          <p>You will receive a notification once your application is reviewed.</p>
          <button onClick={() => window.location.href = '/delivery/dashboard'}>
            Go to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="delivery-application-form">
      <div className="form-container">
        <div className="form-header">
          <h1>Delivery Partner Application</h1>
          <p>Complete your profile to start delivering with us</p>
        </div>

        {/* Progress Indicator */}
        <div className="progress-indicator">
          {STEPS.map((step, index) => (
            <div
              key={index}
              className={`step ${
                index < currentStep ? 'completed' : index === currentStep ? 'active' : 'pending'
              }`}
            >
              <div className="step-number">{index < currentStep ? '✓' : index + 1}</div>
              <div className="step-name">{step}</div>
            </div>
          ))}
        </div>

        {/* Error Message */}
        {error && <div className="error-message">{error}</div>}

        {/* Form Content */}
        <div className="form-content">
          {currentStep === 0 && (
            <div className="step-content">
              <h2>Personal Information</h2>
              <div className="form-group">
                <label>Full Name *</label>
                <input
                  type="text"
                  name="fullName"
                  value={formData.fullName}
                  onChange={handleInputChange}
                  placeholder="Enter your full name"
                />
              </div>

              <div className="form-group">
                <label>Phone Number *</label>
                <input
                  type="tel"
                  name="phone"
                  value={formData.phone}
                  onChange={handleInputChange}
                  placeholder="10-digit phone number"
                  maxLength="10"
                />
              </div>

              <div className="form-group">
                <label>Email Address *</label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  placeholder="your@email.com"
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Date of Birth *</label>
                  <input
                    type="date"
                    name="dateOfBirth"
                    value={formData.dateOfBirth}
                    onChange={handleInputChange}
                  />
                </div>

                <div className="form-group">
                  <label>Gender *</label>
                  <select name="gender" value={formData.gender} onChange={handleInputChange}>
                    <option value="">Select Gender</option>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="other">Other</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {currentStep === 1 && (
            <div className="step-content">
              <h2>Address Information</h2>
              <div className="form-group">
                <label>Area/Locality *</label>
                <input
                  type="text"
                  name="area"
                  value={formData.area}
                  onChange={handleInputChange}
                  placeholder="Your area or locality"
                />
              </div>

              <div className="form-group">
                <label>Landmark</label>
                <input
                  type="text"
                  name="landmark"
                  value={formData.landmark}
                  onChange={handleInputChange}
                  placeholder="Nearby landmark (optional)"
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>City *</label>
                  <input
                    type="text"
                    name="city"
                    value={formData.city}
                    onChange={handleInputChange}
                    placeholder="City name"
                  />
                </div>

                <div className="form-group">
                  <label>State *</label>
                  <input
                    type="text"
                    name="state"
                    value={formData.state}
                    onChange={handleInputChange}
                    placeholder="State name"
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Pincode *</label>
                <input
                  type="text"
                  name="pincode"
                  value={formData.pincode}
                  onChange={handleInputChange}
                  placeholder="6-digit pincode"
                  maxLength="6"
                />
              </div>

              <div className="location-section">
                <button type="button" className="btn-location" onClick={getLocation}>
                  📍 Capture Location
                </button>
                {formData.latitude && formData.longitude && (
                  <div className="location-info">
                    ✅ Location captured: ({formData.latitude.toFixed(4)}, {formData.longitude.toFixed(4)})
                  </div>
                )}
              </div>
            </div>
          )}

          {currentStep === 2 && (
            <div className="step-content">
              <h2>Vehicle Information</h2>
              <div className="form-group">
                <label>Vehicle Type *</label>
                <select name="vehicleType" value={formData.vehicleType} onChange={handleInputChange}>
                  <option value="bicycle">Bicycle</option>
                  <option value="scooter">Scooter</option>
                  <option value="motorcycle">Motorcycle</option>
                  <option value="car">Car</option>
                  <option value="ev">Electric Vehicle</option>
                </select>
              </div>

              <div className="form-group">
                <label>Vehicle Number *</label>
                <input
                  type="text"
                  name="vehicleNumber"
                  value={formData.vehicleNumber}
                  onChange={handleInputChange}
                  placeholder="e.g., DL01AB1234"
                  style={{ textTransform: 'uppercase' }}
                />
              </div>

              <div className="form-group">
                <label>Vehicle Model</label>
                <input
                  type="text"
                  name="vehicleModel"
                  value={formData.vehicleModel}
                  onChange={handleInputChange}
                  placeholder="e.g., Honda CB350"
                />
              </div>
            </div>
          )}

          {currentStep === 3 && (
            <div className="step-content">
              <h2>Bank Account Details</h2>
              <div className="form-group">
                <label>Account Holder Name *</label>
                <input
                  type="text"
                  name="accountHolder"
                  value={formData.accountHolder}
                  onChange={handleInputChange}
                  placeholder="As per bank records"
                />
              </div>

              <div className="form-group">
                <label>Account Number *</label>
                <input
                  type="text"
                  name="accountNumber"
                  value={formData.accountNumber}
                  onChange={handleInputChange}
                  placeholder="9-18 digit account number"
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>IFSC Code *</label>
                  <input
                    type="text"
                    name="ifsc"
                    value={formData.ifsc}
                    onChange={handleInputChange}
                    placeholder="e.g., SBIN0001234"
                    style={{ textTransform: 'uppercase' }}
                  />
                </div>

                <div className="form-group">
                  <label>Bank Name *</label>
                  <input
                    type="text"
                    name="bankName"
                    value={formData.bankName}
                    onChange={handleInputChange}
                    placeholder="Bank name"
                  />
                </div>
              </div>

              <div className="form-group">
                <label>UPI ID (Optional)</label>
                <input
                  type="text"
                  name="upiId"
                  value={formData.upiId}
                  onChange={handleInputChange}
                  placeholder="e.g., yourname@upi"
                />
              </div>
            </div>
          )}

          {currentStep === 4 && (
            <div className="step-content">
              <h2>Review Your Application</h2>
              <div className="review-section">
                <h3>Personal Information</h3>
                <p><strong>Name:</strong> {formData.fullName}</p>
                <p><strong>Phone:</strong> {formData.phone}</p>
                <p><strong>Email:</strong> {formData.email}</p>
              </div>

              <div className="review-section">
                <h3>Address</h3>
                <p><strong>Area:</strong> {formData.area}</p>
                <p><strong>City:</strong> {formData.city}, {formData.state} {formData.pincode}</p>
                <p><strong>Location:</strong> {formData.latitude ? `(${formData.latitude.toFixed(4)}, ${formData.longitude.toFixed(4)})` : 'Not set'}</p>
              </div>

              <div className="review-section">
                <h3>Vehicle</h3>
                <p><strong>Type:</strong> {formData.vehicleType}</p>
                <p><strong>Number:</strong> {formData.vehicleNumber}</p>
              </div>

              <div className="review-section">
                <h3>Bank Account</h3>
                <p><strong>Holder:</strong> {formData.accountHolder}</p>
                <p><strong>Bank:</strong> {formData.bankName}</p>
                <p><strong>Account (Last 4):</strong> ****{formData.accountNumber.slice(-4)}</p>
              </div>

              <div className="confirmation-message">
                <input type="checkbox" id="agree" />
                <label htmlFor="agree">
                  I confirm that all the information provided is accurate and correct
                </label>
              </div>
            </div>
          )}
        </div>

        {/* Navigation Buttons */}
        <div className="form-navigation">
          <button
            className="btn btn-secondary"
            onClick={handlePrevious}
            disabled={currentStep === 0 || loading}
          >
            ← Previous
          </button>

          {currentStep < STEPS.length - 1 ? (
            <button
              className="btn btn-primary"
              onClick={handleNext}
              disabled={loading}
            >
              Next →
            </button>
          ) : (
            <button
              className="btn btn-submit"
              onClick={handleSubmit}
              disabled={loading}
            >
              {loading ? 'Submitting...' : '✓ Submit Application'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

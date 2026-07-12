/**
 * useDeliveryWebSocket.js — Delivery realtime event handler
 * Manages all WebSocket events for delivery system
 */

import { useEffect, useCallback } from 'react';
import { useWebSocket } from './useWebSocket';

export const useDeliveryWebSocket = (onEvents = {}) => {
  const { ws, isConnected } = useWebSocket();

  useEffect(() => {
    if (!ws) return;

    const handleMessage = (event) => {
      try {
        const message = JSON.parse(event.data);

        // Application Events
        if (message.type === 'delivery:application_submitted') {
          onEvents.onApplicationSubmitted?.(message);
          console.log('📝 Application submitted:', message);
        }

        if (message.type === 'delivery:application_status_changed') {
          onEvents.onApplicationStatusChanged?.(message);
          console.log('📊 Application status changed:', message);
        }

        if (message.type === 'delivery:application_approved') {
          onEvents.onApplicationApproved?.(message);
          console.log('✅ Application approved:', message);
        }

        if (message.type === 'delivery:application_rejected') {
          onEvents.onApplicationRejected?.(message);
          console.log('❌ Application rejected:', message);
        }

        // KYC Events
        if (message.type === 'delivery:kyc_submitted') {
          onEvents.onKYCSubmitted?.(message);
          console.log('🔐 KYC submitted:', message);
        }

        if (message.type === 'delivery:kyc_approved') {
          onEvents.onKYCApproved?.(message);
          console.log('✅ KYC approved:', message);
        }

        if (message.type === 'delivery:kyc_rejected') {
          onEvents.onKYCRejected?.(message);
          console.log('❌ KYC rejected:', message);
        }

        // Order Events
        if (message.type === 'delivery:order_assigned') {
          onEvents.onOrderAssigned?.(message);
          console.log('📦 Order assigned:', message);
        }

        if (message.type === 'delivery:order_accepted') {
          onEvents.onOrderAccepted?.(message);
          console.log('✓ Order accepted:', message);
        }

        if (message.type === 'delivery:order_rejected') {
          onEvents.onOrderRejected?.(message);
          console.log('✗ Order rejected:', message);
        }

        if (message.type === 'delivery:order_delivered') {
          onEvents.onOrderDelivered?.(message);
          console.log('🎉 Order delivered:', message);
        }

        // Wallet Events
        if (message.type === 'delivery:earnings_credited') {
          onEvents.onEarningsCredit?.(message);
          console.log('💰 Earnings credited:', message);
        }

        if (message.type === 'delivery:settlement_processed') {
          onEvents.onSettlementProcessed?.(message);
          console.log('💸 Settlement processed:', message);
        }

        // Notification Events
        if (message.type === 'delivery:notification') {
          onEvents.onNotification?.(message);
          console.log('🔔 Notification:', message);
        }

        // Status Update Events
        if (message.type === 'delivery:status_update') {
          onEvents.onStatusUpdate?.(message);
          console.log('📍 Status update:', message);
        }
      } catch (error) {
        console.error('WebSocket message parsing error:', error);
      }
    };

    const handleError = (error) => {
      console.error('WebSocket error:', error);
      onEvents.onError?.(error);
    };

    const handleClose = () => {
      console.warn('WebSocket connection closed');
      onEvents.onClose?.();
    };

    ws.addEventListener('message', handleMessage);
    ws.addEventListener('error', handleError);
    ws.addEventListener('close', handleClose);

    return () => {
      ws.removeEventListener('message', handleMessage);
      ws.removeEventListener('error', handleError);
      ws.removeEventListener('close', handleClose);
    };
  }, [ws, onEvents]);

  const emitEvent = useCallback((event, data) => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        type: event,
        ...data,
      }));
    } else {
      console.warn('WebSocket not connected');
    }
  }, [ws]);

  return {
    isConnected,
    emitEvent,
    ws,
  };
};

export default useDeliveryWebSocket;

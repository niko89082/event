// services/paymentProviders/paypalProvider.js
const paypal = require('@paypal/checkout-server-sdk');

class PayPalProvider {
  constructor() {
    this.validateConfig();
    this.client = this.createClient();
  }

  /**
   * Create PayPal client with proper environment
   * @returns {paypal.core.PayPalHttpClient} PayPal client
   */
  createClient() {
    try {
      const clientId = process.env.PAYPAL_CLIENT_ID;
      const clientSecret = process.env.PAYPAL_CLIENT_SECRET;
      
      if (!clientId || !clientSecret) {
        throw new Error('PayPal credentials not configured');
      }

      // Use sandbox for development, live for production
      const environment = process.env.NODE_ENV === 'production' 
        ? new paypal.core.LiveEnvironment(clientId, clientSecret)
        : new paypal.core.SandboxEnvironment(clientId, clientSecret);

      const client = new paypal.core.PayPalHttpClient(environment);
      
      console.log(`✅ PayPal client initialized for ${process.env.NODE_ENV === 'production' ? 'LIVE' : 'SANDBOX'}`);
      return client;

    } catch (error) {
      console.error('❌ PayPal client creation failed:', error);
      throw error;
    }
  }

  /**
   * Create PayPal payment order with proper validation
   * @param {number} amount - Amount in cents
   * @param {string} currency - Currency code (USD, EUR, etc.)
   * @param {string} hostEmail - Host's PayPal email
   * @param {object} metadata - Payment metadata
   * @returns {Promise<object>} Payment order result
   */
  async createPaymentOrder(amount, currency, hostEmail, metadata) {
    try {
      // Validate inputs
      if (!amount || amount <= 0) {
        throw new Error('Invalid payment amount');
      }

      if (!hostEmail || !this.isValidEmail(hostEmail)) {
        throw new Error('Invalid host email address');
      }

      if (!currency) {
        currency = 'USD';
      }

      // Convert cents to dollars for PayPal
      const dollarAmount = (amount / 100).toFixed(2);
      
      console.log(`💳 Creating PayPal order: $${dollarAmount} ${currency} to ${hostEmail}`);

      const request = new paypal.orders.OrdersCreateRequest();
      request.prefer("return=representation");
      
      // Build order payload
      const orderPayload = {
        intent: 'CAPTURE',
        application_context: {
          return_url: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/payment/paypal/success`,
          cancel_url: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/payment/paypal/cancel`,
          brand_name: process.env.APP_NAME || 'Social Event App',
          landing_page: 'BILLING',
          shipping_preference: 'NO_SHIPPING',
          user_action: 'PAY_NOW'
        },
        purchase_units: [{
          reference_id: metadata.eventId || 'event_ticket',
          description: metadata.eventTitle ? 
            `Ticket for ${metadata.eventTitle}` : 'Event Ticket',
          custom_id: metadata.guestPassId || metadata.userId || '',
          invoice_id: `${metadata.eventId}_${Date.now()}`,
          amount: {
            currency_code: currency.toUpperCase(),
            value: dollarAmount,
            breakdown: {
              item_total: {
                currency_code: currency.toUpperCase(),
                value: dollarAmount
              }
            }
          },
          items: [{
            name: metadata.eventTitle || 'Event Ticket',
            description: 'Admission to event',
            quantity: '1',
            category: 'DIGITAL_GOODS',
            unit_amount: {
              currency_code: currency.toUpperCase(),
              value: dollarAmount
            }
          }],
          payee: {
            email_address: hostEmail
          }
        }]
      };

      request.requestBody(orderPayload);
      
      // Execute the request
      const order = await this.client.execute(request);
      
      if (!order.result || !order.result.id) {
        throw new Error('PayPal order creation failed - no order ID returned');
      }

      // Find approval URL
      const approvalUrl = order.result.links?.find(
        link => link.rel === 'approve'
      )?.href;

      if (!approvalUrl) {
        throw new Error('No approval URL found in PayPal response');
      }

      console.log(`✅ PayPal order created successfully: ${order.result.id}`);

      return {
        success: true,
        orderId: order.result.id,
        approvalUrl: approvalUrl,
        status: order.result.status,
        amount: amount,
        currency: currency.toUpperCase(),
        createdAt: new Date()
      };

    } catch (error) {
      console.error('❌ PayPal order creation error:', error);
      
      // Provide more specific error messages
      let errorMessage = 'PayPal order creation failed';
      if (error.message.includes('INVALID_REQUEST')) {
        errorMessage = 'Invalid payment request - please check event details';
      } else if (error.message.includes('AUTHENTICATION_FAILURE')) {
        errorMessage = 'PayPal authentication failed - please contact support';
      } else if (error.message.includes('PERMISSION_DENIED')) {
        errorMessage = 'Host PayPal account cannot receive payments';
      }

      throw new Error(`${errorMessage}: ${error.message}`);
    }
  }

  /**
   * Capture PayPal payment after buyer approval
   * @param {string} orderId - PayPal order ID
   * @returns {Promise<object>} Capture result
   */
  async capturePayment(orderId) {
    try {
      if (!orderId) {
        throw new Error('Order ID is required for payment capture');
      }

      console.log(`💰 Capturing PayPal payment for order: ${orderId}`);

      const request = new paypal.orders.OrdersCaptureRequest(orderId);
      request.requestBody({});
      
      const capture = await this.client.execute(request);
      
      if (!capture.result || capture.result.status !== 'COMPLETED') {
        throw new Error(`Payment capture failed. Status: ${capture.result?.status || 'unknown'}`);
      }

      // Extract capture details
      const captureDetails = capture.result.purchase_units[0].payments.captures[0];
      
      console.log(`✅ PayPal payment captured successfully: ${captureDetails.id}`);

      return {
        success: true,
        captureId: captureDetails.id,
        status: capture.result.status,
        amount: Math.round(parseFloat(captureDetails.amount.value) * 100), // Convert back to cents
        currency: captureDetails.amount.currency_code,
        payerId: capture.result.payer.payer_id,
        payerEmail: capture.result.payer.email_address,
        paidAt: new Date(captureDetails.create_time),
        transactionId: captureDetails.id
      };

    } catch (error) {
      console.error('❌ PayPal capture error:', error);
      
      let errorMessage = 'Payment capture failed';
      if (error.message.includes('ORDER_NOT_APPROVED')) {
        errorMessage = 'Payment was not approved by the buyer';
      } else if (error.message.includes('ORDER_ALREADY_CAPTURED')) {
        errorMessage = 'Payment has already been processed';
      }

      throw new Error(`${errorMessage}: ${error.message}`);
    }
  }

  /**
   * Process refund for PayPal payment
   * @param {string} captureId - PayPal capture ID
   * @param {number} amount - Refund amount in cents (optional for full refund)
   * @param {string} reason - Refund reason
   * @returns {Promise<object>} Refund result
   */
  async processRefund(captureId, amount, reason) {
    try {
      console.log(`🔄 Processing PayPal refund for capture: ${captureId}`);

      const request = new paypal.payments.CapturesRefundRequest(captureId);
      
      const refundPayload = {
        note_to_payer: reason || 'Refund processed'
      };

      // Add amount for partial refunds
      if (amount) {
        const dollarAmount = (amount / 100).toFixed(2);
        refundPayload.amount = {
          value: dollarAmount,
          currency_code: 'USD' // You might want to make this dynamic
        };
      }

      request.requestBody(refundPayload);
      
      const refund = await this.client.execute(request);
      
      if (!refund.result || refund.result.status !== 'COMPLETED') {
        throw new Error(`Refund failed. Status: ${refund.result?.status || 'unknown'}`);
      }

      console.log(`✅ PayPal refund completed: ${refund.result.id}`);

      return {
        success: true,
        refundId: refund.result.id,
        status: refund.result.status,
        amount: Math.round(parseFloat(refund.result.amount.value) * 100),
        currency: refund.result.amount.currency_code,
        refundedAt: new Date(refund.result.create_time)
      };

    } catch (error) {
      console.error('❌ PayPal refund error:', error);
      throw new Error(`PayPal refund failed: ${error.message}`);
    }
  }

  /**
   * Handle PayPal webhooks
   * @param {object} event - Webhook event
   * @returns {Promise<object>} Processing result
   */
  async handleWebhook(event) {
    try {
      console.log(`📡 Processing PayPal webhook: ${event.event_type}`);

      switch (event.event_type) {
        case 'PAYMENT.CAPTURE.COMPLETED':
          await this.handlePaymentCompleted(event);
          break;
        
        case 'PAYMENT.CAPTURE.DENIED':
          await this.handlePaymentDenied(event);
          break;
        
        case 'CUSTOMER.DISPUTE.CREATED':
          await this.handleDispute(event);
          break;
        
        default:
          console.log(`ℹ️ Unhandled PayPal webhook type: ${event.event_type}`);
      }

      return { success: true, processed: true };

    } catch (error) {
      console.error('❌ PayPal webhook handling error:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Validate email format
   * @param {string} email - Email to validate
   * @returns {boolean} Is valid email
   */
  isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Validate configuration
   * @returns {boolean} True if configuration is valid
   */
  validateConfig() {
    const hasCredentials = !!(process.env.PAYPAL_CLIENT_ID && process.env.PAYPAL_CLIENT_SECRET);
    
    if (!hasCredentials) {
      console.warn('⚠️ PayPal configuration incomplete. Set PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET environment variables.');
      return false;
    }

    // Validate environment URLs
    if (!process.env.FRONTEND_URL) {
      console.warn('⚠️ FRONTEND_URL not set - PayPal return URLs may not work correctly');
    }

    return hasCredentials;
  }

  /**
   * Get provider configuration info
   * @returns {object} Configuration status
   */
  getProviderConfig() {
    return {
      name: 'PayPal',
      type: 'paypal',
      environment: process.env.NODE_ENV === 'production' ? 'live' : 'sandbox',
      clientId: process.env.PAYPAL_CLIENT_ID ? 'CONFIGURED' : 'NOT_CONFIGURED',
      features: ['instant_payments', 'refunds', 'webhooks', 'international_payments']
    };
  }

  /**
   * Handle completed payment webhook
   * @param {object} event - Webhook event
   */
  async handlePaymentCompleted(event) {
    try {
      const captureId = event.resource.id;
      const customId = event.resource.custom_id;
      
      console.log(`✅ PayPal payment completed webhook: ${captureId} for ${customId}`);
      
      // TODO: Update payment status in database
      // You'll need to implement the database update logic here
      
    } catch (error) {
      console.error('❌ Handle payment completed error:', error);
    }
  }

  /**
   * Handle denied payment webhook
   * @param {object} event - Webhook event
   */
  async handlePaymentDenied(event) {
    try {
      const captureId = event.resource.id;
      console.log(`❌ PayPal payment denied webhook: ${captureId}`);
      
      // TODO: Update payment status in database
      
    } catch (error) {
      console.error('❌ Handle payment denied error:', error);
    }
  }

  /**
   * Handle dispute webhook
   * @param {object} event - Webhook event
   */
  async handleDispute(event) {
    try {
      const disputeId = event.resource.dispute_id;
      console.log(`⚠️ PayPal dispute created webhook: ${disputeId}`);
      
      // TODO: Handle dispute in database
      
    } catch (error) {
      console.error('❌ Handle dispute error:', error);
    }
  }
}

module.exports = PayPalProvider;
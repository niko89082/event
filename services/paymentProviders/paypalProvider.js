// services/paymentProviders/paypalProvider.js - COMPLETE FIXED VERSION
const paypal = require('@paypal/checkout-server-sdk');

class PayPalProvider {
  constructor() {
    this.checkEnvironmentVariables();
    this.validateConfig();
    this.client = this.createClient();
  }

  /**
   * Check if environment variables are loaded
   */
  checkEnvironmentVariables() {
    console.log('🔍 Checking environment variables...');
    console.log('PAYPAL_CLIENT_ID:', process.env.PAYPAL_CLIENT_ID || 'NOT SET');
    console.log('PAYPAL_CLIENT_SECRET:', process.env.PAYPAL_CLIENT_SECRET ? 'SET' : 'NOT SET');
    console.log('IP_ADD:', process.env.IP_ADD || 'NOT SET');
    
    if (!process.env.PAYPAL_CLIENT_ID) {
      console.error('❌ PAYPAL_CLIENT_ID is not set in environment variables');
    }
    
    if (!process.env.PAYPAL_CLIENT_SECRET) {
      console.error('❌ PAYPAL_CLIENT_SECRET is not set in environment variables');
    }
  }

  /**
   * Create PayPal client with proper environment and error handling
   */
  createClient() {
    try {
      const clientId = process.env.PAYPAL_CLIENT_ID;
      const clientSecret = process.env.PAYPAL_CLIENT_SECRET;
      
      console.log('🔑 PayPal credentials check:');
      console.log('   Client ID length:', clientId ? clientId.length : 0);
      console.log('   Client Secret length:', clientSecret ? clientSecret.length : 0);
      
      if (!clientId || !clientSecret) {
        throw new Error('PayPal credentials not configured. Check PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET in .env file');
      }

      const environment = process.env.NODE_ENV === 'production' 
        ? new paypal.core.LiveEnvironment(clientId, clientSecret)
        : new paypal.core.SandboxEnvironment(clientId, clientSecret);

      const client = new paypal.core.PayPalHttpClient(environment);
      
      console.log(`✅ PayPal client initialized for ${process.env.NODE_ENV === 'production' ? 'LIVE' : 'SANDBOX'}`);
      console.log(`🔑 Using PayPal Client ID: ${clientId.substring(0, 10)}...`);
      
      return client;

    } catch (error) {
      console.error('❌ PayPal client creation failed:', error.message);
      throw error;
    }
  }

  /**
   * Create PayPal payment order with deep link support
   */
  async createPaymentOrder(amount, currency, hostEmail, metadata) {
    try {
      // Enhanced validation
      if (!amount || amount <= 0) {
        throw new Error('Invalid payment amount');
      }

      if (!hostEmail || !this.isValidEmail(hostEmail)) {
        throw new Error('Invalid host email address');
      }

      // Ensure currency is valid
      const validCurrencies = ['USD', 'EUR', 'GBP', 'CAD', 'AUD'];
      if (!currency || !validCurrencies.includes(currency.toUpperCase())) {
        currency = 'USD';
      }

      const dollarAmount = (amount / 100).toFixed(2);
      
      console.log(`💳 Creating PayPal order:`);
      console.log(`   Amount: $${dollarAmount} ${currency}`);
      console.log(`   Host: ${hostEmail}`);
      console.log(`   Event: ${metadata?.eventTitle || 'N/A'}`);

      const request = new paypal.orders.OrdersCreateRequest();
      request.prefer("return=representation");
      
      // 🔧 FIXED: Use IP_ADD from environment variables for deep links
      const ipAddress = process.env.IP_ADD || '10.0.0.18';
      const port = process.env.EXPO_PORT || '8081';
      
      // Build deep link URLs using environment variables
      const returnUrl = `exp://${ipAddress}:${port}/--/payment/success`;
      const cancelUrl = `exp://${ipAddress}:${port}/--/payment/cancel`;
      
      console.log(`🔗 Deep link URLs:`);
      console.log(`   Return URL: ${returnUrl}`);
      console.log(`   Cancel URL: ${cancelUrl}`);
      
      const orderPayload = {
        intent: 'CAPTURE',
        application_context: {
          // ✅ FIXED: Dynamic deep links using environment variables
          return_url: returnUrl,
          cancel_url: cancelUrl,
          brand_name: process.env.APP_NAME || 'Social Event App',
          landing_page: 'LOGIN',
          shipping_preference: 'NO_SHIPPING',
          user_action: 'PAY_NOW'
        },
        purchase_units: [{
          reference_id: metadata?.eventId || 'event_payment',
          description: `${metadata?.eventTitle || 'Event Ticket'} - Ticket Purchase`,
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
            name: metadata?.eventTitle || 'Event Ticket',
            unit_amount: {
              currency_code: currency.toUpperCase(),
              value: dollarAmount
            },
            quantity: '1',
            category: 'DIGITAL_GOODS'
          }],
          payee: {
            email_address: hostEmail
          }
        }]
      };

      request.requestBody(orderPayload);
      
      console.log(`🔄 Executing PayPal API request...`);
      
      const order = await this.client.execute(request);

      if (!order.result) {
        throw new Error('PayPal API returned empty result');
      }

      console.log(`✅ PayPal order created successfully: ${order.result.id}`);
      console.log(`🔍 Order status: ${order.result.status}`);

      // Find approval URL
      const approvalUrl = order.result.links?.find(
        link => link.rel === 'approve'
      )?.href;

      if (!approvalUrl) {
        console.error('❌ PayPal links:', order.result.links);
        throw new Error('PayPal approval URL not found in response');
      }

      console.log(`🔗 Approval URL: ${approvalUrl}`);

      return {
        success: true,
        orderId: order.result.id,
        approvalUrl: approvalUrl,
        status: order.result.status
      };

    } catch (error) {
      console.error('❌ PayPal order creation error:', error);
      
      // Enhanced error handling with specific messages
      let errorMessage = 'PayPal payment failed';
      
      if (error.message?.includes('invalid_client') || error.statusCode === 401) {
        errorMessage = 'PayPal authentication failed. Please check your PayPal sandbox credentials';
        console.error('🚨 PayPal Authentication Failed!');
        console.error('   Current PAYPAL_CLIENT_ID:', process.env.PAYPAL_CLIENT_ID ? 'SET' : 'NOT SET');
        console.error('   Current PAYPAL_CLIENT_SECRET:', process.env.PAYPAL_CLIENT_SECRET ? 'SET' : 'NOT SET');
      } else if (error.message?.includes('AUTHENTICATION_FAILURE')) {
        errorMessage = 'PayPal authentication failed - please contact support';
      } else if (error.message?.includes('PERMISSION_DENIED')) {
        errorMessage = 'Host PayPal account cannot receive payments';
      } else if (error.message?.includes('UNPROCESSABLE_ENTITY')) {
        errorMessage = 'Invalid payment data provided to PayPal';
      }

      throw new Error(`${errorMessage}: ${error.message}`);
    }
  }

  /**
   * Capture PayPal payment after buyer approval
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

      console.log(`✅ PayPal payment captured successfully: ${capture.result.id}`);

      // Extract capture details
      const captureDetails = capture.result.purchase_units[0].payments.captures[0];

      return {
        success: true,
        captureId: captureDetails.id,
        status: capture.result.status,
        amount: Math.round(parseFloat(captureDetails.amount.value) * 100),
        currency: captureDetails.amount.currency_code,
        payerId: capture.result.payer.payer_id,
        payerEmail: capture.result.payer.email_address,
        paidAt: new Date(captureDetails.create_time),
        transactionId: captureDetails.id
      };

    } catch (error) {
      console.error('❌ PayPal capture error:', error);
      throw new Error(`PayPal capture failed: ${error.message}`);
    }
  }

  /**
   * Enhanced configuration validation
   */
  validateConfig() {
    const clientId = process.env.PAYPAL_CLIENT_ID;
    const clientSecret = process.env.PAYPAL_CLIENT_SECRET;
    const ipAddress = process.env.IP_ADD;
    
    console.log('🔍 Validating PayPal configuration...');
    
    if (!clientId || !clientSecret) {
      console.error('🚨 PayPal configuration missing!');
      console.error('   Please add these to your .env file:');
      console.error('   PAYPAL_CLIENT_ID=your_sandbox_client_id');
      console.error('   PAYPAL_CLIENT_SECRET=your_sandbox_client_secret');
      console.error('');
      console.error('   Get credentials from: https://developer.paypal.com/');
      return false;
    }

    // Validate credential format
    if (clientId.length < 20) {
      console.warn('⚠️ PayPal Client ID seems too short - verify it\'s correct');
    }

    if (clientSecret.length < 20) {
      console.warn('⚠️ PayPal Client Secret seems too short - verify it\'s correct');
    }

    if (!ipAddress) {
      console.warn('⚠️ IP_ADD not set - using default IP for deep links');
    } else {
      console.log(`✅ Using IP address for deep links: ${ipAddress}`);
    }

    console.log('✅ PayPal configuration validation passed');
    return true;
  }

  /**
   * Enhanced email validation
   */
  isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email) && email.length >= 5 && email.length <= 320;
  }

  /**
   * Get provider configuration info
   */
  getProviderConfig() {
    return {
      name: 'PayPal',
      type: 'paypal',
      environment: process.env.NODE_ENV === 'production' ? 'live' : 'sandbox',
      clientId: process.env.PAYPAL_CLIENT_ID ? 'CONFIGURED' : 'NOT_CONFIGURED',
      ipAddress: process.env.IP_ADD,
      features: ['instant_payments', 'refunds', 'webhooks', 'international_payments'],
      isConfigured: this.validateConfig()
    };
  }
}

module.exports = PayPalProvider;
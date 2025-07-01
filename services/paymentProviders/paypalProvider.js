// services/paymentProviders/paypalProvider.js
const path = require('path');
const fs = require('fs');

// Debug: Show current file location and project structure
console.log('🔍 PayPal Provider Debug Info:');
console.log('📂 Current file: __filename =', __filename);
console.log('📂 Current directory: __dirname =', __dirname);
console.log('📂 Process working directory:', process.cwd());

// Check if models directory exists
const possibleUserPaths = [
  path.join(__dirname, '../../models/User.js'),
  path.join(__dirname, '../../../models/User.js'),
  path.join(__dirname, '../../User.js'),
  path.join(process.cwd(), 'models/User.js')
];

console.log('🔍 Checking possible User model paths:');
possibleUserPaths.forEach((userPath, index) => {
  const exists = fs.existsSync(userPath);
  console.log(`${index + 1}. ${userPath} - ${exists ? '✅ EXISTS' : '❌ NOT FOUND'}`);
});

// Try to require the interface first
const PaymentProviderInterface = require('.//paymentProviderInterface');

// Find and require the User model
let User;
let userModelPath;

for (const userPath of possibleUserPaths) {
  if (fs.existsSync(userPath)) {
    try {
      User = require(userPath);
      userModelPath = userPath;
      console.log('✅ Successfully loaded User model from:', userPath);
      break;
    } catch (err) {
      console.log('❌ Failed to require User model from:', userPath, err.message);
    }
  }
}

if (!User) {
  console.error('❌ Could not find User model in any expected location.');
  console.error('💡 Please make sure your User.js file exists in the models/ directory');
  console.error('💡 Your project structure should look like:');
  console.error('   your_project/');
  console.error('   ├── models/');
  console.error('   │   └── User.js');
  console.error('   ├── services/');
  console.error('   │   └── paymentProviders/');
  console.error('   │       └── paypalProvider.js');
  console.error('   └── routes/');
  console.error('       └── events.js');
  
  // Create a dummy User model for now
  User = {
    findByIdAndUpdate: () => Promise.resolve(null),
    findById: () => Promise.resolve(null)
  };
  console.log('⚠️ Using dummy User model to prevent crashes');
}

// Check for PayPal SDK
let paypal;
try {
  paypal = require('@paypal/checkout-server-sdk');
  console.log('✅ PayPal SDK loaded successfully');
} catch (err) {
  console.error('❌ PayPal SDK not found. Please install it with: npm install @paypal/checkout-server-sdk');
  throw err;
}

class PayPalProvider extends PaymentProviderInterface {
  constructor() {
    super();
    
    // Check for required environment variables
    if (!process.env.PAYPAL_CLIENT_ID || !process.env.PAYPAL_CLIENT_SECRET) {
      console.warn('⚠️ PayPal environment variables not set:');
      console.warn('   PAYPAL_CLIENT_ID:', process.env.PAYPAL_CLIENT_ID ? 'SET' : 'NOT SET');
      console.warn('   PAYPAL_CLIENT_SECRET:', process.env.PAYPAL_CLIENT_SECRET ? 'SET' : 'NOT SET');
    }
    
    // Configure PayPal environment
    this.environment = process.env.NODE_ENV === 'production' 
      ? new paypal.core.LiveEnvironment(
          process.env.PAYPAL_CLIENT_ID || 'dummy', 
          process.env.PAYPAL_CLIENT_SECRET || 'dummy'
        )
      : new paypal.core.SandboxEnvironment(
          process.env.PAYPAL_CLIENT_ID || 'dummy', 
          process.env.PAYPAL_CLIENT_SECRET || 'dummy'
        );
    
    this.client = new paypal.core.PayPalHttpClient(this.environment);
    console.log('✅ PayPal Provider initialized successfully');
  }

  /**
   * Setup PayPal account for host (simplified process)
   * @param {string} userId - User ID
   * @param {object} accountInfo - Account information
   * @returns {object} Setup result
   */
  async setupAccount(userId, accountInfo) {
    try {
      const { paypalEmail } = accountInfo;
      
      if (!paypalEmail || !this.isValidEmail(paypalEmail)) {
        return {
          success: false,
          message: 'Valid PayPal email address is required'
        };
      }

      console.log(`🔗 Setting up PayPal account for user ${userId} with email: ${paypalEmail}`);

      // Update user with PayPal account info
      const user = await User.findByIdAndUpdate(userId, {
        'paymentAccounts.paypal.email': paypalEmail,
        'paymentAccounts.paypal.verified': true,
        'paymentAccounts.paypal.connectedAt': new Date(),
        'paymentAccounts.primary.type': 'paypal',
        'paymentAccounts.primary.isVerified': true,
        'paymentAccounts.primary.canReceivePayments': true
      }, { new: true });

      if (!user) {
        return {
          success: false,
          message: 'User not found'
        };
      }

      console.log(`✅ PayPal account setup complete for user ${userId}`);
      
      return {
        success: true,
        accountId: paypalEmail,
        message: 'PayPal account connected successfully',
        provider: 'paypal'
      };

    } catch (error) {
      console.error('❌ PayPal setup error:', error);
      return {
        success: false,
        message: `Setup failed: ${error.message}`
      };
    }
  }

  /**
   * Create PayPal payment order for event tickets
   * @param {number} amount - Amount in cents
   * @param {string} currency - Currency code
   * @param {string} hostEmail - Host's PayPal email
   * @param {object} metadata - Payment metadata
   * @returns {object} Payment order result
   */
  async createPaymentOrder(amount, currency, hostEmail, metadata) {
    try {
      const request = new paypal.orders.OrdersCreateRequest();
      request.prefer("return=representation");
      
      const orderPayload = {
        intent: 'CAPTURE',
        application_context: {
          return_url: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/payment/success?provider=paypal`,
          cancel_url: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/payment/cancel?provider=paypal`,
          brand_name: 'Social Event App',
          landing_page: 'BILLING',
          shipping_preference: 'NO_SHIPPING',
          user_action: 'PAY_NOW'
        },
        purchase_units: [{
          reference_id: metadata.eventId || 'event_ticket',
          description: metadata.eventTitle ? `Ticket for ${metadata.eventTitle}` : 'Event Ticket',
          custom_id: metadata.guestPassId || metadata.userId,
          invoice_id: `${metadata.eventId}_${Date.now()}`,
          amount: {
            currency_code: currency.toUpperCase(),
            value: (amount / 100).toFixed(2), // Convert cents to dollars
            breakdown: {
              item_total: {
                currency_code: currency.toUpperCase(),
                value: (amount / 100).toFixed(2)
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
              value: (amount / 100).toFixed(2)
            }
          }],
          payee: {
            email_address: hostEmail
          }
        }]
      };

      request.requestBody(orderPayload);
      
      const order = await this.client.execute(request);
      
      if (!order.result || !order.result.id) {
        throw new Error('Failed to create PayPal order');
      }

      // Find approval URL
      const approvalUrl = order.result.links?.find(
        link => link.rel === 'approve'
      )?.href;

      if (!approvalUrl) {
        throw new Error('No approval URL found in PayPal response');
      }

      console.log(`✅ PayPal order created: ${order.result.id}`);

      return {
        success: true,
        orderId: order.result.id,
        approvalUrl: approvalUrl,
        status: order.result.status
      };

    } catch (error) {
      console.error('❌ PayPal order creation error:', error);
      throw new Error(`PayPal order creation failed: ${error.message}`);
    }
  }

  /**
   * Capture PayPal payment after buyer approval
   * @param {string} orderId - PayPal order ID
   * @returns {object} Capture result
   */
  async capturePayment(orderId) {
    try {
      const request = new paypal.orders.OrdersCaptureRequest(orderId);
      request.requestBody({});
      
      const capture = await this.client.execute(request);
      
      if (!capture.result || capture.result.status !== 'COMPLETED') {
        throw new Error(`Payment capture failed. Status: ${capture.result?.status}`);
      }

      const captureData = capture.result.purchase_units[0].payments.captures[0];
      
      console.log(`✅ PayPal payment captured: ${captureData.id}`);

      return {
        success: true,
        captureId: captureData.id,
        status: capture.result.status,
        amount: {
          value: captureData.amount.value,
          currency: captureData.amount.currency_code
        },
        transactionId: captureData.id,
        paidAt: new Date(captureData.create_time)
      };

    } catch (error) {
      console.error('❌ PayPal capture error:', error);
      throw new Error(`PayPal capture failed: ${error.message}`);
    }
  }

  /**
   * Check PayPal account status for user
   * @param {string} userId - User ID
   * @returns {object} Account status
   */
  async checkAccountStatus(userId) {
    try {
      const user = await User.findById(userId);
      
      if (!user) {
        return {
          connected: false,
          message: 'User not found'
        };
      }

      const paypalAccount = user.paymentAccounts?.paypal;
      
      return {
        connected: !!paypalAccount?.verified,
        canReceivePayments: !!paypalAccount?.verified,
        accountEmail: paypalAccount?.email,
        connectedAt: paypalAccount?.connectedAt,
        provider: 'paypal',
        onboardingComplete: !!paypalAccount?.verified,
        requiresAction: !paypalAccount?.verified
      };

    } catch (error) {
      console.error('❌ PayPal status check error:', error);
      throw new Error(`Status check failed: ${error.message}`);
    }
  }

  /**
   * Process refund for PayPal payment
   * @param {string} captureId - PayPal capture ID
   * @param {number} amount - Refund amount in cents
   * @param {string} reason - Refund reason
   * @returns {object} Refund result
   */
  async processRefund(captureId, amount, reason = 'Requested by host') {
    try {
      const request = new paypal.payments.CapturesRefundRequest(captureId);
      request.requestBody({
        amount: {
          value: (amount / 100).toFixed(2),
          currency_code: 'USD'
        },
        note_to_payer: reason
      });

      const refund = await this.client.execute(request);

      return {
        success: true,
        refundId: refund.result.id,
        status: refund.result.status,
        amount: refund.result.amount
      };

    } catch (error) {
      console.error('❌ PayPal refund error:', error);
      throw new Error(`Refund failed: ${error.message}`);
    }
  }

  /**
   * Handle PayPal webhook events
   * @param {object} event - Webhook event
   * @returns {object} Processing result
   */
  async handleWebhook(event) {
    try {
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
          console.log(`Unhandled PayPal webhook event: ${event.event_type}`);
      }

      return { success: true, processed: true };

    } catch (error) {
      console.error('❌ PayPal webhook handling error:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get provider configuration
   * @returns {object} Provider configuration
   */
  getProviderConfig() {
    return {
      name: 'PayPal',
      type: 'paypal',
      environment: process.env.NODE_ENV === 'production' ? 'live' : 'sandbox',
      clientId: process.env.PAYPAL_CLIENT_ID ? 'CONFIGURED' : 'NOT_CONFIGURED',
      features: ['instant_payments', 'refunds', 'webhooks']
    };
  }

  /**
   * Validate configuration
   * @returns {boolean} True if configuration is valid
   */
  validateConfig() {
    const hasCredentials = !!(process.env.PAYPAL_CLIENT_ID && process.env.PAYPAL_CLIENT_SECRET);
    if (!hasCredentials) {
      console.warn('⚠️ PayPal configuration incomplete. Set PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET environment variables.');
    }
    return hasCredentials;
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
   * Handle completed payment webhook
   * @param {object} event - Webhook event
   */
  async handlePaymentCompleted(event) {
    try {
      const captureId = event.resource.id;
      const customId = event.resource.custom_id;
      
      console.log(`✅ PayPal payment completed: ${captureId} for ${customId}`);
      
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
      console.log(`❌ PayPal payment denied: ${captureId}`);
      
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
      console.log(`⚠️ PayPal dispute created: ${disputeId}`);
      
    } catch (error) {
      console.error('❌ Handle dispute error:', error);
    }
  }
}

module.exports = PayPalProvider;
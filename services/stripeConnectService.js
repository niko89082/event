// services/stripeConnectService.js - Fixed with proper metadata handling
const User = require('../models/User');

// Initialize Stripe only when needed to avoid early loading issues
let stripe = null;

const getStripe = () => {
  if (!stripe) {
    // Ensure environment variables are loaded
    require('dotenv').config();
    
    if (!process.env.STRIPE_SECRET_KEY) {
      throw new Error('STRIPE_SECRET_KEY environment variable is not set');
    }
    
    // Initialize Stripe with the secret key
    stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
    console.log('✅ Stripe initialized successfully');
  }
  return stripe;
};

class StripeConnectService {
  
  /**
   * Create Stripe Connect Express account for a host
   * @param {string} userId - The user ID to create account for
   * @param {object} userInfo - Basic user information
   * @returns {object} Account creation result
   */
  static async createConnectAccount(userId, userInfo = {}) {
    try {
      const user = await User.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      // Check if user already has a Stripe account
      if (user.paymentAccounts?.stripe?.accountId) {
        return {
          success: false,
          message: 'User already has a Stripe account',
          accountId: user.paymentAccounts.stripe.accountId
        };
      }

      // Get Stripe instance
      const stripeInstance = getStripe();

      // FIXED: Convert ObjectId to string and ensure all metadata values are strings
      const metadata = {
        userId: userId.toString(), // Convert ObjectId to string
        platform: 'social_event_app',
        userEmail: user.email || '',
        createdAt: new Date().toISOString()
      };

      console.log('Creating Stripe account with metadata:', metadata);

      // Create Stripe Express account
      const account = await stripeInstance.accounts.create({
        type: 'express',
        country: userInfo.country || 'US',
        email: user.email,
        capabilities: {
          card_payments: { requested: true },
          transfers: { requested: true },
        },
        business_type: 'individual',
        individual: {
          email: user.email,
          first_name: userInfo.firstName || '',
          last_name: userInfo.lastName || '',
        },
        settings: {
          payouts: {
            schedule: {
              interval: 'daily' // Hosts get paid daily
            }
          }
        },
        metadata: metadata // Use the properly formatted metadata
      });

      // Save account info to user
      const updateData = {
        'paymentAccounts.stripe.accountId': account.id,
        'paymentAccounts.stripe.createdAt': new Date(),
        'paymentAccounts.stripe.lastUpdated': new Date()
      };

      await User.findByIdAndUpdate(userId, updateData);

      console.log(`✅ Stripe account created successfully: ${account.id}`);

      return {
        success: true,
        accountId: account.id,
        account: account
      };

    } catch (error) {
      console.error('❌ Create Connect account error:', error);
      throw new Error(`Failed to create Stripe account: ${error.message}`);
    }
  }

  /**
   * Create account link for onboarding
   * @param {string} userId - User ID
   * @param {string} returnUrl - URL to return after onboarding
   * @param {string} refreshUrl - URL to refresh if link expires
   * @returns {object} Account link result
   */
  static async createAccountLink(userId, returnUrl, refreshUrl) {
    try {
      const user = await User.findById(userId);
      if (!user || !user.paymentAccounts?.stripe?.accountId) {
        throw new Error('User or Stripe account not found');
      }

      const stripeInstance = getStripe();

      const accountLink = await stripeInstance.accountLinks.create({
        account: user.paymentAccounts.stripe.accountId,
        refresh_url: refreshUrl,
        return_url: returnUrl,
        type: 'account_onboarding',
      });

      // Save link info (temporary)
      await User.findByIdAndUpdate(userId, {
        'paymentAccounts.stripe.accountLink': accountLink.url,
        'paymentAccounts.stripe.accountLinkExpiresAt': new Date(accountLink.expires_at * 1000)
      });

      return {
        success: true,
        url: accountLink.url,
        expiresAt: new Date(accountLink.expires_at * 1000)
      };

    } catch (error) {
      console.error('❌ Create account link error:', error);
      throw new Error(`Failed to create account link: ${error.message}`);
    }
  }

  /**
   * Check account status and update user record
   * @param {string} userId - User ID
   * @returns {object} Account status
   */
  static async checkAccountStatus(userId) {
    try {
      const user = await User.findById(userId);
      if (!user || !user.paymentAccounts?.stripe?.accountId) {
        return {
          connected: false,
          message: 'No Stripe account found'
        };
      }

      const stripeInstance = getStripe();
      const account = await stripeInstance.accounts.retrieve(user.paymentAccounts.stripe.accountId);

      // Update user record with current status
      const updateData = {
        'paymentAccounts.stripe.onboardingComplete': account.details_submitted && !account.requirements?.currently_due?.length,
        'paymentAccounts.stripe.detailsSubmitted': account.details_submitted,
        'paymentAccounts.stripe.chargesEnabled': account.charges_enabled,
        'paymentAccounts.stripe.payoutsEnabled': account.payouts_enabled,
        'paymentAccounts.stripe.lastUpdated': new Date()
      };

      await User.findByIdAndUpdate(userId, updateData);

      return {
        connected: account.charges_enabled,
        onboardingComplete: account.details_submitted && !account.requirements?.currently_due?.length,
        chargesEnabled: account.charges_enabled,
        payoutsEnabled: account.payouts_enabled,
        requirements: account.requirements,
        account: account
      };

    } catch (error) {
      console.error('❌ Check account status error:', error);
      throw new Error(`Failed to check account status: ${error.message}`);
    }
  }

  /**
   * Create payment intent with direct charge to host
   * @param {number} amount - Amount in cents
   * @param {string} currency - Currency code
   * @param {string} hostStripeAccountId - Host's Stripe account ID
   * @param {object} metadata - Payment metadata
   * @returns {object} Payment intent result
   */
  static async createPaymentIntent(amount, currency, hostStripeAccountId, metadata = {}) {
    try {
      const stripeInstance = getStripe();

      // FIXED: Ensure all metadata values are strings
      const formattedMetadata = {};
      Object.keys(metadata).forEach(key => {
        formattedMetadata[key] = String(metadata[key]); // Convert all values to strings
      });
      formattedMetadata.platform = 'social_event_app';

      const paymentIntent = await stripeInstance.paymentIntents.create({
        amount: amount,
        currency: currency,
        application_fee_amount: 0, // Host gets 100% (minus Stripe fees)
        transfer_data: {
          destination: hostStripeAccountId,
        },
        metadata: formattedMetadata
      });

      return {
        success: true,
        paymentIntent: paymentIntent,
        clientSecret: paymentIntent.client_secret
      };

    } catch (error) {
      console.error('❌ Create payment intent error:', error);
      throw new Error(`Failed to create payment intent: ${error.message}`);
    }
  }

  /**
   * Create payment intent for connected account (alternative method)
   * This charges directly to the host's account
   * @param {number} amount - Amount in cents
   * @param {string} currency - Currency code
   * @param {string} hostStripeAccountId - Host's Stripe account ID
   * @param {object} metadata - Payment metadata
   * @returns {object} Payment intent result
   */
  static async createDirectPaymentIntent(amount, currency, hostStripeAccountId, metadata = {}) {
    try {
      const stripeInstance = getStripe();

      // FIXED: Ensure all metadata values are strings
      const formattedMetadata = {};
      Object.keys(metadata).forEach(key => {
        formattedMetadata[key] = String(metadata[key]); // Convert all values to strings
      });
      formattedMetadata.platform = 'social_event_app';

      console.log('Creating payment intent with metadata:', formattedMetadata);

      const paymentIntent = await stripeInstance.paymentIntents.create({
        amount: amount,
        currency: currency,
        metadata: formattedMetadata
      }, {
        stripeAccount: hostStripeAccountId // This charges directly to host account
      });

      return {
        success: true,
        paymentIntent: paymentIntent,
        clientSecret: paymentIntent.client_secret
      };

    } catch (error) {
      console.error('❌ Create direct payment intent error:', error);
      throw new Error(`Failed to create direct payment intent: ${error.message}`);
    }
  }

  /**
   * Process refund for an event payment
   * @param {string} paymentIntentId - Original payment intent ID
   * @param {number} amount - Refund amount in cents (optional, full refund if not specified)
   * @param {string} reason - Reason for refund
   * @param {string} hostStripeAccountId - Host's Stripe account ID
   * @returns {object} Refund result
   */
  static async processRefund(paymentIntentId, amount = null, reason = 'requested_by_customer', hostStripeAccountId = null) {
    try {
      const stripeInstance = getStripe();

      const refundData = {
        payment_intent: paymentIntentId,
        reason: reason,
        metadata: {
          platform: 'social_event_app',
          refund_reason: reason
        }
      };

      if (amount) {
        refundData.amount = amount;
      }

      // If this was a direct charge to host account, specify the account
      const refundOptions = hostStripeAccountId ? { stripeAccount: hostStripeAccountId } : {};

      const refund = await stripeInstance.refunds.create(refundData, refundOptions);

      return {
        success: true,
        refund: refund,
        amount: refund.amount,
        status: refund.status
      };

    } catch (error) {
      console.error('❌ Process refund error:', error);
      throw new Error(`Failed to process refund: ${error.message}`);
    }
  }

  /**
   * Get account dashboard link for host to manage their account
   * @param {string} userId - User ID
   * @returns {object} Dashboard link result
   */
  static async createDashboardLink(userId) {
    try {
      const user = await User.findById(userId);
      if (!user || !user.paymentAccounts?.stripe?.accountId) {
        throw new Error('User or Stripe account not found');
      }

      const stripeInstance = getStripe();

      const link = await stripeInstance.accounts.createLoginLink(
        user.paymentAccounts.stripe.accountId
      );

      return {
        success: true,
        url: link.url
      };

    } catch (error) {
      console.error('❌ Create dashboard link error:', error);
      throw new Error(`Failed to create dashboard link: ${error.message}`);
    }
  }

  /**
   * Get account balance for a host
   * @param {string} userId - User ID
   * @returns {object} Balance information
   */
  static async getAccountBalance(userId) {
    try {
      const user = await User.findById(userId);
      if (!user || !user.paymentAccounts?.stripe?.accountId) {
        throw new Error('User or Stripe account not found');
      }

      const stripeInstance = getStripe();

      const balance = await stripeInstance.balance.retrieve({
        stripeAccount: user.paymentAccounts.stripe.accountId
      });

      return {
        success: true,
        balance: balance
      };

    } catch (error) {
      console.error('❌ Get account balance error:', error);
      throw new Error(`Failed to get account balance: ${error.message}`);
    }
  }

  /**
   * Validate webhook signature
   * @param {string} body - Raw request body
   * @param {string} signature - Stripe signature header
   * @returns {object} Webhook event
   */
  static validateWebhook(body, signature) {
    try {
      const stripeInstance = getStripe();
      const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;
      const event = stripeInstance.webhooks.constructEvent(body, signature, endpointSecret);
      return event;
    } catch (error) {
      console.error('❌ Webhook validation error:', error);
      throw new Error('Invalid webhook signature');
    }
  }

  /**
   * Handle Stripe webhook events
   * @param {object} event - Stripe webhook event
   * @returns {object} Processing result
   */
  static async handleWebhook(event) {
    try {
      switch (event.type) {
        case 'account.updated':
          await this.handleAccountUpdated(event.data.object);
          break;
        
        case 'payment_intent.succeeded':
          await this.handlePaymentSucceeded(event.data.object);
          break;
        
        case 'payment_intent.payment_failed':
          await this.handlePaymentFailed(event.data.object);
          break;
        
        case 'charge.dispute.created':
          await this.handleChargeDispute(event.data.object);
          break;
        
        default:
          console.log(`Unhandled event type: ${event.type}`);
      }

      return { success: true, processed: true };
    } catch (error) {
      console.error('❌ Webhook handling error:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Handle account update webhook
   * @param {object} account - Stripe account object
   */
  static async handleAccountUpdated(account) {
    try {
      const userId = account.metadata?.userId;
      if (!userId) return;

      const updateData = {
        'paymentAccounts.stripe.onboardingComplete': account.details_submitted && !account.requirements?.currently_due?.length,
        'paymentAccounts.stripe.detailsSubmitted': account.details_submitted,
        'paymentAccounts.stripe.chargesEnabled': account.charges_enabled,
        'paymentAccounts.stripe.payoutsEnabled': account.payouts_enabled,
        'paymentAccounts.stripe.lastUpdated': new Date()
      };

      await User.findByIdAndUpdate(userId, updateData);
      console.log(`✅ Updated account status for user ${userId}`);
    } catch (error) {
      console.error('❌ Handle account updated error:', error);
    }
  }

  /**
   * Handle successful payment webhook
   * @param {object} paymentIntent - Stripe payment intent object
   */
  static async handlePaymentSucceeded(paymentIntent) {
    try {
      const { eventId, userId, guestPassId } = paymentIntent.metadata;
      
      if (eventId) {
        const Event = require('../models/Event');
        const event = await Event.findById(eventId);
        
        if (event) {
          // Update payment history
          const paymentData = {
            user: userId || null,
            guestPass: guestPassId || null,
            amount: paymentIntent.amount,
            currency: paymentIntent.currency,
            stripePaymentIntentId: paymentIntent.id,
            status: 'succeeded',
            paidAt: new Date(),
            type: userId ? 'user' : 'guest'
          };
          
          await event.addPayment(paymentData);
          console.log(`✅ Payment recorded for event ${eventId}`);
        }
      }
    } catch (error) {
      console.error('❌ Handle payment succeeded error:', error);
    }
  }

  /**
   * Handle failed payment webhook
   * @param {object} paymentIntent - Stripe payment intent object
   */
  static async handlePaymentFailed(paymentIntent) {
    try {
      // Handle payment failure logic here
      // Could send notifications, update payment status, etc.
      console.log(`❌ Payment failed: ${paymentIntent.id}`);
    } catch (error) {
      console.error('❌ Handle payment failed error:', error);
    }
  }

  /**
   * Handle charge dispute webhook
   * @param {object} dispute - Stripe dispute object
   */
  static async handleChargeDispute(dispute) {
    try {
      // Handle dispute logic here
      // Could notify host, update records, etc.
      console.log(`⚠️ Charge dispute created: ${dispute.id}`);
    } catch (error) {
      console.error('❌ Handle charge dispute error:', error);
    }
  }
}

module.exports = StripeConnectService;
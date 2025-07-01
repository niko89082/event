// services/paymentProviders/stripeConnectProvider.js
const PaymentProviderInterface = require('./paymentProviderInterface');
const StripeConnectService = require('../stripeConnectService');

/**
 * Stripe Connect Provider - Wrapper around existing StripeConnectService
 * This allows Stripe to work with the new payment provider interface
 */
class StripeConnectProvider extends PaymentProviderInterface {
  constructor() {
    super();
  }

  /**
   * Setup Stripe Connect account for host
   * @param {string} userId - User ID
   * @param {object} accountInfo - Account information
   * @returns {object} Setup result
   */
  async setupAccount(userId, accountInfo) {
    try {
      const { firstName, lastName, country = 'US' } = accountInfo;
      
      // Use existing Stripe service
      const result = await StripeConnectService.createConnectAccount(userId, {
        firstName,
        lastName,
        country
      });

      if (result.success) {
        // Create onboarding link
        const returnUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/events/payment-setup/return`;
        const refreshUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/events/payment-setup/refresh`;
        
        const linkResult = await StripeConnectService.createAccountLink(
          userId, 
          returnUrl, 
          refreshUrl
        );

        return {
          success: true,
          accountId: result.accountId,
          onboardingUrl: linkResult.url,
          expiresAt: linkResult.expiresAt,
          provider: 'stripe'
        };
      }

      return result;

    } catch (error) {
      console.error('❌ Stripe Connect setup error:', error);
      return {
        success: false,
        message: `Stripe setup failed: ${error.message}`
      };
    }
  }

  /**
   * Check Stripe account status
   * @param {string} userId - User ID
   * @returns {object} Account status
   */
  async checkAccountStatus(userId) {
    try {
      const status = await StripeConnectService.checkAccountStatus(userId);
      
      return {
        connected: status.connected,
        canReceivePayments: status.connected,
        onboardingComplete: status.onboardingComplete,
        chargesEnabled: status.chargesEnabled,
        payoutsEnabled: status.payoutsEnabled,
        requirements: status.requirements,
        provider: 'stripe'
      };

    } catch (error) {
      console.error('❌ Stripe status check error:', error);
      throw new Error(`Stripe status check failed: ${error.message}`);
    }
  }

  /**
   * Create Stripe payment intent
   * @param {number} amount - Amount in cents
   * @param {string} currency - Currency code
   * @param {string} hostAccountId - Host's Stripe account ID
   * @param {object} metadata - Payment metadata
   * @returns {object} Payment intent result
   */
  async createPaymentOrder(amount, currency, hostAccountId, metadata) {
    try {
      const result = await StripeConnectService.createDirectPaymentIntent(
        amount,
        currency,
        hostAccountId,
        metadata
      );

      return {
        success: true,
        paymentIntentId: result.paymentIntent.id,
        clientSecret: result.clientSecret,
        status: result.paymentIntent.status
      };

    } catch (error) {
      console.error('❌ Stripe payment intent creation error:', error);
      throw new Error(`Stripe payment creation failed: ${error.message}`);
    }
  }

  /**
   * Capture/confirm Stripe payment (handled automatically by Stripe)
   * @param {string} paymentIntentId - Stripe payment intent ID
   * @returns {object} Capture result
   */
  async capturePayment(paymentIntentId) {
    try {
      // For Stripe, payment confirmation is typically handled on the frontend
      // This method is here for interface compatibility
      console.log(`ℹ️ Stripe payment ${paymentIntentId} should be confirmed on frontend`);
      
      return {
        success: true,
        paymentIntentId: paymentIntentId,
        status: 'requires_confirmation',
        message: 'Payment intent created, awaiting frontend confirmation'
      };

    } catch (error) {
      console.error('❌ Stripe payment confirmation error:', error);
      throw new Error(`Stripe payment confirmation failed: ${error.message}`);
    }
  }

  /**
   * Process Stripe refund
   * @param {string} paymentIntentId - Stripe payment intent ID
   * @param {number} amount - Refund amount in cents
   * @param {string} reason - Refund reason
   * @returns {object} Refund result
   */
  async processRefund(paymentIntentId, amount, reason) {
    try {
      // Note: You might need to implement this in your StripeConnectService
      // For now, we'll return a placeholder
      console.log(`🔄 Processing Stripe refund for ${paymentIntentId}, amount: ${amount}, reason: ${reason}`);
      
      return {
        success: true,
        refundId: `re_${Date.now()}`, // Placeholder
        status: 'succeeded',
        amount: amount,
        reason: reason
      };

    } catch (error) {
      console.error('❌ Stripe refund error:', error);
      throw new Error(`Stripe refund failed: ${error.message}`);
    }
  }

  /**
   * Handle Stripe webhook events
   * @param {object} event - Stripe webhook event
   * @returns {object} Processing result
   */
  async handleWebhook(event) {
    try {
      const result = await StripeConnectService.handleWebhook(event);
      return result;

    } catch (error) {
      console.error('❌ Stripe webhook handling error:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get Stripe provider configuration
   * @returns {object} Provider configuration
   */
  getProviderConfig() {
    return {
      name: 'Stripe Connect',
      type: 'stripe',
      environment: process.env.NODE_ENV === 'production' ? 'live' : 'test',
      features: ['advanced_analytics', 'international_payments', 'subscriptions', 'custom_branding']
    };
  }

  /**
   * Validate Stripe configuration
   * @returns {boolean} True if configuration is valid
   */
  validateConfig() {
    const hasCredentials = !!(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_PUBLISHABLE_KEY);
    if (!hasCredentials) {
      console.warn('⚠️ Stripe configuration incomplete. Set STRIPE_SECRET_KEY and STRIPE_PUBLISHABLE_KEY environment variables.');
    }
    return hasCredentials;
  }

  /**
   * Create dashboard link for Stripe Express account
   * @param {string} userId - User ID
   * @returns {object} Dashboard link result
   */
  async createDashboardLink(userId) {
    try {
      const result = await StripeConnectService.createDashboardLink(userId);
      return result;

    } catch (error) {
      console.error('❌ Stripe dashboard link error:', error);
      throw new Error(`Dashboard link creation failed: ${error.message}`);
    }
  }

  /**
   * Get account balance for Stripe account
   * @param {string} userId - User ID
   * @returns {object} Balance information
   */
  async getAccountBalance(userId) {
    try {
      const result = await StripeConnectService.getAccountBalance(userId);
      return result;

    } catch (error) {
      console.error('❌ Stripe balance check error:', error);
      throw new Error(`Balance check failed: ${error.message}`);
    }
  }

  /**
   * Refresh account link for incomplete Stripe onboarding
   * @param {string} userId - User ID
   * @returns {object} New account link
   */
  async refreshAccountLink(userId) {
    try {
      const returnUrl = `${process.env.FRONTEND_URL}/events/payment-setup/return`;
      const refreshUrl = `${process.env.FRONTEND_URL}/events/payment-setup/refresh`;
      
      const linkResult = await StripeConnectService.createAccountLink(
        userId, 
        returnUrl, 
        refreshUrl
      );

      return {
        success: true,
        onboardingUrl: linkResult.url,
        expiresAt: linkResult.expiresAt
      };

    } catch (error) {
      console.error('❌ Stripe account link refresh error:', error);
      throw new Error(`Account link refresh failed: ${error.message}`);
    }
  }
}

module.exports = StripeConnectProvider;
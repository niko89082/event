// services/paymentProviders/paymentProviderFactory.js
const path = require('path');
const fs = require('fs');

// Check if providers exist before requiring them
const paypalProviderPath = path.join(__dirname, 'paypalProvider.js');
const stripeProviderPath = path.join(__dirname, 'stripeConnectProvider.js');

let PayPalProvider, StripeConnectProvider;

// Conditionally require providers
if (fs.existsSync(paypalProviderPath)) {
  PayPalProvider = require('./paypalProvider');
  console.log('✅ PayPal provider loaded');
} else {
  console.warn('⚠️ PayPal provider not found at:', paypalProviderPath);
}

if (fs.existsSync(stripeProviderPath)) {
  StripeConnectProvider = require('./stripeConnectProvider');
  console.log('✅ Stripe provider loaded');
} else {
  console.warn('⚠️ Stripe provider not found at:', stripeProviderPath);
}

/**
 * Factory class for creating payment provider instances
 * Handles provider selection and configuration
 */
class PaymentProviderFactory {
  /**
   * Get a payment provider instance by type
   * @param {string} type - Provider type ('paypal', 'stripe', etc.)
   * @returns {PaymentProviderInterface} Provider instance
   */
  static getProvider(type) {
    switch (type.toLowerCase()) {
      case 'paypal':
        if (!PayPalProvider) {
          throw new Error('PayPal provider not available. Please ensure paypalProvider.js exists in services/paymentProviders/');
        }
        return new PayPalProvider();
      
      case 'stripe':
        if (!StripeConnectProvider) {
          throw new Error('Stripe provider not available. Please ensure stripeConnectProvider.js exists in services/paymentProviders/');
        }
        return new StripeConnectProvider();
      
      default:
        throw new Error(`Unsupported payment provider type: ${type}`);
    }
  }

  /**
   * Get all available payment providers with their metadata
   * @returns {Array} Array of provider configurations
   */
  static getAvailableProviders() {
    const providers = [];

    // PayPal Provider
    if (PayPalProvider && PaymentProviderFactory.isProviderConfigured('paypal')) {
      providers.push({
        type: 'paypal',
        name: 'PayPal',
        description: 'Quick setup with just your PayPal email address',
        setupTime: '1 minute',
        fees: '2.9% + $0.30 per transaction',
        recommended: true,
        features: [
          'Accept credit cards',
          'PayPal account payments',
          'Buyer protection',
          'Mobile optimized',
          'No business verification required',
          'Instant activation'
        ]
      });
    }

    // Stripe Provider
    if (StripeConnectProvider && PaymentProviderFactory.isProviderConfigured('stripe')) {
      providers.push({
        type: 'stripe',
        name: 'Stripe Connect',
        description: 'Professional payment processing with advanced features',
        setupTime: '5-10 minutes',
        fees: '2.9% + $0.30 per transaction',
        recommended: false,
        features: [
          'Advanced analytics',
          'Subscription billing',
          'International payments',
          'Custom branding',
          'Detailed reporting',
          'API flexibility'
        ]
      });
    }

    return providers;
  }

  /**
   * Check if a payment provider is properly configured
   * @param {string} type - Provider type
   * @returns {boolean} True if provider is configured
   */
  static isProviderConfigured(type) {
    switch (type.toLowerCase()) {
      case 'paypal':
        return !!(process.env.PAYPAL_CLIENT_ID && process.env.PAYPAL_CLIENT_SECRET);
      
      case 'stripe':
        return !!(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_PUBLISHABLE_KEY);
      
      default:
        return false;
    }
  }

  /**
   * Validate that a provider type is supported
   * @param {string} type - Provider type to validate
   * @returns {boolean} True if provider is supported
   */
  static isProviderSupported(type) {
    const supportedProviders = [];
    
    if (PayPalProvider) supportedProviders.push('paypal');
    if (StripeConnectProvider) supportedProviders.push('stripe');
    
    return supportedProviders.includes(type.toLowerCase());
  }

  /**
   * Create provider instance with validation
   * @param {string} type - Provider type
   * @returns {PaymentProviderInterface} Validated provider instance
   */
  static createProvider(type) {
    if (!PaymentProviderFactory.isProviderSupported(type)) {
      throw new Error(`Provider type '${type}' is not supported or not available`);
    }

    if (!PaymentProviderFactory.isProviderConfigured(type)) {
      console.warn(`⚠️ Provider '${type}' is not properly configured. Check environment variables.`);
    }

    const provider = PaymentProviderFactory.getProvider(type);
    
    // Try to validate config, but don't fail if it's not configured
    try {
      if (!provider.validateConfig()) {
        console.warn(`⚠️ Provider '${type}' configuration validation failed`);
      }
    } catch (error) {
      console.warn(`⚠️ Provider '${type}' validation error:`, error.message);
    }

    return provider;
  }

  /**
   * Get list of loaded providers
   * @returns {Array} Array of loaded provider types
   */
  static getLoadedProviders() {
    const loaded = [];
    if (PayPalProvider) loaded.push('paypal');
    if (StripeConnectProvider) loaded.push('stripe');
    return loaded;
  }
}

module.exports = PaymentProviderFactory;
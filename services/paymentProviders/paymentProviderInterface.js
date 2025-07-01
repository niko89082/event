// services/paymentProviders/paymentProviderInterface.js
/**
 * Abstract base class for payment providers
 * Defines the interface that all payment providers must implement
 */
class PaymentProviderInterface {
  /**
   * Setup payment account for a host
   * @param {string} userId - User ID
   * @param {object} accountInfo - Account setup information
   * @returns {Promise<object>} Setup result with success status and details
   */
  async setupAccount(userId, accountInfo) {
    throw new Error('setupAccount method must be implemented by payment provider');
  }

  /**
   * Check the status of a payment account
   * @param {string} userId - User ID
   * @returns {Promise<object>} Account status information
   */
  async checkAccountStatus(userId) {
    throw new Error('checkAccountStatus method must be implemented by payment provider');
  }

  /**
   * Create a payment order/intent for processing
   * @param {number} amount - Amount in cents
   * @param {string} currency - Currency code (e.g., 'USD')
   * @param {string} hostAccount - Host's payment account identifier
   * @param {object} metadata - Additional payment metadata
   * @returns {Promise<object>} Payment order/intent details
   */
  async createPaymentOrder(amount, currency, hostAccount, metadata) {
    throw new Error('createPaymentOrder method must be implemented by payment provider');
  }

  /**
   * Capture/complete a payment
   * @param {string} paymentId - Payment identifier to capture
   * @returns {Promise<object>} Capture result
   */
  async capturePayment(paymentId) {
    throw new Error('capturePayment method must be implemented by payment provider');
  }

  /**
   * Process a refund
   * @param {string} paymentId - Original payment identifier
   * @param {number} amount - Refund amount in cents
   * @param {string} reason - Reason for refund
   * @returns {Promise<object>} Refund result
   */
  async processRefund(paymentId, amount, reason) {
    throw new Error('processRefund method must be implemented by payment provider');
  }

  /**
   * Handle webhook events from the payment provider
   * @param {object} event - Webhook event data
   * @returns {Promise<object>} Processing result
   */
  async handleWebhook(event) {
    throw new Error('handleWebhook method must be implemented by payment provider');
  }

  /**
   * Get payment provider specific configuration
   * @returns {object} Provider configuration
   */
  getProviderConfig() {
    throw new Error('getProviderConfig method must be implemented by payment provider');
  }

  /**
   * Validate that required configuration is present
   * @returns {boolean} True if configuration is valid
   */
  validateConfig() {
    throw new Error('validateConfig method must be implemented by payment provider');
  }
}

module.exports = PaymentProviderInterface;
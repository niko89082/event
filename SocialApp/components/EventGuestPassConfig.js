// components/EventGuestPassConfig.js - Configuration UI for guest passes
import React, { useState } from 'react';
import {
  View, Text, StyleSheet, Switch, TextInput, TouchableOpacity, Alert
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export default function EventGuestPassConfig({ 
  config, 
  onConfigChange, 
  eventDate 
}) {
  const [allowGuestPasses, setAllowGuestPasses] = useState(config?.allowGuestPasses || false);
  const [guestPassExpiry, setGuestPassExpiry] = useState(config?.guestPassExpiry?.toString() || '4');
  const [coverChargeEnabled, setCoverChargeEnabled] = useState(config?.coverCharge?.enabled || false);
  const [coverChargeAmount, setCoverChargeAmount] = useState(config?.coverCharge?.amount?.toString() || '0');
  const [currency, setCurrency] = useState(config?.coverCharge?.currency || 'USD');

  const handleConfigUpdate = () => {
    const newConfig = {
      allowGuestPasses,
      guestPassExpiry: parseInt(guestPassExpiry) || 4,
      coverCharge: {
        enabled: coverChargeEnabled,
        amount: parseFloat(coverChargeAmount) * 100 || 0, // Convert to cents
        currency
      }
    };
    onConfigChange(newConfig);
  };

  React.useEffect(() => {
    handleConfigUpdate();
  }, [allowGuestPasses, guestPassExpiry, coverChargeEnabled, coverChargeAmount, currency]);

  const formatCurrency = (amount) => {
    return (amount / 100).toFixed(2);
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Ionicons name="ticket-outline" size={24} color="#3797EF" />
        <Text style={styles.headerTitle}>Guest Pass Settings</Text>
      </View>
      
      <Text style={styles.description}>
        Allow people without the app to RSVP and get QR codes for entry
      </Text>

      {/* Enable Guest Passes */}
      <View style={styles.settingRow}>
        <View style={styles.settingInfo}>
          <Text style={styles.settingTitle}>Enable Guest Passes</Text>
          <Text style={styles.settingSubtitle}>
            Create invitation links for non-app users
          </Text>
        </View>
        <Switch
          value={allowGuestPasses}
          onValueChange={setAllowGuestPasses}
          trackColor={{ false: '#E5E5E7', true: '#3797EF' }}
          thumbColor="#FFFFFF"
        />
      </View>

      {allowGuestPasses && (
        <>
          {/* Guest Pass Expiry */}
          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingTitle}>Entry Cutoff</Text>
              <Text style={styles.settingSubtitle}>
                Hours before event when passes expire
              </Text>
            </View>
            <View style={styles.inputContainer}>
              <TextInput
                style={styles.numberInput}
                value={guestPassExpiry}
                onChangeText={setGuestPassExpiry}
                keyboardType="numeric"
                placeholder="4"
              />
              <Text style={styles.inputUnit}>hrs</Text>
            </View>
          </View>

          {/* Cover Charge */}
          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingTitle}>Cover Charge</Text>
              <Text style={styles.settingSubtitle}>
                Charge guest pass holders entry fee
              </Text>
            </View>
            <Switch
              value={coverChargeEnabled}
              onValueChange={setCoverChargeEnabled}
              trackColor={{ false: '#E5E5E7', true: '#3797EF' }}
              thumbColor="#FFFFFF"
            />
          </View>

          {coverChargeEnabled && (
            <View style={styles.chargeConfig}>
              <View style={styles.amountRow}>
                <View style={styles.currencySelector}>
                  <TouchableOpacity 
                    style={styles.currencyButton}
                    onPress={() => {
                      Alert.alert(
                        'Currency',
                        'Select currency',
                        [
                          { text: 'USD ($)', onPress: () => setCurrency('USD') },
                          { text: 'EUR (€)', onPress: () => setCurrency('EUR') },
                          { text: 'GBP (£)', onPress: () => setCurrency('GBP') },
                          { text: 'Cancel', style: 'cancel' }
                        ]
                      );
                    }}
                  >
                    <Text style={styles.currencyText}>
                      {currency === 'USD' ? '$' : currency === 'EUR' ? '€' : '£'}
                    </Text>
                    <Ionicons name="chevron-down" size={16} color="#8E8E93" />
                  </TouchableOpacity>
                </View>
                <TextInput
                  style={styles.amountInput}
                  value={coverChargeAmount}
                  onChangeText={setCoverChargeAmount}
                  keyboardType="decimal-pad"
                  placeholder="0.00"
                />
              </View>
              <Text style={styles.chargeNote}>
                Guest pass holders will pay via Stripe before receiving their QR code
              </Text>
            </View>
          )}

          {/* Preview Box */}
          <View style={styles.previewBox}>
            <View style={styles.previewHeader}>
              <Ionicons name="eye-outline" size={20} color="#3797EF" />
              <Text style={styles.previewTitle}>Guest Experience</Text>
            </View>
            <View style={styles.previewStep}>
              <Text style={styles.previewStepNumber}>1</Text>
              <Text style={styles.previewStepText}>
                Receive invitation link via SMS/email
              </Text>
            </View>
            <View style={styles.previewStep}>
              <Text style={styles.previewStepNumber}>2</Text>
              <Text style={styles.previewStepText}>
                Open link and fill RSVP form
                {coverChargeEnabled && ` + pay $${formatCurrency(parseFloat(coverChargeAmount) * 100 || 0)}`}
              </Text>
            </View>
            <View style={styles.previewStep}>
              <Text style={styles.previewStepNumber}>3</Text>
              <Text style={styles.previewStepText}>
                Get QR code for event entry
              </Text>
            </View>
            <View style={styles.previewStep}>
              <Text style={styles.previewStepNumber}>4</Text>
              <Text style={styles.previewStepText}>
                Pass expires {guestPassExpiry || 4} hours before event
              </Text>
            </View>
          </View>

          {/* Security Note */}
          <View style={styles.securityNote}>
            <Ionicons name="shield-checkmark-outline" size={20} color="#4CAF50" />
            <Text style={styles.securityText}>
              All guest passes use encrypted QR codes and expire automatically for security
            </Text>
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    marginVertical: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#000000',
    marginLeft: 12,
  },
  description: {
    fontSize: 14,
    color: '#8E8E93',
    lineHeight: 20,
    marginBottom: 20,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F2F2F7',
  },
  settingInfo: {
    flex: 1,
    marginRight: 16,
  },
  settingTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 4,
  },
  settingSubtitle: {
    fontSize: 14,
    color: '#8E8E93',
    lineHeight: 18,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  numberInput: {
    borderWidth: 1,
    borderColor: '#E5E5E7',
    borderRadius: 8,
    padding: 8,
    width: 60,
    textAlign: 'center',
    fontSize: 16,
    color: '#000000',
  },
  inputUnit: {
    fontSize: 14,
    color: '#8E8E93',
    marginLeft: 8,
  },
  chargeConfig: {
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    padding: 16,
    marginTop: 8,
  },
  amountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  currencySelector: {
    marginRight: 12,
  },
  currencyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E5E7',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  currencyText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
    marginRight: 4,
  },
  amountInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#E5E5E7',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#000000',
    backgroundColor: '#FFFFFF',
  },
  chargeNote: {
    fontSize: 12,
    color: '#8E8E93',
    fontStyle: 'italic',
  },
  previewBox: {
    backgroundColor: '#F0F8FF',
    borderRadius: 12,
    padding: 16,
    marginTop: 16,
    borderWidth: 1,
    borderColor: '#E1F5FE',
  },
  previewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  previewTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#3797EF',
    marginLeft: 8,
  },
  previewStep: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  previewStepNumber: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#3797EF',
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 20,
    marginRight: 12,
  },
  previewStepText: {
    flex: 1,
    fontSize: 14,
    color: '#1a1a1a',
    lineHeight: 20,
  },
  securityNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#F0F8F0',
    borderRadius: 8,
    padding: 12,
    marginTop: 16,
  },
  securityText: {
    flex: 1,
    fontSize: 12,
    color: '#4CAF50',
    marginLeft: 8,
    lineHeight: 16,
  },
});
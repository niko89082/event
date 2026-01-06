// screens/EventDateTimePickerScreen.js
import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, SafeAreaView,
  StatusBar, Platform
} from 'react-native';
import { Calendar } from 'react-native-calendars';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';

export default function EventDateTimePickerScreen({ navigation, route }) {
  const initialStartTime = route.params?.startDateTime 
    ? new Date(route.params.startDateTime) 
    : new Date();
  const initialEndTime = route.params?.endDateTime 
    ? new Date(route.params.endDateTime) 
    : null;

  const [selectedDate, setSelectedDate] = useState(initialStartTime);
  const [startTime, setStartTime] = useState(initialStartTime);
  const [endTime, setEndTime] = useState(initialEndTime);
  const [activePicker, setActivePicker] = useState(null); // 'start' | 'end' | null
  const [showTimePicker, setShowTimePicker] = useState(false);

  // Format date for calendar (YYYY-MM-DD)
  const formatDateForCalendar = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Format time for display (HH:MM AM/PM)
  const formatTime = (date) => {
    if (!date) return '';
    const hours = date.getHours();
    const minutes = date.getMinutes();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours % 12 || 12;
    const displayMinutes = String(minutes).padStart(2, '0');
    return `${displayHours}:${displayMinutes} ${ampm}`;
  };

  // Get marked dates for calendar
  const getMarkedDates = () => {
    const dateStr = formatDateForCalendar(selectedDate);
    return {
      [dateStr]: {
        selected: true,
        selectedColor: '#3b82f6',
        selectedTextColor: '#FFFFFF'
      }
    };
  };

  // Handle date selection from calendar
  const handleDayPress = (day) => {
    const newDate = new Date(day.dateString);
    setSelectedDate(newDate);
    
    // Update start time date
    const newStartTime = new Date(startTime);
    newStartTime.setFullYear(newDate.getFullYear());
    newStartTime.setMonth(newDate.getMonth());
    newStartTime.setDate(newDate.getDate());
    setStartTime(newStartTime);
    
    // Update end time date if it exists
    if (endTime) {
      const newEndTime = new Date(endTime);
      newEndTime.setFullYear(newDate.getFullYear());
      newEndTime.setMonth(newDate.getMonth());
      newEndTime.setDate(newDate.getDate());
      setEndTime(newEndTime);
    }
  };

  // Handle time picker change
  const handleTimeChange = (event, selectedTime) => {
    if (Platform.OS === 'android') {
      setShowTimePicker(false);
    }
    
    if (selectedTime && activePicker) {
      if (activePicker === 'start') {
        const newStartTime = new Date(startTime);
        newStartTime.setHours(selectedTime.getHours());
        newStartTime.setMinutes(selectedTime.getMinutes());
        setStartTime(newStartTime);
        setSelectedDate(newStartTime);
      } else if (activePicker === 'end') {
        const newEndTime = new Date(endTime || startTime);
        newEndTime.setHours(selectedTime.getHours());
        newEndTime.setMinutes(selectedTime.getMinutes());
        setEndTime(newEndTime);
      }
    }
    
    if (Platform.OS === 'ios') {
      setShowTimePicker(false);
    }
    setActivePicker(null);
  };

  // Handle set times button
  const handleSetTimes = () => {
    const previousScreen = route.params?.fromScreen || 'CreateEventScreen';
    const screenName = previousScreen === 'EditEventScreen' ? 'EditEventScreen' : 'CreateEventScreen';
    
    navigation.navigate(screenName, {
      startDateTime: startTime.toISOString(),
      endDateTime: endTime ? endTime.toISOString() : null
    });
  };

  // Handle cancel
  const handleCancel = () => {
    navigation.goBack();
  };

  useEffect(() => {
    navigation.setOptions({
      headerStyle: {
        backgroundColor: '#FFFFFF',
        shadowOpacity: 0,
        elevation: 0,
        borderBottomWidth: 0.5,
        borderBottomColor: '#E1E1E1',
      },
      headerTitleStyle: {
        fontWeight: '600',
        fontSize: 18,
        color: '#000000',
      },
      headerTitle: 'Select Date & Time',
      headerLeft: () => (
        <TouchableOpacity
          onPress={handleCancel}
          style={styles.headerButton}
        >
          <Text style={styles.cancelButtonText}>Cancel</Text>
        </TouchableOpacity>
      ),
      headerRight: () => <View style={{ width: 60 }} />,
    });
  }, [navigation]);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      
      <View style={styles.content}>
        {/* Time Selection Cards */}
        <View style={styles.timeCardsContainer}>
          {/* Start Time Card */}
          <TouchableOpacity
            style={[
              styles.timeCard,
              activePicker === 'start' && styles.timeCardActive
            ]}
            onPress={() => {
              setActivePicker('start');
              setShowTimePicker(true);
            }}
          >
            <View style={styles.timeCardLeft}>
              <View style={[
                styles.timeIconContainer,
                activePicker === 'start' && styles.timeIconContainerActive
              ]}>
                <Ionicons 
                  name="time-outline" 
                  size={20} 
                  color={activePicker === 'start' ? '#3b82f6' : '#8E8E93'} 
                />
              </View>
              <View style={styles.timeCardContent}>
                <Text style={styles.timeCardLabel}>START TIME</Text>
                <Text style={[
                  styles.timeCardValue,
                  activePicker === 'start' && styles.timeCardValueActive
                ]}>
                  {formatTime(startTime)}
                </Text>
              </View>
            </View>
            {activePicker === 'start' && (
              <View style={styles.activeIndicator} />
            )}
          </TouchableOpacity>

          {/* End Time Card */}
          <TouchableOpacity
            style={[
              styles.timeCard,
              activePicker === 'end' && styles.timeCardActive
            ]}
            onPress={() => {
              setActivePicker('end');
              setShowTimePicker(true);
            }}
          >
            <View style={styles.timeCardLeft}>
              <View style={[
                styles.timeIconContainer,
                activePicker === 'end' && styles.timeIconContainerActive
              ]}>
                <Ionicons 
                  name="time-outline" 
                  size={20} 
                  color={activePicker === 'end' ? '#3b82f6' : '#8E8E93'} 
                />
              </View>
              <View style={styles.timeCardContent}>
                <Text style={styles.timeCardLabel}>END TIME</Text>
                <Text style={[
                  styles.timeCardValue,
                  activePicker === 'end' && styles.timeCardValueActive
                ]}>
                  {endTime ? formatTime(endTime) : 'Not set'}
                </Text>
                {!endTime && (
                  <Text style={styles.optionalText}>(Optional)</Text>
                )}
              </View>
            </View>
            {activePicker === 'end' && (
              <View style={styles.activeIndicator} />
            )}
          </TouchableOpacity>
        </View>

        {/* Calendar */}
        <View style={styles.calendarContainer}>
          <Calendar
            current={formatDateForCalendar(selectedDate)}
            onDayPress={handleDayPress}
            markedDates={getMarkedDates()}
            theme={{
              backgroundColor: '#ffffff',
              calendarBackground: '#ffffff',
              textSectionTitleColor: '#8E8E93',
              selectedDayBackgroundColor: '#3b82f6',
              selectedDayTextColor: '#ffffff',
              todayTextColor: '#3b82f6',
              dayTextColor: '#000000',
              textDisabledColor: '#E5E5EA',
              dotColor: '#3b82f6',
              selectedDotColor: '#ffffff',
              arrowColor: '#3b82f6',
              monthTextColor: '#000000',
              indicatorColor: '#3b82f6',
              textDayFontWeight: '500',
              textMonthFontWeight: '600',
              textDayHeaderFontWeight: '600',
              textDayFontSize: 16,
              textMonthFontSize: 18,
              textDayHeaderFontSize: 13
            }}
            minDate={formatDateForCalendar(new Date())}
          />
        </View>
      </View>

      {/* Set Times Button */}
      <View style={styles.buttonContainer}>
        <TouchableOpacity
          style={styles.setTimesButton}
          onPress={handleSetTimes}
        >
          <Ionicons name="checkmark" size={20} color="#FFFFFF" />
          <Text style={styles.setTimesButtonText}>Set Times</Text>
        </TouchableOpacity>
      </View>

      {/* Time Picker Modal */}
      {showTimePicker && (
        <DateTimePicker
          value={activePicker === 'start' ? startTime : (endTime || startTime)}
          mode="time"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={handleTimeChange}
          is24Hour={false}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  headerButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  cancelButtonText: {
    fontSize: 16,
    color: '#3b82f6',
    fontWeight: '500',
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  timeCardsContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  timeCard: {
    flex: 1,
    backgroundColor: '#F8F9FA',
    borderRadius: 16,
    padding: 16,
    borderWidth: 2,
    borderColor: 'transparent',
    position: 'relative',
  },
  timeCardActive: {
    borderColor: '#3b82f6',
    backgroundColor: '#EFF6FF',
  },
  timeCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  timeIconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#E5E5EA',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  timeIconContainerActive: {
    backgroundColor: '#DBEAFE',
  },
  timeCardContent: {
    flex: 1,
  },
  timeCardLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#8E8E93',
    letterSpacing: 0.5,
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  timeCardValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#000000',
  },
  timeCardValueActive: {
    color: '#3b82f6',
  },
  optionalText: {
    fontSize: 12,
    color: '#8E8E93',
    marginTop: 2,
  },
  activeIndicator: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
    backgroundColor: '#3b82f6',
    borderTopLeftRadius: 16,
    borderBottomLeftRadius: 16,
  },
  calendarContainer: {
    marginTop: 8,
  },
  buttonContainer: {
    paddingHorizontal: 20,
    paddingBottom: 20,
    paddingTop: 16,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E5E5EA',
  },
  setTimesButton: {
    backgroundColor: '#3b82f6',
    borderRadius: 12,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowColor: '#3b82f6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  setTimesButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
});

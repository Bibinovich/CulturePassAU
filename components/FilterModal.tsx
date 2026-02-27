import React from 'react';
import { View, Text, StyleSheet, Pressable, Modal, TouchableWithoutFeedback } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export type DateFilter = 'all' | 'today' | 'this_weekend';

interface FilterModalProps {
  visible: boolean;
  onClose: () => void;
  selectedDateFilter: DateFilter;
  onDateFilterChange: (filter: DateFilter) => void;
}

export default function FilterModal({
  visible,
  onClose,
  selectedDateFilter,
  onDateFilterChange,
}: FilterModalProps) {
  const insets = useSafeAreaInsets();

  const handleApply = () => {
    onClose();
  };

  const handleClear = () => {
    onDateFilterChange('all');
  };

  return (
    <Modal
      animationType="fade"
      transparent={true}
      visible={visible}
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback>
            <View style={[styles.modalView, { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 20 }]}>
              <View style={styles.header}>
                <Text style={styles.headerTitle}>Filter Events</Text>
                <Pressable onPress={onClose} style={styles.closeButton}>
                  <Ionicons name="close" size={24} color={Colors.text} />
                </Pressable>
              </View>
              <View style={styles.content}>
                <Text style={styles.sectionTitle}>Date</Text>
                <View style={styles.dateOptions}>
                  <Pressable
                    style={[styles.dateOption, selectedDateFilter === 'today' && styles.dateOptionSelected]}
                    onPress={() => onDateFilterChange('today')}
                  >
                    <Text style={[styles.dateOptionText, selectedDateFilter === 'today' && styles.dateOptionTextSelected]}>
                      Today
                    </Text>
                  </Pressable>
                  <Pressable
                    style={[styles.dateOption, selectedDateFilter === 'this_weekend' && styles.dateOptionSelected]}
                    onPress={() => onDateFilterChange('this_weekend')}
                  >
                    <Text style={[styles.dateOptionText, selectedDateFilter === 'this_weekend' && styles.dateOptionTextSelected]}>
                      This Weekend
                    </Text>
                  </Pressable>
                </View>
              </View>
              <View style={styles.footer}>
                <Pressable style={[styles.button, styles.clearButton]} onPress={handleClear}>
                  <Text style={styles.clearButtonText}>Clear</Text>
                </Pressable>
                <Pressable style={[styles.button, styles.applyButton]} onPress={handleApply}>
                  <Text style={styles.applyButtonText}>Apply Filters</Text>
                </Pressable>
              </View>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalView: {
    backgroundColor: Colors.background,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: -2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  headerTitle: {
    fontFamily: 'Poppins_700Bold',
    fontSize: 20,
    color: Colors.text,
  },
  closeButton: {
    padding: 4,
  },
  content: {
    paddingHorizontal: 20,
    paddingVertical: 20,
  },
  sectionTitle: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 16,
    color: Colors.text,
    marginBottom: 12,
  },
  dateOptions: {
    flexDirection: 'row',
    gap: 10,
  },
  dateOption: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  dateOptionSelected: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  dateOptionText: {
    fontFamily: 'Poppins_500Medium',
    fontSize: 14,
    color: Colors.text,
  },
  dateOptionTextSelected: {
    color: '#FFF',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
  },
  button: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
    borderRadius: 12,
  },
  clearButton: {
    backgroundColor: Colors.surface,
    marginRight: 10,
  },
  clearButtonText: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 16,
    color: Colors.text,
  },
  applyButton: {
    backgroundColor: Colors.primary,
  },
  applyButtonText: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 16,
    color: '#FFF',
  },
});

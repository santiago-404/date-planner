import { supabase } from '@/lib/supabase';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

const AREAS = ['Intramuros', 'BGC', 'Makati'] as const;

// Build a rolling 7-day date picker
const DATES = Array.from({ length: 7 }, (_, i) => {
  const d = new Date();
  d.setDate(d.getDate() + i);
  return {
    label:
      i === 0
        ? 'Today'
        : i === 1
        ? 'Tomorrow'
        : d.toLocaleDateString('en-PH', {
            weekday: 'short',
            month: 'short',
            day: 'numeric',
          }),
    value: d.toISOString().split('T')[0],
  };
});

export default function SubmitAvailability() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const [selectedDate, setSelectedDate] = useState(DATES[0].value);
  const [timeSlot, setTimeSlot] = useState<'day' | 'night'>('day');
  const [area, setArea] = useState<(typeof AREAS)[number]>('BGC');
  const [budgetStr, setBudgetStr] = useState('500');

  const [saving, setSaving] = useState(false);
  const [fetching, setFetching] = useState(true);

  // Pre-fill if this user has already submitted
  useEffect(() => {
    const prefill = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await supabase
        .from('participant_inputs')
        .select('*')
        .eq('group_id', id)
        .eq('user_id', user.id)
        .maybeSingle(); // returns null instead of error if no row

      if (data) {
        setBudgetStr(String(data.budget_contribution ?? 500));
        setArea((data.preferred_area as any) ?? 'BGC');
        setTimeSlot((data.time_slot as any) ?? 'day');
        // Only pre-select date if it's still in the coming 7 days
        if (DATES.some((d) => d.value === data.available_date)) {
          setSelectedDate(data.available_date);
        }
      }
      setFetching(false);
    };
    prefill();
  }, [id]);

  const handleSave = async () => {
    const budget = parseInt(budgetStr) || 0;
    if (budget <= 0) {
      Alert.alert('Budget required', 'Enter how much you can contribute.');
      return;
    }

    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase.from('participant_inputs').upsert(
      {
        group_id: id,
        user_id: user.id,
        available_date: selectedDate,
        time_slot: timeSlot,
        budget_contribution: budget,
        preferred_area: area,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'group_id,user_id' } // update if row already exists
    );

    setSaving(false);

    if (error) {
      Alert.alert('Error saving', error.message);
      return;
    }

    router.back(); // return to group room — realtime will update it instantly
  };

  if (fetching) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color="#FF5A5F" />
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>My Availability</Text>

      {/* DATE */}
      <Text style={styles.label}>Which day?</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.chipRow}
        contentContainerStyle={{ gap: 10, paddingRight: 20 }}
      >
        {DATES.map((d) => (
          <TouchableOpacity
            key={d.value}
            style={[styles.dateChip, selectedDate === d.value && styles.selectedChip]}
            onPress={() => setSelectedDate(d.value)}
          >
            <Text
              style={[
                styles.dateChipText,
                selectedDate === d.value && styles.selectedChipText,
              ]}
            >
              {d.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* TIME SLOT */}
      <Text style={styles.label}>Time of day</Text>
      <View style={styles.row}>
        {[
          { label: '☀️  Day', value: 'day' },
          { label: '🌙  Night', value: 'night' },
        ].map((t) => (
          <TouchableOpacity
            key={t.value}
            style={[styles.timeBtn, timeSlot === t.value && styles.selectedTimeBtn]}
            onPress={() => setTimeSlot(t.value as any)}
          >
            <Text
              style={[
                styles.timeBtnText,
                timeSlot === t.value && styles.selectedTimeBtnText,
              ]}
            >
              {t.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* AREA */}
      <Text style={styles.label}>Preferred area</Text>
      <View style={styles.row}>
        {AREAS.map((loc) => (
          <TouchableOpacity
            key={loc}
            style={[styles.areaChip, area === loc && styles.selectedChip]}
            onPress={() => setArea(loc)}
          >
            <Text style={[styles.areaChipText, area === loc && styles.selectedChipText]}>
              {loc}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* BUDGET */}
      <Text style={styles.label}>My budget contribution (₱)</Text>
      <TextInput
        style={styles.input}
        keyboardType="numeric"
        value={budgetStr}
        onChangeText={setBudgetStr}
        placeholder="e.g. 500"
        returnKeyType="done"
      />

      <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={saving}>
        {saving ? (
          <ActivityIndicator color="white" />
        ) : (
          <Text style={styles.saveBtnText}>Save</Text>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 25,
    paddingTop: 30,
    backgroundColor: '#fff',
    flexGrow: 1,
  },
  title: { fontSize: 24, fontWeight: 'bold', color: '#1A1A1A', marginBottom: 28 },
  label: { fontSize: 15, fontWeight: '700', color: '#444', marginBottom: 12 },

  chipRow: { marginBottom: 28 },
  dateChip: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: '#DDD',
    borderRadius: 25,
    backgroundColor: '#F8F9FA',
  },
  dateChipText: { fontSize: 13, color: '#555', fontWeight: '500' },

  selectedChip: { backgroundColor: '#1A1A1A', borderColor: '#1A1A1A' },
  selectedChipText: { color: 'white' },

  row: { flexDirection: 'row', gap: 12, marginBottom: 28 },

  timeBtn: {
    flex: 1,
    padding: 14,
    borderWidth: 1,
    borderColor: '#DDD',
    borderRadius: 12,
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
  },
  selectedTimeBtn: { backgroundColor: '#FF5A5F', borderColor: '#FF5A5F' },
  timeBtnText: { fontSize: 15, fontWeight: '600', color: '#666' },
  selectedTimeBtnText: { color: 'white' },

  areaChip: {
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderWidth: 1,
    borderColor: '#DDD',
    borderRadius: 25,
    backgroundColor: '#F8F9FA',
  },
  areaChipText: { fontSize: 14, color: '#444' },

  input: {
    backgroundColor: '#F5F5F5',
    padding: 15,
    borderRadius: 12,
    fontSize: 20,
    marginBottom: 30,
    borderWidth: 1,
    borderColor: '#DDD',
    fontWeight: '700',
  },
  saveBtn: {
    backgroundColor: '#FF5A5F',
    padding: 18,
    borderRadius: 15,
    alignItems: 'center',
    elevation: 3,
  },
  saveBtnText: { color: 'white', fontWeight: 'bold', fontSize: 17 },
});

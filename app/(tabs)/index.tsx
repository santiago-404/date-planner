import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { generatePlan } from "../../utils/planner";

export default function Home() {
  const router = useRouter();

  const [budgetStr, setBudgetStr] = useState<string>("1000"); // Use string for TextInput
  const [area, setArea] = useState<"Intramuros" | "BGC" | "Makati">(
    "Intramuros",
  );
  const [isNight, setIsNight] = useState(false);

  const handleGenerate = () => {
    const budgetInt = parseInt(budgetStr) || 0;
    const meta = { budget: budgetInt, area, isNight }; // Save the user's choices

    const result = generatePlan({
      budget: budgetInt,
      area,
      isNight,
      lockedItems: [],
    });

    router.push({
      pathname: "/result",
      params: {
        data: JSON.stringify(result),
        meta: JSON.stringify(meta),
      },
    });
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Date Planner 🇵🇭</Text>

      {/* BUDGET INPUT */}
      <Text style={styles.label}>Your Budget (₱)</Text>
      <TextInput
        style={styles.input}
        keyboardType="numeric"
        value={budgetStr}
        onChangeText={setBudgetStr}
        placeholder="Enter amount (e.g. 1500)"
      />

      {/* LOCATION SELECTION */}
      <Text style={styles.label}>Choose Area</Text>
      <View style={styles.row}>
        {["Intramuros", "BGC", "Makati"].map((loc) => (
          <TouchableOpacity
            key={loc}
            style={[styles.chip, area === loc && styles.selectedChip]}
            onPress={() => setArea(loc as any)}
          >
            <Text style={{ color: area === loc ? "white" : "black" }}>
              {loc}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* TIME SELECTION BUTTONS */}
      <Text style={styles.label}>Time of Date</Text>
      <View style={styles.timeRow}>
        <TouchableOpacity
          style={[styles.timeBtn, !isNight && styles.selectedTimeBtn]}
          onPress={() => setIsNight(false)}
        >
          <Text style={[styles.timeText, !isNight && styles.selectedTimeText]}>
            ☀️ Day
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.timeBtn, isNight && styles.selectedTimeBtn]}
          onPress={() => setIsNight(true)}
        >
          <Text style={[styles.timeText, isNight && styles.selectedTimeText]}>
            🌙 Night
          </Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={styles.mainBtn} onPress={handleGenerate}>
        <Text style={styles.btnText}>Generate Plan</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 30,
    backgroundColor: "#fff",
    flexGrow: 1,
    justifyContent: "center",
  },
  title: {
    fontSize: 32,
    fontWeight: "bold",
    marginBottom: 40,
    color: "#1A1A1A",
  },
  label: { fontSize: 16, fontWeight: "700", marginBottom: 12, color: "#444" },
  input: {
    backgroundColor: "#F5F5F5",
    padding: 15,
    borderRadius: 12,
    fontSize: 18,
    marginBottom: 30,
    borderWidth: 1,
    borderColor: "#DDD",
  },
  row: { flexDirection: "row", marginBottom: 30 },
  chip: {
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderWidth: 1,
    borderColor: "#DDD",
    borderRadius: 25,
    marginRight: 10,
  },
  selectedChip: { backgroundColor: "#1A1A1A", borderColor: "#1A1A1A" },
  timeRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 50,
  },
  timeBtn: {
    flex: 0.48,
    padding: 15,
    borderWidth: 1,
    borderColor: "#DDD",
    borderRadius: 12,
    alignItems: "center",
  },
  selectedTimeBtn: { backgroundColor: "#FF5A5F", borderColor: "#FF5A5F" },
  timeText: { fontSize: 16, fontWeight: "600", color: "#666" },
  selectedTimeText: { color: "white" },
  mainBtn: {
    backgroundColor: "#FF5A5F",
    padding: 20,
    borderRadius: 15,
    alignItems: "center",
    elevation: 5,
  },
  btnText: { color: "white", fontWeight: "bold", fontSize: 18 },
});

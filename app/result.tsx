import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  FlatList,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from "react-native";
import MapView, { Marker, Polyline } from "react-native-maps";
import { Place } from "../data/places";
import { generatePlan, getAlternatives } from "../utils/planner";

export default function Result() {
  const mapRef = useRef<MapView>(null);
  const router = useRouter();
  const params = useLocalSearchParams();

  const [itinerary, setItinerary] = useState<Place[]>([]);
  const [lockedIds, setLockedIds] = useState<number[]>([]);
  const [meta, setMeta] = useState<any>(null);
  const [replacingItem, setReplacingItem] = useState<Place | null>(null);
  const [alternatives, setAlternatives] = useState<Place[]>([]);

  useEffect(() => {
    if (params.data && params.meta) {
      setItinerary(JSON.parse(params.data as string).plan);
      setMeta(JSON.parse(params.meta as string));
    }
  }, [params.data]);

  if (!meta) return null;

  const totalSpent = itinerary.reduce((sum, item) => sum + item.price, 0);

  const focusOnPlace = (place: Place) => {
    mapRef.current?.animateCamera(
      {
        center: { latitude: place.lat, longitude: place.lng },
        pitch: 45,
        zoom: 17,
      },
      { duration: 800 },
    );
  };

  // ARRANGEMENT LOGIC
  const moveItem = (index: number, direction: "up" | "down") => {
    const newItems = [...itinerary];
    const swapWith = direction === "up" ? index - 1 : index + 1;
    if (swapWith < 0 || swapWith >= newItems.length) return;

    // Perform the swap
    const temp = newItems[index];
    newItems[index] = newItems[swapWith];
    newItems[swapWith] = temp;

    setItinerary(newItems);
  };

  const openReplace = (item: Place) => {
    const alts = getAlternatives(
      item.type,
      meta.budget - (totalSpent - item.price),
      itinerary.map((p) => p.id),
      meta.area,
    );
    setReplacingItem(item);
    setAlternatives(alts);
  };

  return (
    <View style={styles.container}>
      <View style={styles.mapContainer}>
        <MapView
          ref={mapRef}
          style={styles.map}
          initialRegion={{
            latitude: 14.594,
            longitude: 120.97,
            latitudeDelta: 0.05,
            longitudeDelta: 0.05,
          }}
        >
          {/* THE PATH LINE WITH DEPTH */}
          <Polyline
            coordinates={itinerary.map((p) => ({
              latitude: p.lat,
              longitude: p.lng,
            }))}
            strokeColor="#FF5A5F"
            strokeWidth={4}
          />

          {itinerary.map((p, i) => {
            const isStart = i === 0;
            const isEnd = i === itinerary.length - 1;

            return (
              <Marker
                key={`${p.id}-${i}`}
                coordinate={{ latitude: p.lat, longitude: p.lng }}
              >
                <View style={styles.markerWrapper}>
                  <View
                    style={[
                      styles.markerPin,
                      isStart && { backgroundColor: "#2ECC71" },
                      isEnd && { backgroundColor: "#E74C3C" },
                    ]}
                  >
                    <Text style={styles.markerNum}>{i + 1}</Text>
                  </View>
                  <View style={styles.markerLabelContainer}>
                    <Text style={styles.markerLabelText}>{p.name}</Text>
                  </View>
                </View>
              </Marker>
            );
          })}
        </MapView>
      </View>

      <ScrollView style={styles.sheet} stickyHeaderIndices={[0]}>
        <View style={styles.headerBackground}>
          <View style={styles.handle} />
          <Text style={styles.sheetTitle}>Itinerary Plan</Text>
        </View>

        {itinerary.map((item, index) => (
          <TouchableOpacity
            key={`${item.id}-${index}`}
            onPress={() => focusOnPlace(item)}
            style={[
              styles.card,
              lockedIds.includes(item.id) && styles.lockedCard,
            ]}
          >
            {/* REARRANGE CONTROLS */}
            <View style={styles.reorderGroup}>
              <TouchableOpacity
                onPress={() => moveItem(index, "up")}
                style={styles.reorderBtn}
              >
                <Ionicons
                  name="chevron-up"
                  size={18}
                  color={index === 0 ? "#EEE" : "#666"}
                />
              </TouchableOpacity>
              <Text style={styles.stepNumber}>{index + 1}</Text>
              <TouchableOpacity
                onPress={() => moveItem(index, "down")}
                style={styles.reorderBtn}
              >
                <Ionicons
                  name="chevron-down"
                  size={18}
                  color={index === itinerary.length - 1 ? "#EEE" : "#666"}
                />
              </TouchableOpacity>
            </View>

            <View style={styles.cardInfo}>
              <Text style={styles.typeBadge}>{item.type.toUpperCase()}</Text>
              <Text style={styles.placeName}>{item.name}</Text>
              <Text style={styles.priceTag}>₱{item.price}</Text>
            </View>

            <View style={styles.actionGroup}>
              <TouchableOpacity
                onPress={() => openReplace(item)}
                style={styles.iconCircle}
              >
                <Ionicons name="swap-horizontal" size={18} color="#3498DB" />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() =>
                  setLockedIds((prev) =>
                    prev.includes(item.id)
                      ? prev.filter((id) => id !== item.id)
                      : [...prev, item.id],
                  )
                }
                style={styles.iconCircle}
              >
                <Ionicons
                  name={
                    lockedIds.includes(item.id)
                      ? "lock-closed"
                      : "lock-open-outline"
                  }
                  size={18}
                  color="#FF5A5F"
                />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() =>
                  setItinerary((prev) => prev.filter((_, i) => i !== index))
                }
                style={styles.iconCircle}
              >
                <Ionicons name="trash-outline" size={18} color="#999" />
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        ))}

        <View style={styles.footer}>
          <Text style={styles.totalText}>Spent: ₱{totalSpent}</Text>
          {meta.budget - totalSpent > 50 && (
            <TouchableOpacity
              style={styles.addMoreBtn}
              onPress={() =>
                setItinerary(
                  generatePlan({ ...meta, lockedItems: itinerary }).plan,
                )
              }
            >
              <Text style={styles.addMoreText}>Fill Empty Slot</Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>

      {/* REPLACE MODAL (RE-ADDED) */}
      <Modal visible={!!replacingItem} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalHeader}>Swap {replacingItem?.name}</Text>
            <FlatList
              data={alternatives}
              keyExtractor={(item) => item.id.toString()}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.altItem}
                  onPress={() => {
                    setItinerary(
                      itinerary.map((p) =>
                        p.id === replacingItem?.id ? item : p,
                      ),
                    );
                    setReplacingItem(null);
                  }}
                >
                  <Text style={styles.altName}>{item.name}</Text>
                  <Text style={styles.altPrice}>₱{item.price}</Text>
                </TouchableOpacity>
              )}
            />
            <TouchableOpacity
              onPress={() => setReplacingItem(null)}
              style={styles.cancelBtn}
            >
              <Text>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FFF" },
  mapContainer: { height: "35%" },
  map: { ...StyleSheet.absoluteFillObject },
  markerWrapper: { alignItems: "center", justifyContent: "center" },
  markerPin: {
    backgroundColor: "#FF5A5F",
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "white",
    zIndex: 2,
  },
  markerNum: { color: "white", fontSize: 10, fontWeight: "bold" },
  markerLabelContainer: {
    backgroundColor: "white",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    marginTop: 4,
    elevation: 3,
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },
  markerLabelText: { fontSize: 10, fontWeight: "bold", color: "#333" },
  sheet: {
    flex: 1,
    backgroundColor: "#F8F9FA",
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    marginTop: -30,
    paddingHorizontal: 15,
  },
  headerBackground: {
    backgroundColor: "#F8F9FA",
    paddingTop: 10,
    paddingBottom: 10,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
  },
  handle: {
    width: 40,
    height: 5,
    backgroundColor: "#DDD",
    borderRadius: 10,
    alignSelf: "center",
    marginBottom: 10,
  },
  sheetTitle: {
    fontSize: 18,
    fontWeight: "bold",
    textAlign: "center",
    color: "#1A1A1A",
  },
  card: {
    backgroundColor: "white",
    borderRadius: 18,
    padding: 12,
    flexDirection: "row",
    marginBottom: 12,
    elevation: 2,
  },
  lockedCard: { borderColor: "#FF5A5F", borderWidth: 2 },
  reorderGroup: {
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  reorderBtn: { padding: 4 },
  stepNumber: { fontSize: 12, fontWeight: "bold", color: "#999" },
  cardInfo: { flex: 1, justifyContent: "center" },
  typeBadge: {
    fontSize: 9,
    fontWeight: "bold",
    color: "#FF5A5F",
    letterSpacing: 0.5,
  },
  placeName: { fontSize: 15, fontWeight: "bold", color: "#1A1A1A" },
  priceTag: { fontSize: 13, color: "#777" },
  actionGroup: { flexDirection: "row", alignItems: "center", gap: 8 },
  iconCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#F5F6FA",
    alignItems: "center",
    justifyContent: "center",
  },
  footer: {
    padding: 20,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 50,
  },
  totalText: { fontSize: 18, fontWeight: "bold" },
  addMoreBtn: {
    backgroundColor: "#1A1A1A",
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
  },
  addMoreText: { color: "white", fontWeight: "bold" },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: "white",
    borderTopLeftRadius: 25,
    borderTopRightRadius: 25,
    padding: 20,
    maxHeight: "80%",
  },
  modalHeader: { fontSize: 18, fontWeight: "bold", marginBottom: 20 },
  altItem: {
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: "#F0F0F0",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  altName: { fontSize: 16, fontWeight: "500" },
  altPrice: { fontWeight: "bold", color: "#666" },
  cancelBtn: { padding: 20, alignItems: "center" },
});

import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import DraggableFlatList, {
  RenderItemParams,
  ScaleDecorator,
} from "react-native-draggable-flatlist";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import MapView, { Callout, Marker, Polyline } from "react-native-maps";
import { Place } from "../data/places";
import { generatePlan, getAlternatives } from "../utils/planner";

export default function Result() {
  const mapRef = useRef<MapView>(null);
  const params = useLocalSearchParams();

  const [itinerary, setItinerary] = useState<Place[]>([]);
  const [lockedIds, setLockedIds] = useState<number[]>([]);
  const [meta, setMeta] = useState<any>(null);
  const [replacingItem, setReplacingItem] = useState<Place | null>(null);
  const [alternatives, setAlternatives] = useState<Place[]>([]);

  // FIX: Added params.meta to dependency array and added safety checks
  useEffect(() => {
    if (params.data && params.meta) {
      try {
        const parsedData = JSON.parse(params.data as string);
        const parsedMeta = JSON.parse(params.meta as string);
        setItinerary(parsedData.plan);
        setMeta(parsedMeta);
      } catch (e) {
        console.error("Data parsing error:", e);
      }
    }
  }, [params.data, params.meta]);

  const totalSpent = itinerary.reduce((sum, item) => sum + item.price, 0);

  // FIX: Accurate camera zoom
  const focusOnPlace = (place: Place) => {
    mapRef.current?.animateCamera(
      {
        center: { latitude: place.lat, longitude: place.lng },
        pitch: 45,
        zoom: 17,
      },
      { duration: 600 },
    );
  };

  // FIX: Guarded against null 'meta' to prevent "cannot read area" error
  const openReplace = (item: Place) => {
    if (!meta) return;
    const remainingForSwap = meta.budget - (totalSpent - item.price);
    const alts = getAlternatives(
      item.type,
      remainingForSwap,
      itinerary.map((p) => p.id),
      meta.area,
    );
    setReplacingItem(item);
    setAlternatives(alts);
  };

  const renderItem = ({
    item,
    drag,
    isActive,
    getIndex,
  }: RenderItemParams<Place>) => {
    const index = getIndex() ?? 0;
    const isLocked = lockedIds.includes(item.id);

    return (
      <ScaleDecorator>
        <TouchableOpacity
          activeOpacity={1}
          onLongPress={drag}
          onPress={() => focusOnPlace(item)}
          disabled={isActive}
          style={[
            styles.card,
            isLocked && styles.lockedCard,
            isActive && styles.activeCard,
          ]}
        >
          <View style={styles.dragHandle}>
            <Ionicons name="reorder-two" size={24} color="#CCC" />
            <Text style={styles.stepNumber}>{index + 1}</Text>
          </View>

          <View style={styles.cardInfo}>
            <Text style={styles.typeBadge}>{item.type.toUpperCase()}</Text>
            <Text style={styles.placeName} numberOfLines={1}>
              {item.name}
            </Text>
            <Text style={styles.priceTag}>₱{item.price}</Text>
          </View>

          <View style={styles.actionGroup}>
            {/* SWAP ICON */}
            <TouchableOpacity
              onPress={() => openReplace(item)}
              style={styles.iconCircle}
            >
              <Ionicons name="swap-horizontal" size={18} color="#3498DB" />
            </TouchableOpacity>

            {/* LOCK ICON */}
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
                name={isLocked ? "lock-closed" : "lock-open-outline"}
                size={18}
                color="#FF5A5F"
              />
            </TouchableOpacity>

            {/* DELETE ICON (RESTORED) */}
            <TouchableOpacity
              onPress={() =>
                setItinerary((prev) => prev.filter((_, i) => i !== index))
              }
              style={styles.iconCircle}
            >
              <Ionicons name="trash-outline" size={18} color="#E74C3C" />
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </ScaleDecorator>
    );
  };

  // Loading state if meta hasn't parsed yet
  if (!meta) {
    return (
      <View style={[styles.container, { justifyContent: "center" }]}>
        <ActivityIndicator size="large" color="#FF5A5F" />
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <View style={styles.container}>
        <View style={styles.mapContainer}>
          <MapView
            ref={mapRef}
            style={styles.map}
            initialRegion={{
              latitude: itinerary[0]?.lat || 14.594,
              longitude: itinerary[0]?.lng || 120.97,
              latitudeDelta: 0.02,
              longitudeDelta: 0.02,
            }}
          >
            {/* The Route Line */}
            <Polyline
              coordinates={itinerary.map((p) => ({
                latitude: p.lat,
                longitude: p.lng,
              }))}
              strokeColor="#FF5A5F"
              strokeWidth={5}
            />

            {itinerary.map((p, i) => (
              <Marker
                key={`${p.id}-${i}`}
                coordinate={{
                  latitude: p.lat + i * 0.00005,
                  longitude: p.lng + i * 0.00005,
                }}
                // FIX: Anchor ensures the bottom tip of the pin hits the coordinate
                anchor={{ x: 0.5, y: 1 }}
              >
                <View
                  style={[
                    styles.dot,
                    i === 0 && styles.startDot,
                    i === itinerary.length - 1 && styles.endDot,
                  ]}
                >
                  <Text style={styles.dotText}>{i + 1}</Text>
                </View>
                {/* FIX: Callout ensures text is never cut off */}
                <Callout tooltip>
                  <View style={styles.callout}>
                    <Text style={styles.calloutText}>{p.name}</Text>
                    <Text style={styles.calloutSub}>Tap card for details</Text>
                  </View>
                </Callout>
              </Marker>
            ))}
          </MapView>
        </View>

        <DraggableFlatList
          data={itinerary}
          onDragEnd={({ data }) => setItinerary(data)}
          keyExtractor={(item) => `item-${item.id}`}
          renderItem={renderItem}
          containerStyle={styles.listContainer}
          ListHeaderComponent={() => (
            <View style={styles.header}>
              <View style={styles.handle} />
              <Text style={styles.headerTitle}>
                Hold & Drag to Reorder Sequence
              </Text>
            </View>
          )}
          ListFooterComponent={() => (
            <View style={styles.footer}>
              <Text style={styles.totalText}>Current Total: ₱{totalSpent}</Text>
              {meta.budget - totalSpent > 50 && (
                <TouchableOpacity
                  style={styles.addMoreBtn}
                  onPress={() =>
                    setItinerary(
                      generatePlan({ ...meta, lockedItems: itinerary }).plan,
                    )
                  }
                >
                  <Text style={styles.addMoreText}>
                    + Fill Remaining Budget (₱{meta.budget - totalSpent})
                  </Text>
                </TouchableOpacity>
              )}
              <View style={{ height: 50 }} />
            </View>
          )}
        />
      </View>

      {/* SWAP MODAL */}
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
              <Text style={{ color: "#FF5A5F", fontWeight: "bold" }}>
                Cancel
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F8F9FA" },
  mapContainer: { height: "35%" },
  map: { ...StyleSheet.absoluteFillObject },
  listContainer: {
    flex: 1,
    marginTop: -30,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    backgroundColor: "#F8F9FA",
    paddingHorizontal: 15,
  },
  header: { paddingVertical: 15, alignItems: "center" },
  handle: {
    width: 40,
    height: 5,
    backgroundColor: "#DDD",
    borderRadius: 10,
    marginBottom: 10,
  },
  headerTitle: {
    fontSize: 13,
    color: "#AAA",
    fontWeight: "bold",
    letterSpacing: 0.5,
  },
  card: {
    backgroundColor: "white",
    borderRadius: 20,
    padding: 15,
    flexDirection: "row",
    marginBottom: 10,
    alignItems: "center",
    elevation: 2,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 5,
  },
  // FIX: transform syntax for scaling
  activeCard: {
    backgroundColor: "#FFF",
    elevation: 10,
    transform: [{ scale: 1.03 }],
  },
  lockedCard: { borderColor: "#FF5A5F", borderWidth: 2 },
  dragHandle: { alignItems: "center", marginRight: 15 },
  stepNumber: { fontSize: 12, fontWeight: "bold", color: "#999" },
  cardInfo: { flex: 1 },
  typeBadge: {
    fontSize: 9,
    fontWeight: "800",
    color: "#FF5A5F",
    marginBottom: 2,
  },
  placeName: { fontSize: 16, fontWeight: "bold", color: "#1A1A1A" },
  priceTag: { fontSize: 13, color: "#888" },
  actionGroup: { flexDirection: "row", gap: 10 },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#F5F6FA",
    alignItems: "center",
    justifyContent: "center",
  },
  dot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#FF5A5F",
    borderWidth: 3,
    borderColor: "white",
    alignItems: "center",
    justifyContent: "center",
  },
  startDot: { backgroundColor: "#2ECC71" },
  endDot: { backgroundColor: "#E74C3C" },
  dotText: { color: "white", fontSize: 10, fontWeight: "bold" },
  callout: {
    backgroundColor: "white",
    padding: 12,
    borderRadius: 15,
    width: 160,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#EEE",
  },
  calloutText: { fontSize: 13, fontWeight: "bold", color: "#333" },
  calloutSub: { fontSize: 10, color: "#999", marginTop: 2 },
  footer: { paddingVertical: 30, alignItems: "center" },
  totalText: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 15,
    color: "#333",
  },
  addMoreBtn: {
    backgroundColor: "#1A1A1A",
    paddingVertical: 14,
    paddingHorizontal: 25,
    borderRadius: 15,
  },
  addMoreText: { color: "white", fontWeight: "bold" },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: "white",
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    padding: 25,
    maxHeight: "80%",
  },
  modalHeader: {
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 20,
    textAlign: "center",
  },
  altItem: {
    padding: 18,
    borderBottomWidth: 1,
    borderBottomColor: "#F0F0F0",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  altName: { fontSize: 16, fontWeight: "500", color: "#333" },
  altPrice: { fontWeight: "bold", color: "#666" },
  cancelBtn: { padding: 20, alignItems: "center", marginTop: 10 },
});

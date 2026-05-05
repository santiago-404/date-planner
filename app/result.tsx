import { useLocalSearchParams } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import MapView, { Marker } from "react-native-maps";

export default function Result() {
  const { data } = useLocalSearchParams();
  const result = JSON.parse(data as string);

  const firstPlace = result.plan[0];

  return (
    <View style={{ flex: 1 }}>
      {/* MAP */}
      <MapView
        style={styles.map}
        initialRegion={{
          latitude: firstPlace.lat,
          longitude: firstPlace.lng,
          latitudeDelta: 0.05,
          longitudeDelta: 0.05,
        }}
      >
        {result.plan.map((place: any, index: number) => (
          <Marker
            key={index}
            coordinate={{
              latitude: place.lat,
              longitude: place.lng,
            }}
            title={place.name}
            description={`₱${place.price}`}
          />
        ))}
      </MapView>

      {/* INFO PANEL */}
      <View style={styles.panel}>
        <Text style={{ fontWeight: "bold" }}>Total Cost: ₱{result.total}</Text>

        {result.plan.map((place: any, index: number) => (
          <Text key={index}>
            {index + 1}. {place.name}
          </Text>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  map: {
    flex: 1,
  },
  panel: {
    padding: 15,
    backgroundColor: "white",
  },
});

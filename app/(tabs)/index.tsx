import { useRouter } from "expo-router";
import { Button, Text, View } from "react-native";
import { generatePlan } from "../../utils/planner";

export default function Home() {
  const router = useRouter();

  const handleGenerate = () => {
    //1000 is the budget
    const result = generatePlan(3000);

    router.push({
      pathname: "/result",
      params: { data: JSON.stringify(result) },
    });
  };

  return (
    <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
      <Text>Date Planner MVP</Text>

      <Button title="Generate Plan" onPress={handleGenerate} />
    </View>
  );
}

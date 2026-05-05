import { Place, places } from "../data/places";

interface PlanOptions {
  budget: number;
  area: "Intramuros" | "BGC" | "Makati";
  isNight: boolean;
  lockedItems: Place[];
}

export function generatePlan({
  budget,
  area,
  isNight,
  lockedItems,
}: PlanOptions) {
  const selectedTime = isNight ? "night" : "day";
  const spentOnLocked = lockedItems.reduce((sum, item) => sum + item.price, 0);
  let remainingBudget = budget - spentOnLocked;

  const lockedIds = lockedItems.map((p) => p.id);
  let pool = places.filter(
    (p) =>
      p.area === area &&
      (p.time === selectedTime || p.time === "both") &&
      !lockedIds.includes(p.id),
  );

  let newItems: Place[] = [...lockedItems];

  const tryAddType = (type: "meal" | "activity" | "snack") => {
    const options = pool.filter(
      (p) => p.type === type && p.price <= remainingBudget,
    );
    if (options.length > 0) {
      const choice = options[Math.floor(Math.random() * options.length)];
      newItems.push(choice);
      remainingBudget -= choice.price;
      pool = pool.filter((p) => p.id !== choice.id);
      return true;
    }
    return false;
  };

  // Phase 1: Foundation
  if (!newItems.some((p) => p.type === "meal")) tryAddType("meal");
  if (!newItems.some((p) => p.type === "activity")) tryAddType("activity");
  if (!newItems.some((p) => p.type === "snack")) tryAddType("snack");

  // Phase 2: Extras (Activity > Snack > Meal)
  let possible = true;
  while (remainingBudget > 50 && possible) {
    if (
      !tryAddType("activity") &&
      !tryAddType("snack") &&
      !tryAddType("meal")
    ) {
      possible = false;
    }
  }

  return { plan: newItems, total: budget - remainingBudget };
}

export function getAlternatives(
  type: string,
  maxPrice: number,
  currentIds: number[],
  area: string,
) {
  return places.filter(
    (p) =>
      p.type === type &&
      p.price <= maxPrice &&
      !currentIds.includes(p.id) &&
      p.area === area,
  );
}

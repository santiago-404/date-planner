import { places } from "../data/places";

export function generatePlan(budget: number) {
  let total = 0;
  let plan = [];

  for (let place of places) {
    if (total + place.price <= budget) {
      plan.push(place);
      total += place.price;
    }
  }

  return { plan, total };
}

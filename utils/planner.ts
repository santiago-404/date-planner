import { Place, places } from "../data/places";

interface PlanOptions {
  budget: number;
  area: "Intramuros" | "BGC" | "Makati";
  isNight: boolean;
  lockedItems: Place[];
}

// ---------- DISTANCE ----------
function getDistance(a: Place, b: Place) {
  const dx = a.lat - b.lat;
  const dy = a.lng - b.lng;
  return Math.sqrt(dx * dx + dy * dy);
}

// ---------- CLUSTER CENTER ----------
function getCenter(plan: Place[]) {
  if (plan.length === 0) return null;

  const avgLat = plan.reduce((sum, p) => sum + p.lat, 0) / plan.length;
  const avgLng = plan.reduce((sum, p) => sum + p.lng, 0) / plan.length;

  return { lat: avgLat, lng: avgLng };
}

// ---------- SCORING ----------
function scorePlace(place: Place, remainingBudget: number, plan: Place[]) {
  const typeWeight = {
    activity: 3,
    meal: 3,
    snack: 1,
  };

  const existingTypes = plan.map((p) => p.type);

  const valueScore = typeWeight[place.type];

  const priceEfficiency =
    remainingBudget > 0 ? 1 - place.price / remainingBudget : 0;

  const diversityBonus = existingTypes.includes(place.type) ? -1 : 1;

  // 🔥 MUCH STRONGER DISTANCE LOGIC
  let distancePenalty = 0;

  if (plan.length > 0) {
    const center = getCenter(plan);

    const distFromCenter = Math.sqrt(
      Math.pow(place.lat - center!.lat, 2) +
        Math.pow(place.lng - center!.lng, 2),
    );

    const WALKABLE_THRESHOLD = 0.003;

    // 🚨 THIS IS THE FIX (strong penalty)
    distancePenalty = distFromCenter * 50;

    if (distFromCenter > WALKABLE_THRESHOLD) {
      distancePenalty = (distFromCenter - WALKABLE_THRESHOLD) * 80;
    }
  }

  return valueScore + priceEfficiency + diversityBonus - distancePenalty;
}

// ---------- ROUTE OPTIMIZATION ----------
function optimizeRoute(plan: Place[]) {
  if (plan.length <= 2) return plan;

  const visited: Place[] = [];
  const remaining = [...plan];

  visited.push(remaining.shift()!);

  while (remaining.length > 0) {
    const last = visited[visited.length - 1];

    let closestIndex = 0;
    let closestDist = Infinity;

    remaining.forEach((p, i) => {
      const dist = getDistance(last, p);
      if (dist < closestDist) {
        closestDist = dist;
        closestIndex = i;
      }
    });

    visited.push(remaining.splice(closestIndex, 1)[0]);
  }

  return visited;
}

// ---------- MAIN ----------
export function generatePlan({
  budget,
  area,
  isNight,
  lockedItems,
}: PlanOptions) {
  const selectedTime = isNight ? "night" : "day";

  let remainingBudget =
    budget - lockedItems.reduce((sum, item) => sum + item.price, 0);

  const lockedIds = lockedItems.map((p) => p.id);

  let pool = places.filter(
    (p) =>
      p.area === area &&
      (p.time === selectedTime || p.time === "both") &&
      !lockedIds.includes(p.id),
  );

  let plan: Place[] = [...lockedItems];

  const pickBest = () => {
    const candidates = pool.filter((p) => p.price <= remainingBudget);

    if (candidates.length === 0) return null;

    const scored = candidates
      .map((p) => ({
        place: p,
        score: scorePlace(p, remainingBudget, plan),
      }))
      .sort((a, b) => b.score - a.score);

    const best = scored[0].place;

    plan.push(best);
    remainingBudget -= best.price;
    pool = pool.filter((p) => p.id !== best.id);

    return best;
  };

  // ---------- STRUCTURE ----------
  const requiredTypes: ("activity" | "meal" | "snack")[] = [
    "activity",
    "meal",
    "snack",
  ];

  for (const type of requiredTypes) {
    if (!plan.some((p) => p.type === type)) {
      const options = pool
        .filter((p) => p.type === type && p.price <= remainingBudget)
        .map((p) => ({
          place: p,
          score: scorePlace(p, remainingBudget, plan),
        }))
        .sort((a, b) => b.score - a.score);

      if (options.length > 0) {
        const best = options[0].place;
        plan.push(best);
        remainingBudget -= best.price;
        pool = pool.filter((p) => p.id !== best.id);
      }
    }
  }

  // ---------- FILL ----------
  while (remainingBudget > 50) {
    const picked = pickBest();
    if (!picked) break;
  }

  // ---------- FINAL ROUTE ----------
  const optimized = optimizeRoute(plan);

  return {
    plan: optimized,
    total: budget - remainingBudget,
  };
}

// ---------- ALTERNATIVES (FIXED TIME BUG) ----------
export function getAlternatives(
  type: string,
  maxPrice: number,
  currentIds: number[],
  area: string,
  isNight?: boolean,
) {
  const selectedTime = isNight ? "night" : "day";

  return places.filter(
    (p) =>
      p.type === type &&
      p.price <= maxPrice &&
      !currentIds.includes(p.id) &&
      p.area === area &&
      (p.time === selectedTime || p.time === "both"),
  );
}

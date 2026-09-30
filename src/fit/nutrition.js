export function clamp(value, min, max) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return min;
  return Math.min(max, Math.max(min, parsed));
}

export function poundsToKg(lb) {
  return Number(lb) * 0.45359237;
}

export function kgToPounds(kg) {
  return Number(kg) / 0.45359237;
}

export function inchesToCm(inches) {
  return Number(inches) * 2.54;
}

export function cmToInches(cm) {
  return Number(cm) / 2.54;
}

export function dayKey(date = new Date()) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0")
  ].join("-");
}

export function calculateTargets(profile) {
  const weightKg = clamp(profile.weightKg, 35, 275);
  const heightCm = clamp(profile.heightCm, 130, 230);
  const age = clamp(profile.age, 18, 90);
  const sexOffset = profile.sex === "female" ? -161 : profile.sex === "male" ? 5 : -78;
  const bmr = 10 * weightKg + 6.25 * heightCm - 5 * age + sexOffset;
  const activity = {
    sedentary: 1.2,
    light: 1.375,
    moderate: 1.55,
    active: 1.725
  }[profile.activity] || 1.375;
  const goalDelta = profile.goal === "lose" ? -400 : profile.goal === "gain" ? 250 : 0;
  const calories = Math.round(clamp(bmr * activity + goalDelta, 1200, 4500));
  const proteinFactor = profile.goal === "maintain" ? 1.4 : 1.7;
  const protein = Math.round(clamp(weightKg * proteinFactor, 55, 260));
  const fat = Math.round(clamp((calories * 0.28) / 9, 40, 150));
  const carbs = Math.round(clamp((calories - protein * 4 - fat * 9) / 4, 80, 500));
  return { calories, protein, carbs, fat };
}

export function sumMeals(meals) {
  return meals.reduce(
    (acc, meal) => ({
      calories: acc.calories + Number(meal.calories || 0),
      protein: acc.protein + Number(meal.protein || 0),
      carbs: acc.carbs + Number(meal.carbs || 0),
      fat: acc.fat + Number(meal.fat || 0)
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 }
  );
}

export function lastSevenDays(meals) {
  const rows = [];
  for (let offset = 6; offset >= 0; offset -= 1) {
    const date = new Date();
    date.setHours(12, 0, 0, 0);
    date.setDate(date.getDate() - offset);
    const key = dayKey(date);
    rows.push({
      key,
      label: date.toLocaleDateString(undefined, { weekday: "short" }).slice(0, 1),
      totals: sumMeals(meals.filter(meal => meal.date === key))
    });
  }
  return rows;
}

export function goalLabel(goal) {
  return goal === "lose" ? "Lose fat" : goal === "gain" ? "Build muscle" : "Maintain";
}

// Vehicle name helpers: keep make/model spelling consistent across the app.

// Common makes – used for suggestions and to keep spelling consistent
export const MAKES = [
  'Alfa Romeo', 'Audi', 'BMW', 'Chevrolet', 'Citroën', 'Dacia', 'Fiat', 'Ford', 'Honda', 'Hyundai',
  'Iveco', 'Jaguar', 'Jeep', 'Kia', 'Land Rover', 'Lexus', 'Mazda', 'Mercedes-Benz', 'Mini', 'Mitsubishi',
  'Nissan', 'Opel', 'Peugeot', 'Porsche', 'Renault', 'Seat', 'Škoda', 'Smart', 'Subaru', 'Suzuki',
  'Tesla', 'Toyota', 'Volkswagen', 'Volvo',
];
const MAKE_ALIASES = {
  vw: 'Volkswagen', volkswagen: 'Volkswagen', wolswagen: 'Volkswagen', wolkswagen: 'Volkswagen', volkswagon: 'Volkswagen',
  mercedes: 'Mercedes-Benz', 'mercedes benz': 'Mercedes-Benz', benz: 'Mercedes-Benz',
  opell: 'Opel', skoda: 'Škoda', citroen: 'Citroën', 'range rover': 'Land Rover', bmv: 'BMW',
};

export function canonicalMake(value) {
  const v = value.trim().replace(/\s+/g, ' ');
  if (!v) return v;
  const key = v.toLowerCase();
  if (MAKE_ALIASES[key]) return MAKE_ALIASES[key];
  const hit = MAKES.find(m => m.toLowerCase() === key || m.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase() === key);
  if (hit) return hit;
  // Title-case anything else ("AUDI" -> "Audi")
  return v.toLowerCase().replace(/(^|[\s-])\S/g, s => s.toUpperCase());
}

export function tidyModel(value) {
  const v = value.trim().replace(/\s+/g, ' ');
  // Keep short codes like "A7", "X5", "GTI" as typed; title-case long all-caps words
  return v.split(' ').map(w => (w.length > 3 && w === w.toUpperCase() && /[A-Z]/.test(w) && !/\d/.test(w))
    ? w[0] + w.slice(1).toLowerCase() : w).join(' ');
}

// Display helper: "Volkswagen Touareg"
export function vehicleName(make, model) {
  return [canonicalMake(make || ''), tidyModel(model || '')].filter(Boolean).join(' ');
}

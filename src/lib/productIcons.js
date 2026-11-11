import { Candy, Cookie, Droplets, GlassWater, Leaf, Milk, Package, SprayCan, Wheat } from 'lucide-react'

const ICONS = {
  wheat: Wheat,
  oil: Droplets,
  sugar: Candy,
  milk: Milk,
  tea: Leaf,
  cookie: Cookie,
  detergent: SprayCan,
  water: GlassWater,
}

// Products have no stored icon, so one is chosen from the name, then the category.
const NAME_ICON = [
  [/\b(rice|flour|atta|dal|lentils?)\b/i, 'wheat'],
  [/\boil\b/i, 'oil'],
  [/\bsugar\b/i, 'sugar'],
  [/\bmilk\b/i, 'milk'],
  [/\btea\b/i, 'tea'],
  [/\b(biscuits?|cookies?)\b/i, 'cookie'],
  [/\b(detergent|soap)\b/i, 'detergent'],
  [/\bwater\b/i, 'water'],
]

const CATEGORY_ICON = {
  Grains: 'wheat',
  Dairy: 'milk',
  Beverages: 'water',
  Snacks: 'cookie',
  Household: 'detergent',
}

export function productIcon(product) {
  const byName = NAME_ICON.find(([pattern]) => pattern.test(product.name ?? ''))?.[1]
  return ICONS[byName] || ICONS[CATEGORY_ICON[product.category]] || Package
}

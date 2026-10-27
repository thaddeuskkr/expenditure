"use client";
import {
    Coffee,
    ShoppingBasket,
    TrainFront,
    ShoppingBag,
    Clapperboard,
    House,
    HeartPulse,
    Ellipsis,
    Banknote,
    BookOpen,
    BriefcaseBusiness,
    Car,
    CreditCard,
    Dumbbell,
    Fuel,
    Gamepad2,
    Gift,
    GraduationCap,
    HandHeart,
    Landmark,
    Laptop,
    Music,
    ParkingCircle,
    PawPrint,
    Plane,
    Receipt,
    RefreshCw,
    Scissors,
    ShieldCheck,
    Shirt,
    Smartphone,
    Sparkles,
    Tag,
    Trees,
    Utensils,
    Wallet,
    Wifi,
    Wrench,
    Zap,
    type LucideIcon,
} from "lucide-react";
import { useWorkspace } from "./workspace-context";
import { CATEGORIES, CATEGORY_COLORS } from "@/lib/domain";
const defaultIcons = [
    Coffee,
    ShoppingBasket,
    TrainFront,
    ShoppingBag,
    Clapperboard,
    House,
    HeartPulse,
    Ellipsis,
];

// Specific matches precede broader ones (for example, pet food before food).
// Whole words avoid matching names such as "Carpentry" to "car".
const categoryIcons: [RegExp, LucideIcon][] = [
    [/\b(pets?|vets?|veterinary)\b/, PawPrint],
    [/\b(insurance)\b/, ShieldCheck],
    [/\b(subscriptions?|memberships?|recurring)\b/, RefreshCw],
    [/\b(parking|tolls?)\b/, ParkingCircle],
    [/\b(fuel|petrol|gasoline|diesel|charging)\b/, Fuel],
    [/\b(flights?|airfare|airlines?|travel|trips?|holidays?|vacations?)\b/, Plane],
    [/\b(hotels?|accommodation|rent|rental|mortgage|housing|home)\b/, House],
    [/\b(internet|broadband|wifi|wi fi)\b/, Wifi],
    [/\b(phones?|mobile|telco|telecom|data plans?)\b/, Smartphone],
    [/\b(electricity|electric|energy|power|water|gas)\b/, Zap],
    [/\b(repairs?|maintenance|renovation|tools?)\b/, Wrench],
    [/\b(groceries|grocery|supermarkets?|markets?)\b/, ShoppingBasket],
    [/\b(coffee|cafes?|tea|drinks?|beverages?)\b/, Coffee],
    [/\b(food|dining|restaurants?|meals?|lunch|dinner|breakfast|takeaway|takeout|snacks?)\b/, Utensils],
    [/\b(taxis?|cabs?|cars?|grab|uber|rides?|ride hailing)\b/, Car],
    [/\b(transport|transportation|transit|commut(e|ing)|trains?|mrt|buses?|bus|fares?)\b/, TrainFront],
    [/\b(clothes|clothing|fashion|shoes?|apparel)\b/, Shirt],
    [/\b(tech|technology|electronics?|computers?|laptops?|gadgets?|software)\b/, Laptop],
    [/\b(shopping|retail|purchases?)\b/, ShoppingBag],
    [/\b(games?|gaming|hobbies)\b/, Gamepad2],
    [/\b(music|concerts?|spotify)\b/, Music],
    [/\b(entertainment|movies?|cinema|netflix|streaming)\b/, Clapperboard],
    [/\b(gyms?|fitness|sports?|exercise|workouts?|yoga)\b/, Dumbbell],
    [/\b(health|healthcare|medical|medicines?|doctors?|dental|dentists?|pharmacy|therapy)\b/, HeartPulse],
    [/\b(hair|haircuts?|barbers?|salons?|grooming)\b/, Scissors],
    [/\b(beauty|skincare|cosmetics?|personal care|self care)\b/, Sparkles],
    [/\b(education|school|tuition|courses?|learning|university|college|childcare|daycare)\b/, GraduationCap],
    [/\b(books?|reading|stationery)\b/, BookOpen],
    [/\b(gifts?|presents?|birthdays?|celebrations?)\b/, Gift],
    [/\b(charity|donations?|giving)\b/, HandHeart],
    [/\b(salary|salaries|wages?|paychecks?|payday|income|bonuses?|earnings?)\b/, Banknote],
    [/\b(work|business|office|freelance)\b/, BriefcaseBusiness],
    [/\b(investments?|investing|stocks?|taxes|tax|bank|banking)\b/, Landmark],
    [/\b(savings?|allowances?|wallet)\b/, Wallet],
    [/\b(credit|loans?|debts?|repayments?)\b/, CreditCard],
    [/\b(bills?|utilities)\b/, House],
    [/\b(fees?|charges?|payments?)\b/, Receipt],
    [/\b(outdoors?|gardening|camping|nature)\b/, Trees],
    [/\b(other|misc|miscellaneous)\b/, Ellipsis],
];

export function CategoryIcon({
    category,
    color: categoryColor,
    small = false,
}: {
    category: string;
    color?: string;
    small?: boolean;
}) {
    const { categories } = useWorkspace();
    const normalized = category.normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
    const index = CATEGORIES.findIndex((name) => name.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim() === normalized);
    const color =
        categoryColor ||
        categories.find((c) => c.name === category)?.color ||
        CATEGORY_COLORS[index < 0 ? 7 : index];
    const Icon = index >= 0 ? defaultIcons[index] : categoryIcons.find(([pattern]) => pattern.test(normalized))?.[1] || Tag;
    return (
        <span
            aria-hidden="true"
            className={`flex shrink-0 items-center justify-center rounded-xl ${small ? "size-8" : "size-10"}`}
            style={{
                color,
                background: `${color}0e`,
                border: `1px solid ${color}10`,
            }}>
            <Icon className={small ? "size-3.5" : "size-4"} strokeWidth={1.5} />
        </span>
    );
}

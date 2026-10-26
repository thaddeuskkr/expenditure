import {
    Users,
    Plane,
    House,
    Utensils,
    Coffee,
    Gift,
    Briefcase,
    Car,
    Music,
    Heart,
} from "lucide-react";
import type { CircleIconName } from "@/lib/circles";

const icons = {
    users: Users,
    plane: Plane,
    home: House,
    utensils: Utensils,
    coffee: Coffee,
    gift: Gift,
    briefcase: Briefcase,
    car: Car,
    music: Music,
    heart: Heart,
};
export function CircleIcon({
    name,
    className = "size-5",
}: {
    name: CircleIconName;
    className?: string;
}) {
    const Icon = icons[name] || Users;
    return <Icon className={className} strokeWidth={1.5} />;
}

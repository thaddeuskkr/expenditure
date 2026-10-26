"use client";
import { useId } from "react";
import {
    Area,
    AreaChart,
    CartesianGrid,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from "recharts";
import { currencyDigits, money, zonedDate, type Overview } from "@/lib/domain";
export function SpendingChart({
    overview,
    month,
    timezone,
    currency,
}: {
    overview: Overview;
    month: string;
    timezone: string;
    currency: string;
}) {
    const gradient = useId().replaceAll(":", "");
    const days = new Date(
        Number(month.slice(0, 4)),
        Number(month.slice(5)),
        0,
    ).getDate();
    const data = Array.from({ length: days }, (_, i) => ({
        day: i + 1,
        amount: 0,
    }));
    overview.activity.forEach((item) => {
        const day = Number(zonedDate(item.occurred_at, timezone).slice(8, 10));
        if (data[day - 1]) data[day - 1].amount += item.total;
    });
    return (
        <div
            className="h-56 w-full sm:h-61"
            role="img"
            aria-label={`Daily spending chart for ${month}. Total ${money(overview.total, currency)}.`}>
            <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                <AreaChart
                    data={data}
                    margin={{ top: 18, right: 8, left: -22, bottom: 0 }}
                    accessibilityLayer>
                    <defs>
                        <linearGradient id={gradient} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#bdc8a4" stopOpacity={0.2} />
                            <stop offset="100%" stopColor="#bdc8a4" stopOpacity={0} />
                        </linearGradient>
                    </defs>
                    <CartesianGrid
                        stroke="#ffffff0a"
                        vertical={false}
                        strokeDasharray="3 5"
                    />
                    <XAxis
                        dataKey="day"
                        axisLine={false}
                        tickLine={false}
                        ticks={[1, 5, 10, 15, 20, 25, days]}
                        tick={{ fill: "#858e7d", fontSize: 10 }}
                        dy={10}
                        minTickGap={18}
                    />
                    <YAxis
                        axisLine={false}
                        tickLine={false}
                        tick={{ fill: "#858e7d", fontSize: 10 }}
                        tickFormatter={(n) =>
                            `${Math.round(n / 10 ** currencyDigits(currency))}`}
                        tickCount={4}
                    />
                    <Tooltip
                        cursor={{ stroke: "#c2cbb044" }}
                        content={({ active, payload, label }) =>
                            active && payload?.length ?
                                    (
                                        <div className="rounded-xl border bg-popover px-4 py-3 shadow-xl">
                                            <p className="text-[10px] text-muted-foreground">
                                                Day {label}
                                            </p>
                                            <p className="mt-1 text-sm font-medium">
                                                {money(Number(payload[0].value), currency)}
                                            </p>
                                        </div>
                                    ) :
                                null}
                    />
                    <Area
                        dataKey="amount"
                        type="monotone"
                        stroke="#bdc8a4"
                        strokeWidth={2}
                        fill={`url(#${gradient})`}
                        activeDot={{
                            r: 4,
                            fill: "#c2cbb0",
                            stroke: "#181b18",
                            strokeWidth: 3,
                        }}
                        isAnimationActive={false}
                    />
                </AreaChart>
            </ResponsiveContainer>
        </div>
    );
}

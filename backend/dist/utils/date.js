export const APP_TIME_ZONE = "Australia/Melbourne";
export const todayMelbourne = () => dateKeyInMelbourne(new Date());
export const dateKeyInMelbourne = (date) => {
    const parts = new Intl.DateTimeFormat("en-AU", {
        timeZone: APP_TIME_ZONE,
        year: "numeric",
        month: "2-digit",
        day: "2-digit"
    }).formatToParts(date);
    const year = parts.find((part) => part.type === "year")?.value;
    const month = parts.find((part) => part.type === "month")?.value;
    const day = parts.find((part) => part.type === "day")?.value;
    return `${year}-${month}-${day}`;
};
export const hourInMelbourne = (date) => {
    const hour = new Intl.DateTimeFormat("en-AU", {
        timeZone: APP_TIME_ZONE,
        hour: "2-digit",
        hour12: false
    }).format(date);
    return Number(hour);
};
export const toDateOnly = (dateKey) => new Date(`${dateKey}T00:00:00.000Z`);
export const addDays = (dateKey, days) => {
    const date = toDateOnly(dateKey);
    date.setUTCDate(date.getUTCDate() + days);
    return date.toISOString().slice(0, 10);
};
export const isYesterday = (candidate, today) => Boolean(candidate && addDays(candidate, 1) === today);

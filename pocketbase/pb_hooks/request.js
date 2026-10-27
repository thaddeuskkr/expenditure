function timestamp(value) {
    if (
        typeof value !== "string" ||
        !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})$/.test(
            value,
        ) ||
        !isFinite(Date.parse(value))
    )
        throw new BadRequestError("Use an ISO date with a timezone.");
    const local = value.slice(0, 16) + ":" + (value.match(/T\d{2}:\d{2}:(\d{2})/) || ["", "00"])[1];
    if (
        !isFinite(Date.parse(local + "Z")) ||
        new Date(local + "Z").toISOString().slice(0, 19) !== local
    )
        throw new BadRequestError("Choose a valid calendar date.");
    return new Date(value).toISOString();
}

module.exports = { timestamp };

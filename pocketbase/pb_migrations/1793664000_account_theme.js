migrate((app) => {
    const preferences = app.findCollectionByNameOrId("preferences");
    preferences.fields.add(new JSONField({ name: "theme", maxSize: 2048 }));
    app.save(preferences);
    // Populate existing accounts without resaving preferences or changing timestamps.
    const theme = { preset: "sage", colors: { background: "#181B18", surface: "#20241F", raised: "#2B3029", accent: "#C2CBB0", text: "#EEEEE7", muted: "#9AA294" } };
    app.db().newQuery("UPDATE preferences SET theme = {:theme}").bind({ theme: JSON.stringify(theme) }).execute();
}, (app) => {
    const preferences = app.findCollectionByNameOrId("preferences");
    preferences.fields.removeByName("theme");
    app.save(preferences);
});

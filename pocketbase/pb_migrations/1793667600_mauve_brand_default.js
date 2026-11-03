migrate((app) => {
    const theme = { preset: "mauve", colors: { background: "#1C181D", surface: "#2A232C", raised: "#403343", accent: "#D6B4D5", text: "#F3EDF3", muted: "#C1B1C1" } };
    // Retire the old default without resetting other selected themes or timestamps.
    app.db().newQuery("UPDATE preferences SET theme = {:theme} WHERE json_valid(theme) AND json_extract(theme, '$.preset') = 'sage'")
        .bind({ theme: JSON.stringify(theme) }).execute();
    const replacements = [["#bfc9a4", "#d6b4d5"], ["#8dada0", "#b5baff"], ["#c9c293", "#e7b9c8"], ["#999d94", "#a59aaa"]];
    for (const collection of ["categories", "circle_categories"]) {
        for (const [oldColor, color] of replacements) {
            app.db().newQuery(`UPDATE ${collection} SET color = {:color} WHERE lower(color) = {:oldColor}`)
                .bind({ color, oldColor }).execute();
        }
    }
}, () => {
    // Keep account choices and colours; reverting them would overwrite user edits.
});

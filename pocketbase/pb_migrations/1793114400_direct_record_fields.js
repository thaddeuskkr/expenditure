/// <reference path="../pb_data/types.d.ts" />
migrate(
    (app) => {
        const rates = app.findCollectionByNameOrId("exchange_rates");
        rates.fields.add(new JSONField({ name: "quotes", maxSize: 100000 }));
        rates.fields.add(new JSONField({ name: "dates", maxSize: 100000 }));
        app.save(rates);
        app.db().newQuery("UPDATE exchange_rates SET quotes = json_extract(data, '$.quotes'), dates = json_extract(data, '$.dates')").execute();
        rates.fields.removeByName("data");
        app.save(rates);

        // Persist the enabled currencies previously supplied by runtime defaults.
        // Keep timestamps intact: this changes representation, not user settings.
        const preferences = app.findRecordsByFilter("preferences", "", "", 0, 0);
        preferences.forEach((record) => {
            if (record.getStringSlice("currencies").length) return;
            const currencies = ["SGD", "USD", "EUR", "GBP", "AUD", "MYR", record.getString("currency")]
                .filter((code, index, codes) => codes.indexOf(code) === index);
            app.db().newQuery("UPDATE preferences SET currencies = {:currencies} WHERE id = {:id}")
                .bind({ id: record.id, currencies: JSON.stringify(currencies) }).execute();
        });
        const collection = app.findCollectionByNameOrId("preferences");
        collection.fields.getByName("currencies").required = true;
        app.save(collection);

        // Deleted accounts leave their ledger membership in place.
        app.db().newQuery("UPDATE circle_members SET active = false WHERE user = ''").execute();
    },
    (app) => {
        const rates = app.findCollectionByNameOrId("exchange_rates");
        rates.fields.add(new JSONField({ name: "data", maxSize: 100000 }));
        app.save(rates);
        app.db().newQuery("UPDATE exchange_rates SET data = json_object('quotes', json(quotes), 'dates', json(dates))").execute();
        rates.fields.removeByName("quotes");
        rates.fields.removeByName("dates");
        app.save(rates);
        const preferences = app.findCollectionByNameOrId("preferences");
        preferences.fields.getByName("currencies").required = false;
        app.save(preferences);
    },
);

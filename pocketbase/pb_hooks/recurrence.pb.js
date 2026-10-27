cronAdd("expenditure_recurring_expenses", "* * * * *", () => {
    require(`${__hooks}/recurrence.js`).run($app);
});

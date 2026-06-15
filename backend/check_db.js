const { DataSource } = require("typeorm");

const AppDataSource = new DataSource({
    type: "sqlite",
    database: "c:/Users/PCSLHICT-THANETH/Documents/github/sun-planner/backend/database/sun-planner.sqlite",
    entities: [__dirname + "/src/entities/*.ts"],
    synchronize: false,
});

AppDataSource.initialize()
    .then(async () => {
        const supplies = await AppDataSource.query(`SELECT id, production_date, by_products FROM mps_plan_supply ORDER BY id DESC LIMIT 5`);
        console.log(supplies);
        process.exit(0);
    })
    .catch((error) => console.log(error));

import { orama } from "../src/libs/orama/client";

const datasource = orama.dataSource("1a975171-8784-45ce-95f7-66db462fc3b3");

await datasource.deleteDocuments([]);

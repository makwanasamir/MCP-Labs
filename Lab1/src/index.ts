import { app } from "@azure/functions";
import "./functions/holidaysMcpTools";
import "./functions/testHttp";

app.setup({
  enableHttpStream: true,
});

import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";

app.http("testHttp", {
    methods: ["GET", "POST"],
    authLevel: "anonymous",
    handler: async (request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> => {
        context.log(`Test HTTP function processed request for url "${request.url}"`);
        
        const name = request.query.get("name") || (await request.text()) || "World";
        
        return {
            status: 200,
            body: `Hello, ${name}! Azure Functions v4 is working.`
        };
    }
});

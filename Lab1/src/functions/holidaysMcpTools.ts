import { app, InvocationContext, arg } from "@azure/functions";
import * as service from "../services/holidaysService";

// ── get_upcoming_holidays ────────────────────────────────────────────
export async function getUpcomingHolidaysHandler(
  _toolArguments: unknown,
  context: InvocationContext
): Promise<string> {
  const args = (context.triggerMetadata?.mcptoolargs ?? {}) as {
    country_code?: string;
  };
  const country = (args?.country_code || "").toUpperCase();
  if (!country) return JSON.stringify({ error: "country_code is required" });

  try {
    const data = await service.getUpcomingHolidays(country);
    return JSON.stringify(data);
  } catch (err: any) {
    return JSON.stringify({ error: err.message });
  }
}

app.mcpTool("getUpcomingHolidays", {
  toolName: "get_upcoming_holidays",
  description:
    "Returns the next upcoming public holidays for a given country. " +
    "Use ISO 3166-1 alpha-2 country code (e.g. PL, US, DE).",
  toolProperties: {
    country_code: arg
      .string()
      .describe("ISO 3166-1 alpha-2 country code, e.g. PL"),
  },
  handler: getUpcomingHolidaysHandler,
});

// ── is_today_holiday ─────────────────────────────────────────────────
export async function isTodayHolidayHandler(
  _toolArguments: unknown,
  context: InvocationContext
): Promise<string> {
  const args = (context.triggerMetadata?.mcptoolargs ?? {}) as {
    country_code?: string;
  };
  const country = (args?.country_code || "").toUpperCase();
  if (!country) return JSON.stringify({ error: "country_code is required" });

  try {
    const result = await service.isTodayHoliday(country);
    if (result.isHoliday) {
      return JSON.stringify({
        message: `Yes, today is ${result.holidayName || "a public holiday"} in ${country}`,
      });
    }
    return JSON.stringify({
      message: `No, today is not a public holiday in ${country}.`,
    });
  } catch (err: any) {
    return JSON.stringify({ error: err.message });
  }
}

app.mcpTool("isTodayHoliday", {
  toolName: "is_today_holiday",
  description:
    "Checks whether today is a public holiday in the specified country.",
  toolProperties: {
    country_code: arg
      .string()
      .describe("ISO 3166-1 alpha-2 country code, e.g. PL"),
  },
  handler: isTodayHolidayHandler,
});

// ── get_holidays_by_year ─────────────────────────────────────────────
export async function getHolidaysByYearHandler(
  _toolArguments: unknown,
  context: InvocationContext
): Promise<string> {
  const args = (context.triggerMetadata?.mcptoolargs ?? {}) as {
    country_code?: string;
    year?: string;
  };
  const country = (args?.country_code || "").toUpperCase();
  const year = Number(args?.year);
  if (!country || !year)
    return JSON.stringify({ error: "year and country_code are required" });

  try {
    const data = await service.getHolidaysByYear(year, country);
    return JSON.stringify(data);
  } catch (err: any) {
    return JSON.stringify({ error: err.message });
  }
}

app.mcpTool("getHolidaysByYear", {
  toolName: "get_holidays_by_year",
  description:
    "Returns all public holidays for a given country and year.",
  toolProperties: {
    country_code: arg
      .string()
      .describe("ISO 3166-1 alpha-2 country code, e.g. PL"),
    year: arg
      .string()
      .describe("Four-digit year, e.g. 2025"),
  },
  handler: getHolidaysByYearHandler,
});

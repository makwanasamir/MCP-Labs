import * as service from "../services/holidaysService";

export async function tool_get_upcoming_holidays(input: any) {
  const country = (input?.country_code || input?.params?.country_code || input?.input?.country_code || "").toUpperCase();
  if (!country) return { status: 400, body: { error: "country_code required" } };
  const data = await service.getUpcomingHolidays(country);
  return { status: 200, body: data };
}

export async function tool_is_today_holiday(input: any) {
  const country = (input?.country_code || input?.params?.country_code || input?.input?.country_code || "").toUpperCase();
  if (!country) return { status: 400, body: { error: "country_code required" } };
  const result = await service.isTodayHoliday(country);
  if (result.isHoliday) return { status: 200, body: { message: `Yes, today is ${result.holidayName || "a public holiday"} in ${country}` } };
  return { status: 200, body: { message: `No, today is not a public holiday in ${country}.` } };
}

export async function tool_get_holidays_by_year(input: any) {
  const country = (input?.country_code || input?.params?.country_code || input?.input?.country_code || "").toUpperCase();
  const year = Number(input?.year || input?.params?.year || input?.input?.year);
  if (!country || !year) return { status: 400, body: { error: "year and country_code required" } };
  const data = await service.getHolidaysByYear(year, country);
  return { status: 200, body: data };
}

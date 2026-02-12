import axios from "axios";

const BASE = "https://date.nager.at/api/v3";

export interface Holiday {
  date: string;
  localName: string;
  name: string;
  countryCode: string;
  fixed: boolean;
  global: boolean;
  types?: string[];
}

export async function getUpcomingHolidays(countryCode: string): Promise<Holiday[]> {
  try {
    const url = `${BASE}/NextPublicHolidays/${encodeURIComponent(countryCode)}`;
    const res = await axios.get<Holiday[]>(url, { timeout: 5000 });
    return res.data;
  } catch (err: any) {
    if (err.response && err.response.status === 404) {
      throw new Error("Invalid country code. Please use ISO 3166-1 alpha-2 format (e.g., PL).");
    }
    throw new Error(`Failed to fetch upcoming holidays: ${err.message || err}`);
  }
}

export async function isTodayHoliday(countryCode: string): Promise<{ isHoliday: boolean; holidayName?: string }>{
  try {
    const url = `${BASE}/IsTodayPublicHoliday/${encodeURIComponent(countryCode)}`;
    const res = await axios.get(url, { validateStatus: () => true, timeout: 5000 });
    if (res.status === 200) {
      if (Array.isArray(res.data) && res.data.length > 0 && res.data[0].localName) {
        return { isHoliday: true, holidayName: res.data[0].localName };
      }
      return { isHoliday: true };
    }
    if (res.status === 204) {
      return { isHoliday: false };
    }
    const today = new Date().toISOString().slice(0,10);
    const year = new Date().getFullYear();
    const list = await getHolidaysByYear(year, countryCode);
    const match = list.find(h => h.date === today);
    if (match) return { isHoliday: true, holidayName: match.localName };
    return { isHoliday: false };
  } catch (err: any) {
    throw new Error(`Failed to check today holiday: ${err.message || err}`);
  }
}

export async function getHolidaysByYear(year: number, countryCode: string): Promise<Holiday[]> {
  try {
    const url = `${BASE}/PublicHolidays/${encodeURIComponent(String(year))}/${encodeURIComponent(countryCode)}`;
    const res = await axios.get<Holiday[]>(url, { timeout: 5000 });
    return res.data;
  } catch (err: any) {
    if (err.response && err.response.status === 404) {
      throw new Error("Invalid country code or year. Please check inputs.");
    }
    throw new Error(`Failed to fetch holidays by year: ${err.message || err}`);
  }
}

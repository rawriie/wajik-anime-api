const baseUrl = (process.env.OPLOVERZ_BASE_URL ?? "").trim() || "https://oploverz.ch";

const oploverzConfig: IAnimeConfig = {
  baseUrl,
  animePrefix: baseUrl.includes("oploverz.am") ? "/anime/" : "/series/",
};

export default oploverzConfig;
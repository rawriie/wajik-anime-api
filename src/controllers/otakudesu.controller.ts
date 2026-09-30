import type { Request, Response, NextFunction } from "express";
import type { IncomingMessage } from "node:http";
import https from "node:https";
import otakudesuScraper from "@scrapers/otakudesu.scraper.js";
import otakudesuParser from "@parsers/otakudesu.parser.js";
import otakudesuConfig from "@configs/otakudesu.config.js";
import otakudesuSchema from "@schemas/otakudesu.schema.js";
import setPayload from "@helpers/setPayload.js";
import { userAgent } from "@helpers/getHTML.js";
import * as v from "valibot";

const { baseUrl } = otakudesuConfig;

async function fetchWithRedirects(
  url: string,
  headers: Record<string, string>,
  redirectsLeft = 5
): Promise<IncomingMessage> {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);

    const request = https.request(parsed, { method: "GET", headers }, (response) => {
      const location = response.headers.location;

      if (response.statusCode && response.statusCode >= 300 && response.statusCode < 400 && location && redirectsLeft > 0) {
        response.resume();
        fetchWithRedirects(new URL(location, parsed).href, headers, redirectsLeft - 1).then(resolve, reject);
        return;
      }

      resolve(response);
    });

    request.on("error", reject);
    request.end();
  });
}

const otakudesuController = {
  async getRoot(req: Request, res: Response, next: NextFunction) {
    const routes: IRouteData[] = [
      {
        method: "GET",
        path: "/otakudesu/home",
        description: "Halaman utama",
        pathParams: [],
        queryParams: [],
      },
      {
        method: "GET",
        path: "/otakudesu/schedule",
        description: "Jadwal rilis",
        pathParams: [],
        queryParams: [],
      },
      {
        method: "GET",
        path: "/otakudesu/anime",
        description: "Daftar semua anime",
        pathParams: [],
        queryParams: [],
      },
      {
        method: "GET",
        path: "/otakudesu/genre",
        description: "Daftar semua genre",
        pathParams: [],
        queryParams: [],
      },
      {
        method: "GET",
        path: "/otakudesu/ongoing",
        description: "Daftar anime sedang tayang",
        pathParams: [],
        queryParams: [
          {
            key: "page",
            value: "string",
            defaultValue: "1",
            required: false,
          },
        ],
      },
      {
        method: "GET",
        path: "/otakudesu/completed",
        description: "Daftar anime selesai",
        pathParams: [],
        queryParams: [
          {
            key: "page",
            value: "string",
            defaultValue: "1",
            required: false,
          },
        ],
      },
      {
        method: "GET",
        path: "/otakudesu/search",
        description: "Daftar anime berdasarkan pencarian",
        pathParams: [],
        queryParams: [
          {
            key: "q",
            value: "string",
            defaultValue: null,
            required: true,
          },
        ],
      },
      {
        method: "GET",
        path: "/otakudesu/genre/{genreId}",
        description: "Daftar anime berdasarkan genre",
        pathParams: [
          {
            key: "genreId",
            value: "string",
            defaultValue: null,
            required: true,
          },
        ],
        queryParams: [
          {
            key: "page",
            value: "string",
            defaultValue: "1",
            required: false,
          },
        ],
      },
      {
        method: "GET",
        path: "/otakudesu/batch/{batchId}",
        description: "Batch anime berdasarkan id batch",
        pathParams: [
          {
            key: "batchId",
            value: "string",
            defaultValue: null,
            required: true,
          },
        ],
        queryParams: [],
      },
      {
        method: "GET",
        path: "/otakudesu/anime/{animeId}",
        description: "Detail anime berdasarkan id anime",
        pathParams: [
          {
            key: "animeId",
            value: "string",
            defaultValue: null,
            required: true,
          },
        ],
        queryParams: [],
      },
      {
        method: "GET",
        path: "/otakudesu/episode/{episodeId}",
        description: "Detail episode berdasarkan id episode",
        pathParams: [
          {
            key: "episodeId",
            value: "string",
            defaultValue: null,
            required: true,
          },
        ],
        queryParams: [],
      },
      {
        method: "GET | POST",
        path: "/otakudesu/server/{serverId}",
        description: "Link video berdasarkan id server",
        pathParams: [
          {
            key: "serverId",
            value: "string",
            defaultValue: null,
            required: true,
          },
        ],
        queryParams: [],
      },
      {
        method: "GET",
        path: "/otakudesu/source",
        description: "URL video yang bisa diputar dari URL embed apapun",
        pathParams: [],
        queryParams: [
          {
            key: "url",
            value: "string",
            defaultValue: null,
            required: true,
          },
        ],
      },
      {
        method: "GET",
        path: "/otakudesu/embed",
        description: "Proxy iframe halaman video desustream tanpa frame-blocking",
        pathParams: [],
        queryParams: [
          {
            key: "url",
            value: "string",
            defaultValue: null,
            required: true,
          },
        ],
      },
      {
        method: "GET",
        path: "/otakudesu/embed-check",
        description: "Cek apakah halaman desustream bisa di-iframe langsung",
        pathParams: [],
        queryParams: [
          {
            key: "url",
            value: "string",
            defaultValue: null,
            required: true,
          },
        ],
      },
    ];

    res.json(
      setPayload(res, {
        message: "Status: OK 🚀",
        data: { routes },
      })
    );
  },

  async getHome(req: Request, res: Response, next: NextFunction) {
    try {
      const ref = "https://google.com/";
      const document = await otakudesuScraper.scrapeDOM("/", ref);
      const home = otakudesuParser.parseHome(document);
      const payload = setPayload(res, {
        data: home,
      });

      res.json(payload);
    } catch (error) {
      next(error);
    }
  },

  async getSchedule(req: Request, res: Response, next: NextFunction) {
    try {
      const pathname = "/jadwal-rilis/";
      const document = await otakudesuScraper.scrapeDOM(pathname, baseUrl);
      const scheduleList = otakudesuParser.parseSchedules(document);
      const payload = setPayload(res, {
        data: { scheduleList },
      });

      res.json(payload);
    } catch (error) {
      next(error);
    }
  },

  async getAllAnimes(req: Request, res: Response, next: NextFunction) {
    try {
      const pathname = "/anime-list/";
      const document = await otakudesuScraper.scrapeDOM(pathname, baseUrl, true);
      const list = otakudesuParser.parseAllAnimes(document);
      const payload = setPayload(res, {
        data: { list },
      });

      res.json(payload);
    } catch (error) {
      next(error);
    }
  },

  async getAllGenres(req: Request, res: Response, next: NextFunction) {
    try {
      const pathname = "/genre-list/";
      const document = await otakudesuScraper.scrapeDOM(pathname, baseUrl);
      const genreList = otakudesuParser.parseAllGenres(document);
      const payload = setPayload(res, {
        data: { genreList },
      });

      res.json(payload);
    } catch (error) {
      next(error);
    }
  },

  async getOngoingAnimes(req: Request, res: Response, next: NextFunction) {
    try {
      const page = Number(v.parse(otakudesuSchema.query.animes, req.query)?.page);
      const pathname = page > 1 ? `/ongoing-anime/page/${page}/` : "/ongoing-anime/";
      const document = await otakudesuScraper.scrapeDOM(pathname, baseUrl);
      const animeList = otakudesuParser.parseOngoingAnimes(document);
      const pagination = otakudesuParser.parsePagination(document);
      const payload = setPayload(res, {
        data: { animeList },
        pagination,
      });

      res.json(payload);
    } catch (error) {
      next(error);
    }
  },

  async getCompletedAnimes(req: Request, res: Response, next: NextFunction) {
    try {
      const page = Number(v.parse(otakudesuSchema.query.animes, req.query)?.page);
      const pathname = page > 1 ? `/complete-anime/page/${page}/` : "/complete-anime/";
      const document = await otakudesuScraper.scrapeDOM(pathname, baseUrl);
      const animeList = otakudesuParser.parseCompletedAnimes(document);
      const pagination = otakudesuParser.parsePagination(document);
      const payload = setPayload(res, {
        data: { animeList },
        pagination,
      });

      res.json(payload);
    } catch (error) {
      next(error);
    }
  },

  async getSearchedAnimes(req: Request, res: Response, next: NextFunction) {
    try {
      const { q } = v.parse(otakudesuSchema.query.searchedAnimes, req.query);
      const pathname = `/?s=${q}&post_type=anime`;
      const document = await otakudesuScraper.scrapeDOM(pathname, baseUrl);
      const animeList = otakudesuParser.parseSearchedAnimes(document);
      const payload = setPayload(res, {
        data: { animeList },
      });

      res.json(payload);
    } catch (error) {
      next(error);
    }
  },

  async getAnimesByGenre(req: Request, res: Response, next: NextFunction) {
    try {
      const genreId = req.params.genreId;
      const page = Number(v.parse(otakudesuSchema.query.animes, req.query)?.page);
      const pathname = page > 1 ? `/genres/${genreId}/page/${page}/` : `/genres/${genreId}/`;
      const document = await otakudesuScraper.scrapeDOM(pathname, baseUrl);
      const animeList = otakudesuParser.parseAnimesByGenre(document);
      const pagination = otakudesuParser.parsePagination(document);
      const payload = setPayload(res, {
        data: { animeList },
        pagination,
      });

      res.json(payload);
    } catch (error) {
      next(error);
    }
  },

  async getBatchDetails(req: Request, res: Response, next: NextFunction) {
    try {
      const batchId = req.params.batchId;
      const pathname = `/batch/${batchId}/`;
      const document = await otakudesuScraper.scrapeDOM(pathname, baseUrl);
      const details = otakudesuParser.parseBatchDetails(document);
      const payload = setPayload(res, {
        data: { details },
      });

      res.json(payload);
    } catch (error) {
      next(error);
    }
  },

  async getAnimeDetails(req: Request, res: Response, next: NextFunction) {
    try {
      const animeId = req.params.animeId;
      const pathname = `/anime/${animeId}/`;
      const document = await otakudesuScraper.scrapeDOM(pathname, baseUrl);
      const details = otakudesuParser.parseAnimeDetails(document);
      const payload = setPayload(res, {
        data: { details },
      });

      res.json(payload);
    } catch (error) {
      next(error);
    }
  },

  async getEpisodeDetails(req: Request, res: Response, next: NextFunction) {
    try {
      const episodeId = req.params.episodeId;
      const pathname = `/episode/${episodeId}/`;
      const document = await otakudesuScraper.scrapeDOM(pathname, baseUrl);
      const details = await otakudesuParser.parseEpisodeDetails(
        document,
        new URL(pathname, baseUrl).toString()
      );
      const payload = setPayload(res, {
        data: { details },
      });

      res.json(payload);
    } catch (error) {
      next(error);
    }
  },

  async getServerDetails(req: Request, res: Response, next: NextFunction) {
    try {
      const serverId = req.params.serverId || "";
      const details = await otakudesuParser.parseServerDetails(serverId);
      const payload = setPayload(res, {
        data: { details },
      });

      res.json(payload);
    } catch (error: any) {
      if (error.message.includes("is not valid JSON")) {
        res.status(400).json(setPayload(res));

        return;
      }

      next(error);
    }
  },

  async getSource(req: Request, res: Response, next: NextFunction) {
    try {
      const { url } = v.parse(otakudesuSchema.query.source, req.query);
      const source = await otakudesuScraper.scrapeSource(url);
      const payload = setPayload(res, {
        data: { source },
      });

      res.json(payload);
    } catch (error) {
      next(error);
    }
  },

  async getEmbedCheck(req: Request, res: Response, next: NextFunction) {
    try {
      const { url } = v.parse(otakudesuSchema.query.source, req.query);

      const { embeddable } = await otakudesuScraper.scrapeEmbeddability(url);
      const payload = setPayload(res, {
        data: { embeddable },
      });

      res.json(payload);
    } catch (error) {
      next(error);
    }
  },

  async getEmbed(req: Request, res: Response, next: NextFunction) {
    try {
      const { url } = v.parse(otakudesuSchema.query.source, req.query);

      const html = await otakudesuScraper.scrapeEmbedPage(url);
      const proxied = html.replace(
        /(<source\s+src=")(https:\/\/[^"]*\.googlevideo\.com[^"]*)/gi,
        (_match, prefix: string, sourceUrl: string) =>
          `${prefix}/otakudesu/media?url=${encodeURIComponent(sourceUrl)}&ref=${encodeURIComponent(url)}`
      );

      res
        .type("html")
        .setHeader("Content-Security-Policy", "frame-ancestors *")
        .send(proxied);
    } catch (error) {
      next(error);
    }
  },

  async getMedia(req: Request, res: Response, next: NextFunction) {
    try {
      const { url } = v.parse(otakudesuSchema.query.source, req.query);

      const target = new URL(url);

      if (!/googlevideo\.com$/i.test(target.hostname)) {
        res.status(400).send(setPayload(res, { message: "invalid source" }));
        return;
      }

      const headers: Record<string, string> = { "User-Agent": userAgent };

      const ref = req.query.ref;
      if (typeof ref === "string" && ref.length > 0) headers.Referer = ref;

      const range = req.headers.range;
      if (range) headers.Range = range;

      const upstream = await fetchWithRedirects(target.href, headers);

      res.status(upstream.statusCode ?? 500);

      for (const header of [
        "content-type",
        "content-length",
        "content-range",
        "accept-ranges",
        "cache-control",
        "expires",
        "etag",
        "last-modified",
      ] as const) {
        const value = upstream.headers[header];
        if (value !== undefined) res.setHeader(header, value);
      }

      res.setHeader("Accept-Ranges", "bytes");

      upstream.on("error", () => res.end());
      res.on("close", () => upstream.destroy());
      upstream.pipe(res);
    } catch (error) {
      next(error);
    }
  },
};

export default otakudesuController;

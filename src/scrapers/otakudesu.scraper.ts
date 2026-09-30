import otakudesuConfig from "@configs/otakudesu.config.js";
import getHTML, { userAgent } from "@helpers/getHTML.js";
import { parse, type HTMLElement } from "node-html-parser";

const { baseUrl } = otakudesuConfig;

type TSourceType = "hls" | "mp4" | "video";

interface ISource {
  url: string;
  sourceType: TSourceType;
  type?: "iframe";
}

function isIframeCapable(url: string): boolean {
  return /\/video\.g\?/.test(url) || /youtube\.com\/(embed|v)\//.test(url);
}

async function getText(url: string, ref?: string): Promise<string> {
  const headers: Record<string, string> = { "User-Agent": userAgent };

  if (ref) headers.Referer = ref;

  const response = await fetch(url, { headers });

  return response.text();
}

function isDirectMedia(url: string): ISource | null {
  if (/\.m3u8($|\?)/i.test(url)) return { url, sourceType: "hls" };
  if (/\.mp4($|\?)/i.test(url)) return { url, sourceType: "mp4" };

  return null;
}

function decodeObfuscated(key: string, cipher: string): string {
  let output = "";

  for (let i = 0; i < cipher.length; i++) {
    output += String.fromCharCode(cipher.charCodeAt(i) ^ key.charCodeAt(i % key.length));
  }

  return output;
}

const otakudesuScraper = {
  async scrapeDOM(pathname: string, ref?: string, sanitize: boolean = false): Promise<HTMLElement> {
    const html = await getHTML(baseUrl, pathname, ref, sanitize);
    const document = parse(html, {
      parseNoneClosedTags: true,
    });

    return document;
  },

  async scrapeNonce(body: string, referer: string): Promise<{ data?: string }> {
    const nonceResponse = await fetch(new URL("/wp-admin/admin-ajax.php", baseUrl), {
      method: "POST",
      body,
      headers: {
        "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
        Referer: referer,
        Origin: baseUrl,
      },
    });

    const nonce = (await nonceResponse.json()) as { data: string };

    return nonce;
  },

  async scrapeServer(body: string, referer: string): Promise<{ data?: string }> {
    const serverResponse = await fetch(new URL("/wp-admin/admin-ajax.php", baseUrl), {
      method: "POST",
      body,
      headers: {
        "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
        Origin: baseUrl,
        Referer: referer,
      },
    });

    const server = (await serverResponse.json()) as { data: string };

    return server;
  },

  async scrapeEmbedPage(url: string): Promise<string> {
    return await getText(url, url);
  },

  async scrapeEmbeddability(url: string): Promise<{ embeddable: boolean }> {
    const response = await fetch(url, {
      headers: { "User-Agent": userAgent, Referer: url },
      redirect: "manual",
    });

    const csp = response.headers.get("content-security-policy") || "";
    const xfo = (response.headers.get("x-frame-options") || "").toUpperCase();
    const frameAncestors = /frame-ancestors\s+([^;]+)/i.exec(csp)?.[1];

    const allowsLocalhost = (source: string) =>
      source === "*" ||
      /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+|:?\*|$|\/)/i.test(source);

    if (frameAncestors) {
      const sources = frameAncestors.trim().split(/\s+/).filter(Boolean);

      return {
        embeddable:
          !sources.includes("'none'") &&
          !sources.includes("none") &&
          sources.some(allowsLocalhost),
      };
    }

    return {
      embeddable: !/DENY|SAMEORIGIN/.test(xfo),
    };
  },

  async scrapeDesustream(url: string): Promise<ISource> {
    const jsonUrl = new URL(url);
    jsonUrl.searchParams.set("mode", "json");
    jsonUrl.searchParams.set("_", String(Date.now()));

    const response = await fetch(jsonUrl, {
      headers: { "User-Agent": userAgent, Referer: url },
    });
    const data = (await response.json().catch(() => null)) as { video?: string } | null;

    if (data?.video) {
      return {
        url: data.video,
        sourceType: "video",
        ...(isIframeCapable(data.video) ? { type: "iframe" as const } : {}),
      };
    }

    const html = await getText(url, url);
    const videoSrc = html.match(/<source[^>]+src="([^"]+)"/i)?.[1] || html.match(/<video[^>]+src="([^"]+)"/i)?.[1];

    if (videoSrc) {
      return {
        url: videoSrc,
        sourceType: /\.m3u8/i.test(videoSrc) ? "hls" : /\.mp4|mime=video\/mp4/i.test(videoSrc) ? "mp4" : "video",
      };
    }

    const iframeSrc = html.match(/<iframe[^>]+src="([^"]+)"/i)?.[1];

    if (iframeSrc) {
      const resolved = isDirectMedia(iframeSrc) || (await this.scrapeSource(new URL(iframeSrc, url).toString(), url));

      return resolved;
    }

    return { url, sourceType: "video" };
  },

  async scrapeYourUpload(url: string): Promise<ISource> {
    const html = await getText(url, "https://yourupload.com/");
    const fileMatch = html.match(/file\s*[:=]\s*["']([^"']+)["']/i)?.[1];
    const ogMatch = html.match(/property="og:video"\s+content="([^"]+)"/i)?.[1];

    if (fileMatch && !/watermark/i.test(fileMatch)) {
      return { url: fileMatch, sourceType: fileMatch.includes(".m3u8") ? "hls" : "mp4" };
    }

    if (ogMatch) {
      return { url: ogMatch, sourceType: ogMatch.includes(".m3u8") ? "hls" : "mp4" };
    }

    return { url, sourceType: "video" };
  },

  async scrapeGDrivePlayer(url: string): Promise<ISource> {
    const html = await getText(url, url);
    const obfuscatedMatch = html.match(/var k="([^"]+)".*?atob\("([^"]+)"\)/s);

    if (obfuscatedMatch) {
      const [, key = "", cipher = ""] = obfuscatedMatch;
      const decoded = decodeObfuscated(key, Buffer.from(cipher, "base64").toString("binary"));
      const hlsMatch = decoded.match(/(?:var\s+)?HLS\s*=\s*"([^"]+)"/);
      const mp4Match = decoded.match(/(?:var\s+)?MP4\s*=\s*"([^"]+)"/);

      if (hlsMatch?.[1]) {
        const hlsUrl = new URL(hlsMatch[1], url).toString();

        return { url: hlsUrl, sourceType: "hls" };
      }

      if (mp4Match?.[1]) {
        const mp4Url = new URL(mp4Match[1], url).toString();

        return { url: mp4Url, sourceType: "mp4" };
      }
    }

    return { url, sourceType: "video" };
  },

  async scrapeBloggerVideo(url: string): Promise<ISource> {
    return { url, sourceType: "video", type: "iframe" };
  },

  async scrapeSource(url: string, ref?: string): Promise<ISource> {
    const direct = isDirectMedia(url);

    if (direct) return direct;

    const { hostname, pathname } = new URL(url);

    if (hostname.includes("desustream")) {
      return await this.scrapeDesustream(url);
    }

    if (hostname.includes("desudrive")) {
      const html = await getText(url, ref || "https://otakudesu.blog/");
      const iframeSrc = html.match(/<iframe[^>]+src="([^"]+)"/i)?.[1];

      if (iframeSrc) return await this.scrapeSource(new URL(iframeSrc, url).toString(), url);

      return { url, sourceType: "video" };
    }

    if (hostname.includes("yourupload")) {
      return await this.scrapeYourUpload(url);
    }

    if (hostname.includes("gdriveplayer")) {
      return await this.scrapeGDrivePlayer(url);
    }

    if (hostname.includes("blogger") || pathname.startsWith("/video.g")) {
      return await this.scrapeBloggerVideo(url);
    }

    return { url, sourceType: "video" };
  },
};

export default otakudesuScraper;

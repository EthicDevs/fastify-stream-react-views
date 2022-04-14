import {
  HeadTag,
  HeadTagLink,
  HeadTagMeta,
  HeadTagMetaCharset,
} from "../types";

function isMetaCharsetTag(tag: HeadTag): tag is HeadTagMetaCharset {
  if (tag.kind === "meta" && "charset" in tag) return true;
  return false;
}

function getMetaCharsetTagStr({ charset }: HeadTagMetaCharset): string {
  const attrs = [`charset="${charset}"`];
  return `<meta ${attrs.join(" ")} />`;
}

function isMetaTag(tag: HeadTag): tag is HeadTagMeta {
  if (tag.kind === "meta" && "charset" in tag === false) return true;
  return false;
}

function getMetaTagStr({ name, content }: HeadTagMeta): string {
  const attrs = [`name="${name}"`, `content="${content}"`];
  return `<meta ${attrs.join(" ")} />`;
}

function isLinkTag(tag: HeadTag): tag is HeadTagLink {
  if (tag.kind === "link") return true;
  return false;
}

function getLinkTagStr({
  href,
  hreflang,
  rel,
  title,
  type,
}: HeadTagLink): string {
  const attrs = [`href="${href}"`, `rel="${rel}"`];
  if (hreflang != null) {
    attrs.push(`hreflang="${hreflang}"`);
  }
  if (title != null) {
    attrs.push(`title="${title}"`);
  }
  if (type != null) {
    attrs.push(`type="${type}"`);
  }
  return `<link ${attrs.join(" ")} />`;
}

export function getHeadTagsStr(tags: HeadTag[]): string {
  const stringBuilder = [] as string[];
  tags.forEach((tag) => {
    if (tag != null) {
      if (isMetaCharsetTag(tag)) {
        stringBuilder.push(getMetaCharsetTagStr(tag));
      } else if (isMetaTag(tag)) {
        stringBuilder.push(getMetaTagStr(tag));
      } else if (isLinkTag(tag)) {
        stringBuilder.push(getLinkTagStr(tag));
      }
    }
  });
  return stringBuilder.join("");
}

export function getHtmlTagsStr({
  lang,
  dir,
}: {
  lang?: string | undefined;
  dir?: string | undefined;
}): string {
  const stringBuilder = [];

  if (lang != null) {
    stringBuilder.push(`lang="${lang}"`);
  }

  if (dir != null) {
    stringBuilder.push(`dir="${dir}"`);
  }

  return stringBuilder.join(" ");
}

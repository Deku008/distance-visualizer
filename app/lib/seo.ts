export const siteUrl = "https://routevision.online";

export const absoluteUrl = (path = "/") => new URL(path, siteUrl).toString();

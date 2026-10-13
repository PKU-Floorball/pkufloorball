"use client";
import { useEffect, useRef } from "react";
import Script from "next/script";
import header from "./association-header-data.json";

/** Render the same trusted, build-generated template as the main association site. */
export default function AssociationHeader() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const measure = () => document.documentElement.style.setProperty("--association-header-height", `${node.getBoundingClientRect().height}px`);
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    measure();
    return () => observer.disconnect();
  }, []);
  return <>
    <link rel="stylesheet" href="/assets/vendor/fonts/fonts.css" />
    <link rel="stylesheet" href="/association-header.css" />
    <div className="association-header association-topbar" dangerouslySetInnerHTML={{ __html: header.topHtml }} />
    <div ref={ref} className="association-header association-navigation" dangerouslySetInnerHTML={{ __html: header.html }} />
    <Script src="/assets/vendor/bootstrap/bootstrap.bundle.min.js" strategy="afterInteractive" />
  </>;
}

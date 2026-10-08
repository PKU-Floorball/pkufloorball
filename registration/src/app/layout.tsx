import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "球队报名站 · 北大地板球",
  description:
    "创建球队、加入伙伴，一起上场。北京大学软式曲棍球协会球队报名系统。",
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}

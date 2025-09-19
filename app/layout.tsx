// /app/layout.tsx

import type { Metadata } from "next";
import "./global.css"; // CSSをモジュールとして読み込む
import "../public/themes/default/default.css"; // テーマCSSを読み込む

export const metadata: Metadata = {
    title: "Gardens next Pass Viewer",
    description: "A viewer for Next Pass data from Gardens Point",
    icons: {
        icon: "/GSS_logo128.png",
    },
};

export default function RootLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <html lang="ja">
            <head>
                <title>Next Pass Viewer</title>
            </head>
            <body>{children}</body>
        </html>
    );
}

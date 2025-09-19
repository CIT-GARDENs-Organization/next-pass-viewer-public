// /app/api/time/route.ts

export async function GET() {
    const now = new Date();
    const utc = now.toUTCString();
    // デバッグ用時間カスタム
    // const thirtyMinutesLater = new Date(now.getTime() + -2 * 60 * 1000);
    // const utc = thirtyMinutesLater.toUTCString();
    console.debug(utc)

    return new Response(
        JSON.stringify({
            utc: utc
        }),
        { headers: { "Content-Type": "application/json" } }
    );
}

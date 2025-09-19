// /app/pages/index.tsx

'use client';

import dynamic from "next/dynamic"; // SSR で読み込まないコンポーネントを動的インポート
import { useEffect, useState, useRef, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { THEMES, ThemeKey } from "../public/themes"; // パスは実際の配置に合わせて

/* ---------------------------
    型定義
--------------------------- */
interface Satellite {
    name: string;
}

interface Pass {
    aos_time: string;
    los_time: string;
    satellites: Satellite;
    max_elevation?: number;
    aos_azimuth?: number;
    max_azimuth?: number;
    los_azimuth?: number;
    time_mode: "AOS" | "LOS";
    remainingTime: number;
}

type AlertStage = "none" | "twentyMin" | "fifteenMin" | "los";

function HomePage() {
    /* ---------------------------
        ステート群
    --------------------------- */
    const [passes, setPasses] = useState<Pass[]>([]);
    const passesRef = useRef<Pass[]>([]);

    const [serverTime, setServerTime] = useState<string | null>(null);
    const [lastUpdate, setLastUpdate] = useState<string>("Loading...");

    const [alertStage, setAlertStage] = useState<AlertStage>("none");
    // const [hasPlayedAlert, setHasPlayedAlert] = useState<boolean>(false);
    const [isAudioAllowed, setIsAudioAllowed] = useState<boolean>(false);
    const [fetchError, setFetchError] = useState<string | null>(null);

    // ★ 追加: パスごとに選んだ「テーマ名」の配列
    //         passes[i]用のテーマが themesForPasses[i] に入る想定
    const [themesForPasses, setThemesForPasses] = useState<ThemeKey[]>([]);

    // WebSocket 用
    // const wsRef = useRef<WebSocket | null>(null);

    const searchParams = useSearchParams();
    const isFetchingPassesRef = useRef<boolean>(false);

    /* ---------------------------
        各種フォーマット用関数
    --------------------------- */
    // UTC用のフォーマット関数
    function formatDateTimeUTC(dateInput: string | Date): string {
        const d = new Date(dateInput);
        const yyyy = d.getUTCFullYear();
        const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
        const dd = String(d.getUTCDate()).padStart(2, "0");
        const hh = String(d.getUTCHours()).padStart(2, "0");
        const nn = String(d.getUTCMinutes()).padStart(2, "0");
        const ss = String(d.getUTCSeconds()).padStart(2, "0");
        return `${yyyy}-${mm}-${dd} ${hh}:${nn}:${ss}`;
    }

    // JST用のフォーマット関数
    function formatDateTimeJST(dateInput: string | Date): string {
        // まずUTCとしてDateを作り、9時間加算する
        const d = new Date(dateInput);
        const jstTime = d.getTime() + 9 * 60 * 60 * 1000;
        const jstDate = new Date(jstTime);

        // あくまで「UTCベースで getUTC* して yyyy-mm-dd HH:MM:SS を作る」ことでズレをなくす
        const yyyy = jstDate.getUTCFullYear();
        const mm = String(jstDate.getUTCMonth() + 1).padStart(2, "0");
        const dd = String(jstDate.getUTCDate()).padStart(2, "0");
        const hh = String(jstDate.getUTCHours()).padStart(2, "0");
        const nn = String(jstDate.getUTCMinutes()).padStart(2, "0");
        const ss = String(jstDate.getUTCSeconds()).padStart(2, "0");
        return `${yyyy}-${mm}-${dd} ${hh}:${nn}:${ss}`;
    }

    const formatCountdown = (ms: number) => {
        if (isNaN(ms) || ms < 0) ms = 0;
        const sec = Math.floor(ms / 1000) % 60;
        const min = Math.floor(ms / (1000 * 60)) % 60;
        const hour = Math.floor(ms / (1000 * 60 * 60));
        return `${String(hour).padStart(2, "0")}:${String(min).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
    };

    const formatTime = (date: string | Date) => {
        const d = new Date(date);
        const hh = String(d.getHours()).padStart(2, "0");
        const nn = String(d.getMinutes()).padStart(2, "0");
        const ss = String(d.getSeconds()).padStart(2, "0");
        return `${hh}:${nn}:${ss}`;
    };

    const getOrdinal = (n: number) => {
        const s = ["th", "st", "nd", "rd"];
        const v = n % 100;
        return `${n}${s[(v - 20) % 10] || s[v] || s[0]}`;
    };

    /* ---------------------------
        時間帯判定(音声再生用)
    --------------------------- */
    function isWithinTimeRange(startTime: string, endTime: string): boolean {
        const now = new Date();
        const currentHours = now.getHours();
        const currentMinutes = now.getMinutes();

        const currentTotal = currentHours * 60 + currentMinutes;
        const [sh, sm] = startTime.split(":").map(Number);
        const startTotal = sh * 60 + sm;
        const [eh, em] = endTime.split(":").map(Number);
        const endTotal = eh * 60 + em;

        return currentTotal >= startTotal && currentTotal <= endTotal;
    }

    /* ---------------------------
        Audio の初期化
    --------------------------- */
    // useEffect(() => {
    //     if (typeof window !== "undefined") {
    //         alertAudio.current = new Audio('/music/Dashing_YOMOGI_alert_v2.m4a');
    //         alertAudio.current.loop = false;
    //     }
    // }, []);

    /* ---------------------------
        パスデータを取得
    --------------------------- */
    const fetchPasses = useCallback(async (startTime?: string) => {
        try {
            const params = new URLSearchParams(searchParams.toString());
            if (startTime) {
                params.append("start_time", startTime);
            }
            const res = await fetch(`/api/passes?${params.toString()}`);

            if (!res.ok) {
                const { error } = await res.json();
                setFetchError(error || "パスデータの取得に失敗しました。");
                return [];
            }
            const data = await res.json();
            if (!Array.isArray(data)) {
                setFetchError("データの構造が不正です。");
                return [];
            }
            const passesData = data as Pass[];
            if (passesData.some((p) => !p.aos_time || !p.los_time)) {
                setFetchError("パスデータに不足があります。");
                return [];
            }

            setFetchError(null);
            return data as Pass[];
        } catch (err) {
            console.error("fetchPasses error:", err);
            setFetchError("パスデータの取得中にエラーが発生しました。");
            return [];
        }
    }, [searchParams]);

    /* ---------------------------
        時刻データを取得
    --------------------------- */
    const fetchTime = useCallback(async (): Promise<string | null> => {
        try {
            const res = await fetch("/api/time");
            if (!res.ok) {
                const { error } = await res.json();
                console.error("time API error:", error);
                return null;
            }
            const data = await res.json();
            if (!data?.utc) {
                console.error("Invalid time data:", data);
                return null;
            }

            // UTCを確実にパース
            const utcTime = new Date(Date.parse(data.utc)).toISOString();
            setServerTime(utcTime);
            return utcTime;
        } catch (e) {
            console.error("fetchTime error:", e);
            return null;
        }
    }, []);

    /* ---------------------------
        テーマを決定するロジック
        - バイパス指定があれば全パスそれに
        - 無ければランダム
  --------------------------- */
    const decideThemesForPasses = useCallback((passCount: number): ThemeKey[] => {
        // 例: クエリパラメータ "?theme=default" があれば強制固定
        const paramTheme = searchParams.get("theme"); // "default" など
        console.log("パラメータテーマ:", paramTheme);
        const keys = Object.keys(THEMES) as ThemeKey[];

        // 全パス共通で固定するバージョン
        if (paramTheme && keys.includes(paramTheme as ThemeKey)) {
            return Array(passCount).fill(paramTheme as ThemeKey);
        }

        // ランダムに決めるバージョン
        const result: ThemeKey[] = [];
        for (let i = 0; i < passCount; i++) {
            const randIndex = Math.floor(Math.random() * keys.length);
            result.push(keys[randIndex]);
        }
        return result;
    }, [searchParams]);

    /* ---------------------------
        パスの残り時間更新のみ
        (アラートステージはここでは変更しない)
    --------------------------- */
    const updatePasses = useCallback(async (currentTime: string) => {
        const nowMs = new Date(currentTime).getTime();
        if (isNaN(nowMs)) {
            console.error("Invalid currentTime:", currentTime);
            return;
        }

        const updated = passesRef.current
            .map((p) => {
                const aosMs = new Date(p.aos_time).getTime();
                const losMs = new Date(p.los_time).getTime();
                if (nowMs < aosMs) {
                    return { ...p, time_mode: "AOS", remainingTime: aosMs - nowMs };
                } else if (nowMs < losMs) {
                    return { ...p, time_mode: "LOS", remainingTime: losMs - nowMs };
                } else {
                    return null;
                }
            })
            .filter(Boolean) as Pass[];

        setPasses(updated);
        passesRef.current = updated;

        // 表示件数
        const viewLength = parseInt(searchParams.get("view") || "2");
        if (updated.length < viewLength && !isFetchingPassesRef.current) {
            isFetchingPassesRef.current = true;
            const lastLos = updated.length > 0 ? updated[updated.length - 1].los_time : undefined;
            const newPasses = lastLos ? await fetchPasses(lastLos) : await fetchPasses();
            if (newPasses.length > 0) {
                const combined = [...updated, ...newPasses].slice(0, viewLength);
                setPasses(combined);
                passesRef.current = combined;
                setLastUpdate(new Date().toISOString());
            }
            isFetchingPassesRef.current = false;
        }
    }, [fetchPasses, searchParams]);

    /* ---------------------------
        初期化 & タイマー
    --------------------------- */
    useEffect(() => {
        let isMounted = true;

        const init = async () => {
            const t = await fetchTime();
            if (!isMounted) return;
            if (t) {
                const p = await fetchPasses();
                if (!isMounted) return;
                setPasses(p);
                passesRef.current = p;
                setLastUpdate(new Date().toISOString());
            }
        };

        init();

        const timer = setInterval(async () => {
            const newTime = await fetchTime();
            if (!isMounted) return;
            if (newTime) {
                await updatePasses(newTime);
            }
        }, 1000);

        return () => {
            isMounted = false;
            clearInterval(timer);
        };
    }, [fetchPasses, fetchTime, updatePasses]);

    // クエリパラメータ変更時の再取得
    useEffect(() => {
        let isMounted = true;

        const fetchAndSet = async () => {
            const p = await fetchPasses();
            if (!isMounted) return;
            setPasses(p);
            passesRef.current = p;
            setLastUpdate(new Date().toISOString());
        };

        fetchAndSet();

        return () => {
            isMounted = false;
        };
    }, [fetchPasses, searchParams]);


    /* ---------------------------
        パス決定後にテーマも再決定
  --------------------------- */
    // ★ テーマのロック状態を管理するフラグ
    const [isThemeLocked, setIsThemeLocked] = useState<boolean>(false);

    useEffect(() => {
        // アラートステージが「none」以外＝実行中の場合は、初回のみテーマを決定してロックする
        if (alertStage !== "none") {
            // まだロックされていなければ、ランダムにテーマを決定してロック
            if (!isThemeLocked) {
                const newThemes: ThemeKey[] = decideThemesForPasses(passes.length);
                setThemesForPasses(newThemes);
                setIsThemeLocked(true);
                console.log("アラート実行開始に伴いテーマをロック:", newThemes);
            }
            // すでにロック済みの場合は何もしない
        } else {
            // アラートステージが "none" の場合はロックを解除し、パス更新に合わせてテーマを更新
            if (isThemeLocked) {
                console.log("アラート終了に伴いテーマロックを解除");
            }
            setIsThemeLocked(false);
            const newThemes: ThemeKey[] = decideThemesForPasses(passes.length);
            setThemesForPasses(newThemes);
        }
    }, [alertStage, decideThemesForPasses, isThemeLocked, passes]);



    /* ====================================================
        (1) アラートステージ判定(先頭パスのみ参照) [既存のまま]
        - ただし newTime => setAlertStage(...) という流れ
        - SPECIAL=TRUE かつ isAudioAllowed かどうか確認
    ==================================================== */
    useEffect(() => {
        // もし音声未許可 or SPECIAL != TRUE ならステージを none に
        if (!isAudioAllowed || searchParams.get("SPECIAL") !== "TRUE") {
            setAlertStage("none");
            return;
        }

        // 先頭パスが無ければ何もできない
        const firstPass = passes[0];
        if (!firstPass) {
            setAlertStage("none");
            return;
        }

        // サーバ時刻 or 現在時刻
        const nowMs = serverTime
            ? new Date(serverTime).getTime()
            : Date.now();

        const aosMs = new Date(firstPass.aos_time).getTime();
        const losMs = new Date(firstPass.los_time).getTime();

        // すでにLOS過ぎていたらアラート不要
        if (nowMs > losMs) {
            setAlertStage("none");
            return;
        }

        // AOS～LOSの間ならLOSステージ
        if (nowMs >= aosMs && nowMs <= losMs) {
            setAlertStage("los");
            return;
        }

        // ここから先は「AOS前」
        const diff = aosMs - nowMs;
        if (diff <= 15 * 60 * 1000) {
            setAlertStage("fifteenMin");
        } else if (diff <= 20 * 60 * 1000) {
            setAlertStage("twentyMin");
        } else {
            setAlertStage("none");
        }
    }, [passes, isAudioAllowed, searchParams, serverTime]);

    /* ====================================================
        (2) アラートステージごとのクラス切り替え
        ここで「既存の alert-XX-active」に加え
        「テーマ固有クラス」も付け外しする
    ==================================================== */
    useEffect(() => {
        console.log("現在のアラートステージ:", alertStage);

        // 先に既存クラスをremove
        document.body.classList.remove(
            "alert-20min-active",
            "alert-15min-active",
            "alert-los-active"
        );

        // 先頭パスのテーマが何かを参照
        const firstThemeKey = themesForPasses[0];
        if (!firstThemeKey) {
            // パスが無い or テーマ未定 => 従来のnone扱い
            return;
        }

        // テーマ固有のクラスを外す: すべて remove => つけ直す
        // (実際にはテーマ数だけ remove する)
        for (const k of Object.keys(THEMES) as ThemeKey[]) {
            const def = THEMES[k];
            document.body.classList.remove(
                def.classes.twentyMin,
                def.classes.fifteenMin,
                def.classes.los
            );
        }

        // 既存クラスの付与
        switch (alertStage) {
            case "twentyMin":
                document.body.classList.add("alert-20min-active");
                console.log("20分前ステージに突入");
                break;
            case "fifteenMin":
                document.body.classList.add("alert-15min-active");
                console.log("15分前ステージに突入");
                break;
            case "los":
                document.body.classList.add("alert-los-active");
                console.log("LOS中ステージに突入");
                break;
            default:
                break;
        }

        // ★ テーマ固有クラスを付与
        const themeDef = THEMES[firstThemeKey] ?? THEMES.default;
        if (alertStage === "twentyMin") {
            document.body.classList.add(themeDef.classes.twentyMin);
        } else if (alertStage === "fifteenMin") {
            document.body.classList.add(themeDef.classes.fifteenMin);
        } else if (alertStage === "los") {
            document.body.classList.add(themeDef.classes.los);
        }
    }, [alertStage, themesForPasses]);

    /* ====================================================
        (3) 「15分前突入時にすぐ音声再生」したければ:
            既存の通りでもいいが、サーバ一斉トリガーを
            優先するならオフにしておく
    ==================================================== */
    useEffect(() => {
        if (alertStage === "fifteenMin") {
            const firstThemeKey = themesForPasses[0];
            if (firstThemeKey && isAudioAllowed && isWithinTimeRange("09:00", "22:00")) {
                const audio = new Audio(THEMES[firstThemeKey].audioSrcFifteenMin);
                audio.play().catch(err => console.error("音楽再生エラー:", err));
            }
        }
    }, [alertStage, isAudioAllowed, themesForPasses]);

    /* ====================================================
        (4) ユーザが音声を許可
    ==================================================== */
    const handleAllowAudio = () => {
        console.log("音声再生が許可されました。");
        setIsAudioAllowed(true);
    };

    /* ====================================================
        JSX返却
    ==================================================== */
    return (
        <div className="container">
            <div className="text-center">
                <h1>UTC: {serverTime ? formatDateTimeUTC(serverTime) : "Loading..."}</h1>
                <h1>JST: {serverTime ? formatDateTimeJST(serverTime) : "Loading..."}</h1>
            </div>
            <hr style={{ borderColor: "white", width: "100%" }} />

            {/* エラーメッセージの表示 */}
            {fetchError && (
                <div className="alert alert-danger text-center">
                    <p>Pass Error: {fetchError}</p>
                </div>
            )}

            {/* SPECIAL=TRUE の場合のみ音声再生許可ボタンを表示 */}
            {searchParams.get("SPECIAL") === "TRUE" && !isAudioAllowed && (
                <div className="alert alert-info text-center">
                    <p>
                        現代は勝手に音声を再生することが許可されていません。ユーザの許可が必要です。<br />
                        スペシャルモードを有効にすることで、指定の条件が満たされた際にスペシャルモードが発動します。<br />
                        承諾する場合は、以下のボタンをクリックしてください。
                    </p>
                    <button onClick={handleAllowAudio} className="btn btn-primary">
                        スペシャルモードを有効
                    </button>
                </div>
            )}

            {/* パスカード一覧 */}
            {passes.map((pass, index) => {
                const isFirst = (index === 0); // 一番最初のパスかどうか
                return (
                    <div
                        key={index}
                        className={`card ${isFirst ? "first-pass-card" : ""}`}
                    >
                        <div className="card-header">
                            {getOrdinal(index + 1)}.{" "}
                            <span className="satellite-name">{pass.satellites?.name || "Unknown Satellite"}</span>
                        </div>
                        <div className="card-body">
                        <p>Visible: {formatTime(pass.aos_time)}</p>
                        <p>Max Elevation: {pass.max_elevation?.toFixed(1) || "N/A"}</p>
                        <p className="countdown-time">
                            {pass.time_mode}: {formatCountdown(pass.remainingTime)}
                        </p>
                        <p>
                            Azimuth: {pass.aos_azimuth?.toFixed(1) || "N/A"} - {pass.max_azimuth?.toFixed(1) || "N/A"} -{" "}
                            {pass.los_azimuth?.toFixed(1) || "N/A"}
                        </p>
                        </div>
                    </div>
                );
            })}

            <div className="footer">
                Last Update: {lastUpdate !== "Loading..." ? formatDateTimeJST(lastUpdate) : "Loading..."}
            </div>
            <div className="footer">©GARDENs</div>
        </div>
    );
}

// SSR を無効化してクライアントサイドのみで動かす
export default dynamic(() => Promise.resolve(HomePage), {
    ssr: false,
});
